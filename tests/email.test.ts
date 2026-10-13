import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendTransactionalEmail,
  sendDriverPinEmail,
  sendPassengerPinEmail,
  sendViaAppsScript,
} from '../api/src/services/email.js';

describe('VaiCar Email Service — Google Apps Script Integration & Security Tests', () => {
  const originalEnv = { ...process.env };
  const mockScriptUrl = 'https://script.google.com/macros/s/AKfyc_MOCK_SECRET_TEST/exec';

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('A, B, C, E: prepares HTTPS POST with text/plain;charset=utf-8, correct payload, and returns SUCCESS on 200', async () => {
    process.env.APPS_SCRIPT_URL = mockScriptUrl;

    let capturedUrl = '';
    let capturedOptions: any = null;

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, options: any) => {
      capturedUrl = url.toString();
      capturedOptions = options;
      return new Response(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await sendTransactionalEmail({
      to: 'motorista@exemplo.com',
      subject: 'Código de Verificação VaiCar',
      template: 'TEST_TEMPLATE',
      text: 'Seu código de acesso é: 123456',
      html: '<div>Seu código de acesso é: 123456</div>',
    });

    expect(res.success).toBe(true);
    expect(res.provider).toBe('apps_script');
    expect(capturedUrl).toBe(mockScriptUrl);
    expect(capturedOptions.method).toBe('POST');
    expect(capturedOptions.headers['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(capturedOptions.redirect).toBe('manual');

    const body = JSON.parse(capturedOptions.body);
    expect(body.to).toBe('motorista@exemplo.com');
    expect(body.subject).toBe('Código de Verificação VaiCar');
    expect(body.text).toBe('Seu código de acesso é: 123456');
    expect(body.html).toContain('123456');
  });

  it('D: sendDriverPinEmail interpolates PIN into expected email body and subject without leaking', async () => {
    process.env.APPS_SCRIPT_URL = mockScriptUrl;

    let capturedBody: any = null;
    vi.spyOn(global, 'fetch').mockImplementation(async (_url: any, options: any) => {
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
    });

    const res = await sendDriverPinEmail('driver.auth@teste.com', '987654');
    expect(res.success).toBe(true);
    expect(capturedBody.to).toBe('driver.auth@teste.com');
    expect(capturedBody.subject).toContain('987654');
    expect(capturedBody.html).toContain('987654');
    expect(capturedBody.text).toBeDefined();
  });

  it('D: sendPassengerPinEmail interpolates PIN into expected email body and subject', async () => {
    process.env.APPS_SCRIPT_URL = mockScriptUrl;

    let capturedBody: any = null;
    vi.spyOn(global, 'fetch').mockImplementation(async (_url: any, options: any) => {
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
    });

    const res = await sendPassengerPinEmail('passenger.auth@teste.com', '543210');
    expect(res.success).toBe(true);
    expect(capturedBody.to).toBe('passenger.auth@teste.com');
    expect(capturedBody.subject).toContain('543210');
    expect(capturedBody.html).toContain('543210');
  });

  it('F: treats Apps Script 302 redirect as verified execution', async () => {
    process.env.APPS_SCRIPT_URL = mockScriptUrl;

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, options: any) => {
      if (options?.method === 'POST') {
        return new Response(null, {
          status: 302,
          headers: {
            Location: 'https://script.googleusercontent.com/macros/echo?status=ok',
          },
        });
      }
      return new Response(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await sendTransactionalEmail({
      to: 'condutor@exemplo.com',
      subject: 'Teste Redirecionamento 302',
      template: 'TEST_302',
      html: '<p>Teste</p>',
    });

    expect(res.success).toBe(true);
    expect(res.provider).toBe('apps_script');
  });

  it('F: reports error if Apps Script 302 echo returns explicit error payload', async () => {
    process.env.APPS_SCRIPT_URL = mockScriptUrl;

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, options: any) => {
      if (options?.method === 'POST') {
        return new Response(null, {
          status: 302,
          headers: {
            Location: 'https://script.googleusercontent.com/macros/echo?status=err',
          },
        });
      }
      return new Response(JSON.stringify({ status: 'error', message: 'Quota do Gmail diária excedida' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await sendTransactionalEmail({
      to: 'condutor@exemplo.com',
      subject: 'Teste Erro Echo',
      template: 'TEST_ERR',
      html: '<p>Teste</p>',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Quota do Gmail diária excedida');
  });

  it('G: returns explicit error when Apps Script HTTP request fails (status 500)', async () => {
    process.env.APPS_SCRIPT_URL = mockScriptUrl;

    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    });

    const res = await sendTransactionalEmail({
      to: 'motorista@exemplo.com',
      subject: 'Teste Falha 500',
      template: 'TEST_FAIL',
      html: '<p>Teste</p>',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('500');
  });

  it('H, I: FAILS CLOSED in production if APPS_SCRIPT_URL is missing (no Ethereal, no jsonTransport)', async () => {
    delete process.env.APPS_SCRIPT_URL;
    process.env.NODE_ENV = 'production';

    const fetchSpy = vi.spyOn(global, 'fetch');

    const res = await sendTransactionalEmail({
      to: 'driver.prod@teste.com',
      subject: 'Tentativa em Produção sem URL',
      template: 'PROD_NO_URL',
      html: '<p>Teste de Produção</p>',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Serviço de e-mail de produção indisponível (APPS_SCRIPT_URL não configurado).');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.previewUrl).toBeUndefined();
  });

  it('preserves attachments mapping with filename, contentType, and contentBase64', async () => {
    let capturedOptions: any = null;
    vi.spyOn(global, 'fetch').mockImplementation(async (_url: any, options: any) => {
      capturedOptions = options;
      return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
    });

    const res = await sendViaAppsScript(mockScriptUrl, {
      to: 'recibo@teste.com',
      subject: 'Recibo de Corrida com Anexo',
      template: 'RECEIPT_ATTACH',
      html: '<p>Recibo</p>',
      attachments: [
        {
          filename: 'recibo.pdf',
          contentType: 'application/pdf',
          content: Buffer.from('PDF_DUMMY_CONTENT'),
        },
      ],
    });

    expect(res.success).toBe(true);
    const body = JSON.parse(capturedOptions.body);
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].filename).toBe('recibo.pdf');
    expect(body.attachments[0].contentType).toBe('application/pdf');
    expect(body.attachments[0].contentBase64).toBe(Buffer.from('PDF_DUMMY_CONTENT').toString('base64'));
  });
});
