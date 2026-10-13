import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { Receipt } from '../../../shared/src/types.js';

export interface EmailAttachment {
  filename: string;
  contentType?: string;
  content?: Buffer | string;
  contentBase64?: string;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: 'SENT' | 'FAILED';
  error?: string;
  sentAt: string;
  previewUrl?: string;
}

// In-memory diagnostic log for admin inspection
export const emailLogs: EmailLogEntry[] = [];

export interface SendEmailParams {
  to: string;
  subject: string;
  template: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Send email via Google Apps Script Web App (Primary Provider)
 * Follows validated legacy protocol: POST text/plain;charset=utf-8 with manual redirect handling.
 */
export async function sendViaAppsScript(url: string, params: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  provider: 'apps_script';
}> {
  const webhookBody: any = {
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text || params.subject,
  };

  if (Array.isArray(params.attachments) && params.attachments.length > 0) {
    webhookBody.attachments = params.attachments.map((att) => {
      let base64 = att.contentBase64 || '';
      if (!base64 && att.content) {
        base64 = Buffer.isBuffer(att.content)
          ? att.content.toString('base64')
          : Buffer.from(att.content).toString('base64');
      }
      return {
        filename: att.filename,
        contentType: att.contentType || 'application/pdf',
        contentBase64: base64,
      };
    });
  }

  const response = await fetch(url.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(webhookBody),
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });

  // In Google Apps Script Web Apps, returning ContentService output on POST triggers a 302 redirect.
  // Status 200 or 302 confirms doPost executed on Google servers and MailApp.sendEmail() ran.
  if (response.status === 200 || response.status === 302) {
    const location = response.headers.get('location');
    if (location) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const echoRes = await fetch(location, { method: 'GET', signal: controller.signal });
        clearTimeout(timer);
        if (echoRes.ok) {
          const echoText = await echoRes.text();
          try {
            const echoJson = JSON.parse(echoText);
            if (echoJson && (echoJson.status === 'error' || echoJson.success === false)) {
              throw new Error(`[Google Apps Script Error] ${echoJson.message || echoJson.error || 'Erro reportado pelo script'}`);
            }
          } catch (parseErr: any) {
            if (parseErr.message?.includes('[Google Apps Script Error]')) throw parseErr;
          }
        }
      } catch (echoErr: any) {
        if (echoErr.message?.includes('[Google Apps Script Error]')) throw echoErr;
        // Echo proxy timeouts or 404s can be safely ignored because the 302 already confirms execution
      }
    }
    return { success: true, messageId: `gas-${Date.now()}`, provider: 'apps_script' };
  }

  const text = await response.text().catch(() => '');
  throw new Error(`Google Apps Script respondeu com status ${response.status}${text ? `: ${text}` : ''}`);
}

export async function sendTransactionalEmail(params: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  previewUrl?: string;
  provider?: string;
}> {
  const logEntry: EmailLogEntry = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    to: params.to,
    subject: params.subject,
    template: params.template,
    status: 'FAILED',
    sentAt: new Date().toISOString(),
  };

  try {
    const appsScriptUrl = process.env.APPS_SCRIPT_URL || config.email.appsScriptUrl;
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';

    // 1. Primary Provider: Google Apps Script Web App
    if (appsScriptUrl && appsScriptUrl.trim().startsWith('http')) {
      const res = await sendViaAppsScript(appsScriptUrl, params);
      logEntry.status = 'SENT';
      logEntry.error = undefined;
      emailLogs.unshift(logEntry);
      if (emailLogs.length > 200) emailLogs.pop();
      console.log(`[Email Sent] [${params.template}] to: ${params.to} (Apps Script)`);
      return { success: true, messageId: res.messageId, provider: 'apps_script' };
    }

    // 2. Production: FAIL CLOSED if APPS_SCRIPT_URL is missing
    if (isProduction) {
      throw new Error('Serviço de e-mail de produção indisponível (APPS_SCRIPT_URL não configurado).');
    }

    // 3. Automated Test Environment fallback
    if (isTest) {
      const mailer = nodemailer.createTransport({ jsonTransport: true });
      const info = await mailer.sendMail({
        from: config.email.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text || params.subject,
      });
      logEntry.status = 'SENT';
      logEntry.error = undefined;
      emailLogs.unshift(logEntry);
      if (emailLogs.length > 200) emailLogs.pop();
      return { success: true, messageId: info.messageId, provider: 'test' };
    }

    // 4. Development mode fallback: use SMTP if explicitly provided, else fail closed
    if (config.email.smtpHost && config.email.smtpUser) {
      const mailer = nodemailer.createTransport({
        host: config.email.smtpHost,
        port: config.email.smtpPort,
        secure: config.email.smtpPort === 465,
        auth: {
          user: config.email.smtpUser,
          pass: config.email.smtpPass,
        },
      });
      const info = await mailer.sendMail({
        from: config.email.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text || params.subject,
      });
      logEntry.status = 'SENT';
      logEntry.error = undefined;
      emailLogs.unshift(logEntry);
      if (emailLogs.length > 200) emailLogs.pop();
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    }

    throw new Error('Serviço de e-mail não configurado para desenvolvimento (configure APPS_SCRIPT_URL ou SMTP).');
  } catch (error: any) {
    const errorMsg = error?.message || 'Falha ao enviar e-mail';
    logEntry.status = 'FAILED';
    logEntry.error = errorMsg;
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 200) emailLogs.pop();

    console.warn(`[Email Delivery Failed] to: ${params.to} - reason: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// --- Specific Transactional Email Templates ---

export async function sendPassengerRegistrationEmail(to: string, name: string) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #16A34A; border-radius: 12px; background: #0F172A; color: #F8FAFC;">
      <h1 style="color: #22C55E; margin-bottom: 8px;">Bem-vindo ao VaiCar, ${name}!</h1>
      <p style="font-size: 16px; color: #94A3B8;">Seu cadastro como passageiro em São Sebastião foi realizado com sucesso.</p>
      <div style="background: #1E293B; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #F8FAFC;">Agora você pode solicitar viagens seguras, com motoristas locais e tarifas justas por todo o Litoral Norte.</p>
      </div>
      <p style="color: #64748B; font-size: 12px;">Equipe VaiCar — São Sebastião / SP</p>
    </div>
  `;
  return sendTransactionalEmail({
    to,
    subject: 'Bem-vindo ao VaiCar — Cadastro de Passageiro Concluído',
    template: 'PASSENGER_REGISTRATION',
    html,
  });
}

export async function sendPassengerPinEmail(to: string, pin: string) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #16A34A; border-radius: 12px; background: #0F172A; color: #F8FAFC;">
      <h2 style="color: #22C55E;">Seu código de acesso VaiCar</h2>
      <p style="color: #94A3B8;">Utilize o código abaixo para validar sua solicitação ou login:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #FACC15; background: #1E293B; padding: 16px; text-align: center; border-radius: 8px; margin: 24px 0;">
        ${pin}
      </div>
      <p style="color: #64748B; font-size: 12px;">Este código expira em 15 minutos. Não o compartilhe com ninguém.</p>
    </div>
  `;
  return sendTransactionalEmail({
    to,
    subject: `Seu PIN de verificação VaiCar: ${pin}`,
    template: 'PASSENGER_PIN',
    html,
  });
}

export async function sendDriverRegistrationEmail(to: string, name: string) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #16A34A; border-radius: 12px; background: #0F172A; color: #F8FAFC;">
      <h1 style="color: #22C55E; margin-bottom: 8px;">Cadastro recebido, ${name}!</h1>
      <p style="font-size: 16px; color: #94A3B8;">Obrigado por se cadastrar como motorista parceiro no VaiCar em São Sebastião.</p>
      <div style="background: #1E293B; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #FACC15; font-weight: bold;">Status atual: Aguardando Aprovação</p>
        <p style="margin-top: 8px; color: #F8FAFC;">Nossa equipe administrativa está conferindo seus dados e CNH. Você receberá um e-mail assim que sua conta for liberada para ficar online.</p>
      </div>
      <p style="color: #64748B; font-size: 12px;">Equipe VaiCar — Conectando motoristas e passageiros com tarifas justas e taxas reduzidas.</p>
    </div>
  `;
  return sendTransactionalEmail({
    to,
    subject: 'Cadastro de Motorista Recebido — VaiCar São Sebastião',
    template: 'DRIVER_REGISTRATION',
    html,
  });
}

export async function sendDriverPinEmail(to: string, pin: string) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #16A34A; border-radius: 12px; background: #0F172A; color: #F8FAFC;">
      <h2 style="color: #22C55E;">PIN de Acesso do Motorista</h2>
      <p style="color: #94A3B8;">Utilize o código de segurança para autenticar seu aplicativo de motorista:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #22C55E; background: #1E293B; padding: 16px; text-align: center; border-radius: 8px; margin: 24px 0;">
        ${pin}
      </div>
      <p style="color: #64748B; font-size: 12px;">Válido por 15 minutos.</p>
    </div>
  `;
  return sendTransactionalEmail({
    to,
    subject: `PIN de Verificação Motorista VaiCar: ${pin}`,
    template: 'DRIVER_PIN',
    html,
  });
}

export async function sendPasswordResetEmail(to: string, pin: string) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #10B981; border-radius: 12px; background: #0F172A; color: #F8FAFC;">
      <h1 style="color: #10B981; margin-bottom: 8px;">Recuperação de Senha — VaiCar</h1>
      <p style="font-size: 15px; color: #94A3B8;">Você solicitou a redefinição de senha para sua conta na plataforma VaiCar.</p>
      <div style="background: #1E293B; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0; border: 1px dashed #10B981;">
        <span style="font-size: 13px; color: #94A3B8; display: block; margin-bottom: 8px;">SEU CÓDIGO DE RECUPERAÇÃO (PIN):</span>
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #10B981;">${pin}</span>
      </div>
      <p style="font-size: 13px; color: #CBD5E1;">Este código é válido por <strong>15 minutos</strong> e pode ser utilizado apenas uma vez.</p>
      <p style="font-size: 13px; color: #94A3B8;">Se você não solicitou esta redefinição, sua conta permanece segura e você pode ignorar esta mensagem.</p>
      <p style="color: #64748B; font-size: 12px; margin-top: 24px;">Equipe VaiCar — Mobilidade Urbana no Litoral Norte</p>
    </div>
  `;
  return sendTransactionalEmail({
    to,
    subject: `VaiCar - Código de Recuperação de Senha: ${pin}`,
    template: 'PASSWORD_RESET',
    html,
  });
}

export async function sendDriverStatusEmail(
  to: string,
  name: string,
  status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
  reason?: string
) {
  const isApproved = status === 'APPROVED';
  const statusLabel = isApproved ? 'Aprovado' : status === 'REJECTED' ? 'Reprovado' : 'Suspenso';
  const color = isApproved ? '#22C55E' : '#EF4444';

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid ${color}; border-radius: 12px; background: #0F172A; color: #F8FAFC;">
      <h1 style="color: ${color}; margin-bottom: 8px;">Status da sua conta: ${statusLabel}</h1>
      <p style="font-size: 16px; color: #94A3B8;">Olá, ${name}.</p>
      <div style="background: #1E293B; padding: 16px; border-radius: 8px; margin: 20px 0;">
        ${
          isApproved
            ? '<p style="color: #22C55E; margin: 0; font-weight: bold;">Parabéns! Sua conta de motorista foi aprovada.</p><p style="color: #F8FAFC; margin-top: 8px;">Você já pode acessar o painel e ficar ONLINE para receber corridas.</p>'
            : `<p style="color: #EF4444; margin: 0; font-weight: bold;">Sua solicitação foi ${statusLabel.toLowerCase()}.</p>${reason ? `<p style="color: #F8FAFC; margin-top: 8px;"><strong>Motivo:</strong> ${reason}</p>` : ''}`
        }
      </div>
      <p style="color: #64748B; font-size: 12px;">Equipe VaiCar — Suporte ao Motorista</p>
    </div>
  `;

  return sendTransactionalEmail({
    to,
    subject: `Atualização de Cadastro VaiCar: ${statusLabel}`,
    template: 'DRIVER_STATUS_UPDATE',
    html,
  });
}

export async function sendDocumentsRequestedEmail(
  to: string,
  name: string,
  requestedDocs: string,
  instructions?: string
) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #F59E0B; border-radius: 12px; background: #0F172A; color: #F8FAFC;">
      <h1 style="color: #F59E0B; margin-bottom: 8px;">Ação Necessária: Envio de Documentos</h1>
      <p style="font-size: 16px; color: #94A3B8;">Olá, ${name}.</p>
      <div style="background: #1E293B; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
        <p style="color: #FACC15; margin: 0; font-weight: bold;">Documentos solicitados pela administração VaiCar:</p>
        <p style="color: #F8FAFC; margin-top: 8px; font-size: 14px; white-space: pre-wrap;">${requestedDocs}</p>
        ${instructions ? `<p style="color: #94A3B8; font-size: 12px; margin-top: 10px;"><strong>Observação:</strong> ${instructions}</p>` : ''}
      </div>
      <p style="color: #CBD5E1; font-size: 13px;">Para a segurança da comunidade de São Sebastião, analisamos cuidadosamente fotos da CNH, CRLV do veículo e Atestado de Antecedentes Criminais.</p>
      <p style="color: #64748B; font-size: 11px; margin-top: 16px;">Acesse seu painel no VaiCar para enviar os arquivos solicitados.</p>
    </div>
  `;

  return sendTransactionalEmail({
    to,
    subject: 'Ação Necessária: Envio de Documentos — VaiCar São Sebastião',
    template: 'DOCUMENTS_REQUESTED',
    html,
  });
}

export async function sendRideReceiptEmail(to: string, receipt: Receipt) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #16A34A; border-radius: 12px; background: #0F172A; color: #F8FAFC;">
      <h1 style="color: #22C55E; margin-bottom: 4px;">Recibo da Corrida VaiCar</h1>
      <p style="color: #94A3B8; font-size: 14px; margin-top: 0;">Recibo nº: <strong>${receipt.receiptNumber}</strong></p>

      <div style="background: #1E293B; padding: 18px; border-radius: 8px; margin: 20px 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 18px; font-weight: bold; color: #22C55E;">
          <span>Valor Total:</span>
          <span>R$ ${receipt.fareAmount.toFixed(2)}</span>
        </div>
        <p style="margin: 4px 0; color: #CBD5E1;"><strong>Data/Hora:</strong> ${new Date(receipt.dateTime).toLocaleString('pt-BR')}</p>
        <p style="margin: 4px 0; color: #CBD5E1;"><strong>Passageiro:</strong> ${receipt.passengerName}</p>
        <p style="margin: 4px 0; color: #CBD5E1;"><strong>Motorista:</strong> ${receipt.driverName}</p>
        <p style="margin: 4px 0; color: #CBD5E1;"><strong>Veículo:</strong> ${receipt.vehicleDescription} (${receipt.vehiclePlate})</p>
        <p style="margin: 4px 0; color: #CBD5E1;"><strong>Forma de Pagamento:</strong> ${receipt.paymentMethod} (${receipt.paymentStatus})</p>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 12px 0;" />
        <p style="margin: 4px 0; color: #94A3B8; font-size: 13px;"><strong>Origem:</strong> ${receipt.originAddress}</p>
        <p style="margin: 4px 0; color: #94A3B8; font-size: 13px;"><strong>Destino:</strong> ${receipt.destinationAddress}</p>
        <p style="margin: 4px 0; color: #94A3B8; font-size: 13px;"><strong>Distância:</strong> ${receipt.distanceKm.toFixed(1)} km | <strong>Duração:</strong> ${receipt.durationMinutes} min</p>
      </div>

      <p style="color: #64748B; font-size: 12px;">VaiCar — Mobilidade Justa e Confiável em São Sebastião.</p>
    </div>
  `;

  return sendTransactionalEmail({
    to,
    subject: `Recibo de Corrida VaiCar — R$ ${receipt.fareAmount.toFixed(2)}`,
    template: 'RIDE_RECEIPT',
    html,
  });
}
