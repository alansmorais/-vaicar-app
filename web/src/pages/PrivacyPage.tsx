import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, Database, CheckCircle2, ArrowLeft, UserCheck, MapPin } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="border-b border-slate-800 pb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 uppercase tracking-wider">
                Proteção de Dados Pessoais
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                LGPD (Lei nº 13.709/2018)
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                Marco Civil da Internet (Lei nº 12.965/2014)
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Política de Privacidade e Proteção de Dados
            </h1>
            <p className="text-sm text-slate-400">
              Diretrizes de transparência, privacidade e segurança para motoristas, entregadores e passageiros em São Sebastião - SP.
              Última atualização: Outubro de 2026.
            </p>
          </div>
        </div>

        {/* Commitment Banner */}
        <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-300">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Compromisso com a sua Privacidade e com a LGPD</span>
          </div>
          <p className="leading-relaxed text-emerald-100/90">
            A <strong>VaiCar</strong> trata a privacidade como um pilar essencial da nossa comunidade.
            Coletamos apenas os dados estritamente necessários para permitir a conexão segura e eficiente entre passageiros e condutores parceiros autônomos.
            <strong> Nunca vendemos seus dados para anunciantes ou terceiros.</strong>
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <Database className="w-5 h-5 text-emerald-400" />
              <h2>1. Dados Coletados e Base Legal</h2>
            </div>
            <p>
              Para o regular funcionamento da plataforma e cumprimento das obrigações impostas pela legislação federal (Lei 13.640/2018), coletamos:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong>Passageiros:</strong> Nome completo, endereço de e-mail, número de WhatsApp/telefone internacional verificado, foto de perfil facial nítida (para identificação no embarque) e, opcionalmente, certidão de antecedentes criminais (para obtenção do desconto de 5%).
              </li>
              <li>
                <strong>Motoristas e Entregadores Parceiros:</strong> Nome completo, e-mail, WhatsApp internacional, CPF, foto facial, CNH com anotação "EAR" (para motoristas e motociclistas), dados e documento do veículo (CRLV ou comprovação de bicicleta) e Certidão Negativa de Antecedentes Criminais, em conformidade com o Art. 11-A, inciso IV, da Lei Federal nº 13.640/2018.
              </li>
              <li>
                <strong>Dados de Localização e GPS:</strong> Coletamos coordenadas de geolocalização em tempo real <em>exclusivamente</em> durante o uso ativo da aplicação (quando o motorista está em modo online no mapa ou quando o passageiro solicita ou está em uma corrida ativa), para exibição da rota e estimativa de chegada.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <Eye className="w-5 h-5 text-emerald-400" />
              <h2>2. Finalidade do Tratamento de Dados</h2>
            </div>
            <p>
              Os dados coletados são utilizados estritamente para as seguintes finalidades legítimas:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-slate-300">
              <li>Identificação recíproca entre condutor e passageiro para segurança mútua no momento do embarque.</li>
              <li>Cálculo de estimativas justas de distância, tempo e valores sugeridos de corrida em São Sebastião.</li>
              <li>Envio de comprovantes digitais de corrida via e-mail e canal de suporte.</li>
              <li>Prevenção a fraudes, inadimplências (calotes) e cumprimento de obrigações regulatórias legais.</li>
            </ol>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <Lock className="w-5 h-5 text-emerald-400" />
              <h2>3. Não Compartilhamento e Sigilo</h2>
            </div>
            <p>
              A VaiCar adota uma política rigorosa de sigilo e não comercialização:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong>Com o outro usuário da corrida:</strong> Apenas o nome de exibição, foto de identificação e localização necessária para o trajeto são compartilhados mutuamente entre passageiro e condutor aceito.
              </li>
              <li>
                <strong>Sem venda de dados:</strong> Seus dados pessoais <strong>jamais serão vendidos, alugados ou cedidos a terceiros</strong> para fins de marketing, publicidade ou perfis comerciais externos.
              </li>
              <li>
                <strong>Requisições Judiciais:</strong> Dados e registros de acesso (endereço IP, data e hora) serão fornecidos unicamente mediante ordem judicial formal fundamentada, nos termos dos artigos 10 e 15 do Marco Civil da Internet (Lei nº 12.965/2014).
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <h2>4. Seus Direitos como Titular de Dados (Art. 18 da LGPD)</h2>
            </div>
            <p>
              Você, na qualidade de titular de dados pessoais, tem o direito garantido de solicitar à plataforma a qualquer momento:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>Confirmação da existência de tratamento e acesso aos seus dados cadastrados.</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados via painel do perfil.</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.</li>
              <li>Revogação de consentimento e exclusão definitiva de sua conta e histórico, ressalvadas as obrigações de guarda legal previstas no Marco Civil da Internet.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h2>5. Segurança e Armazenamento</h2>
            </div>
            <p>
              Utilizamos infraestrutura em nuvem de padrão internacional com tráfego criptografado ponta a ponta (TLS/HTTPS), controle restrito de acesso por credenciais autenticadas e proteção contra injeções e vazamentos. Os documentos submetidos para conferência passam por checagem administrativa e permanecem protegidos.
            </p>
          </section>

          {/* Section 6 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <h2>6. Contato e Encarregado de Proteção de Dados (DPO)</h2>
            </div>
            <p>
              Para exercer qualquer direito relativo aos seus dados ou esclarecer dúvidas sobre esta política, utilize o canal de atendimento da comunidade:
            </p>
            <p className="text-emerald-400 font-bold">
              Canal Oficial WhatsApp:{' '}
              <a
                href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-emerald-300"
              >
                Comunidade VaiCar São Sebastião
              </a>
            </p>
          </section>
        </div>

        {/* Footer links */}
        <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} VaiCar Tecnologia e Mobilidade. São Sebastião - SP.</p>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="text-emerald-400 hover:underline">
              Termos de Uso
            </Link>
            <Link to="/" className="text-slate-400 hover:text-white">
              Página Principal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
