import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Scale, AlertTriangle, FileText, CheckCircle2, ArrowLeft, Car, Smartphone } from 'lucide-react';

export const TermsPage: React.FC = () => {
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
                Marco Regulatório Federal
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                Lei nº 13.640/2018 (Art. 11-A)
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                Lei nº 12.587/2012
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                Marco Civil da Internet (Lei nº 12.965/2014)
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Termos de Uso e Condições Gerais dos Serviços
            </h1>
            <p className="text-sm text-slate-400">
              Plataforma de Intermediação Tecnológica de Mobilidade Urbana e Entregas Locais em São Sebastião - SP.
              Última atualização: Outubro de 2026.
            </p>
          </div>
        </div>

        {/* Highlight Alert: Platform Limitation */}
        <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs sm:text-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Aviso Fundamental sobre o Papel da Plataforma e Pagamento Direto</span>
          </div>
          <p className="leading-relaxed text-amber-200/90">
            A <strong>VaiCar</strong> é exclusivamente uma <strong>plataforma tecnológica de software (aplicativo intermediador)</strong>.
            A plataforma <strong>não é empresa de transporte</strong>, não possui frota própria, não emprega motoristas ou entregadores,
            e <strong>não recebe nem retém o valor das corridas</strong>. Todo pagamento é realizado{' '}
            <strong>100% diretamente pelo passageiro ao condutor parceiro</strong> (via Pix ou dinheiro).
            A plataforma <strong>não se responsabiliza por sinistros, acidentes de trânsito ou quaisquer danos materiais, corporais ou morais</strong> sofridos por condutores, passageiros ou terceiros.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <Scale className="w-5 h-5 text-emerald-400" />
              <h2>1. Base Legal e Marco Regulatório em São Sebastião - SP</h2>
            </div>
            <p>
              A operação da plataforma VaiCar fundamenta-se nos preceitos constitucionais da livre iniciativa, da valorização do trabalho e nos seguintes diplomas legais vigentes na República Federativa do Brasil:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong>Lei Federal nº 12.587/2012</strong> com a redação introduzida pela <strong>Lei Federal nº 13.640/2018 (Art. 11-A)</strong>,
                que regulamenta o <em>Transporte Remunerado Privado Individual de Passageiros</em> em âmbito nacional, atribuindo competência aos municípios para fiscalização e estabelecendo os requisitos legais de atuação dos motoristas autônomos.
              </li>
              <li>
                <strong>Marco Civil da Internet (Lei Federal nº 12.965/2014)</strong>: A VaiCar qualifica-se juridicamente como provedora de aplicação de internet intermediadora de contatos entre usuários solicitantes e prestadores autônomos.
              </li>
              <li>
                <strong>Código Civil Brasileiro (Lei Federal nº 10.406/2002)</strong>: Regulando as relações de prestação de serviços autônomos e contratos de transporte entre particulares.
              </li>
              <li>
                <strong>Diretrizes Municipais de São Sebastião/SP</strong> relativas ao tráfego urbano, segurança viária e mobilidade entre Costa Sul, Centro e Costa Norte.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <h2>2. Natureza dos Serviços e Relação entre as Partes</h2>
            </div>
            <p>
              A plataforma VaiCar disponibiliza aos usuários ferramentas de software que viabilizam:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-slate-300">
              <li>Estimativa referencial de trajetos, distância, tempo e valores sugeridos de tarifa com base em parâmetros locais.</li>
              <li>Conexão e comunicação direta via geolocalização e canais integrados entre passageiros e motoristas/entregadores autônomos cadastrados.</li>
              <li>Emissão e envio de comprovantes digitais de prestação de serviços para controle das partes.</li>
            </ol>
            <p className="font-semibold text-slate-200">
              Inexistência de Vínculo Empregatício: Os motoristas e entregadores parceiros são profissionais independentes e autônomos.
              Não há qualquer relação de emprego, subordinação jurídica, exclusividade ou dependência econômica entre os condutores parceiros e a VaiCar.
            </p>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h2>3. Pagamento 100% Direto e Planos da Plataforma</h2>
            </div>
            <p>
              Diferente de aplicativos convencionais que retêm porcentagens abusivas e controlam repasses, a VaiCar adota um modelo descentralizado e transparente:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong>Pagamento Direto ao Condutor:</strong> O passageiro efetua o pagamento integral da viagem diretamente ao motorista ou entregador ao final do trajeto, utilizando Pix (chave pessoal do motorista) ou dinheiro em espécie. A plataforma não cobra intermediadores financeiros nem retém percentual do passageiro.
              </li>
              <li>
                <strong>Planos para os Condutores Parceiros:</strong> O condutor escolhe livremente entre a <em>Mensalidade Fixa de R$ 100/mês</em> (com taxa zero por corrida e 100% dos ganhos para si) ou a <em>Taxa de 10% Semanal</em> por corrida completada. A troca de plano pode ser solicitada após 30 dias (mensal) ou após 7 dias (semanal).
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-base sm:text-lg">
              <Shield className="w-5 h-5 text-rose-400" />
              <h2>4. Isenção e Limitação Expressa de Responsabilidade da Plataforma</h2>
            </div>
            <p className="text-slate-200 font-semibold">
              Ao utilizar a plataforma VaiCar, passageiros, motoristas e entregadores concordam expressamente com as seguintes exclusões de responsabilidade:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong>Acidentes e Sinistros Viários:</strong> A plataforma <strong>não responde civil, penal ou administrativamente</strong> por quaisquer acidentes de trânsito, colisões, atropelamentos, lesões corporais, ferimentos ou óbitos ocorridos durante o trajeto.
                É dever exclusivo do condutor possuir veículo com documentação legal, equipamentos de segurança em ordem e seguro de responsabilidade civil ou seguro de Acidentes Pessoais a Passageiros (APP), nos termos da Lei 13.640/2018.
              </li>
              <li>
                <strong>Danos Materiais e Veiculares:</strong> A plataforma <strong>não se responsabiliza por avarias mecânicas</strong>, pneus furados, sinistros, desgastes ou depreciação de veículos, motocicletas ou bicicletas decorrentes da atividade de transporte ou entregas.
              </li>
              <li>
                <strong>Objetos Esquecidos e Encomendas:</strong> A conferência de pertences (mochilas, celulares, carteiras, documentos e mercadorias) é de responsabilidade estrita do passageiro e do condutor no momento do embarque e desembarque. A plataforma não assume qualquer guarda ou dever indenizatório por itens perdidos ou extraviados.
              </li>
              <li>
                <strong>Atos Pessoais e Desentendimentos:</strong> A plataforma não se responsabiliza por ofensas, agressões verbais ou físicas, discussões ou condutas ilícitas praticadas por motoristas ou passageiros. Quaisquer atos que violem o Código Penal devem ser reportados imediatamente às autoridades policiais competentes.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <Car className="w-5 h-5 text-emerald-400" />
              <h2>5. Obrigações do Motorista e do Entregador Parceiro</h2>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>Possuir Carteira Nacional de Habilitação (CNH) válida com a anotação formal "Exerce Atividade Remunerada" (EAR) no caso de veículos motorizados (automóvel e motocicleta).</li>
              <li>Apresentar Certidão Negativa de Antecedentes Criminais válida e atualizada no momento do cadastro e quando solicitada.</li>
              <li>Manter o Certificado de Registro e Licenciamento de Veículo (CRLV) em situação regular e em dia com os órgãos de trânsito.</li>
              <li>Zelar pelas condições mecânicas, freios, pneus e higiene do veículo, bem como disponibilizar cinto de segurança a todos os ocupantes.</li>
              <li>No caso de entregas de bicicleta, zelar pela correta acomodação dos itens e segurança no trânsito litorâneo.</li>
              <li>Tratar passageiros e demais cidadãos de São Sebastião com respeito, civilidade e cordialidade.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h2>6. Obrigações do Passageiro e Tolerância Zero a Inadimplência ("Calote")</h2>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong>Obrigação Inegociável de Pagamento:</strong> O passageiro compromete-se a pagar integralmente a tarifa da corrida diretamente ao condutor parceiro ao final da viagem, utilizando a forma de pagamento selecionada (Pix ou dinheiro).
              </li>
              <li>
                <strong>Sanção por Não Pagamento:</strong> Caso o passageiro deixe de pagar a corrida, o motorista tem o direito de realizar o reporte formal imediato via aplicativo.
                A conta do passageiro inadimplente será <strong>bloqueada de imediato</strong> para a solicitação de novas corridas na plataforma até que a pendência seja integralmente comprovada e quitada com o condutor parceiro.
              </li>
              <li>
                <strong>Desconto de 5% por Verificação de Antecedentes:</strong> Passageiros que optarem livremente por enviar sua Certidão Negativa de Antecedentes Criminais receberão o selo verificado e desconto automático promocional de 5% sobre o valor referencial da corrida.
              </li>
              <li>
                <strong>Conduta no Veículo:</strong> Respeitar o motorista, zelar pela conservação do veículo e usar obrigatoriamente o cinto de segurança durante todo o percurso.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h2>7. Canal de Reportes, Denúncias e Moderação</h2>
            </div>
            <p>
              Tanto motoristas quanto passageiros possuem acesso ao canal interno de avaliação e reporte, além do{' '}
              <a
                href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline font-bold"
              >
                Canal Oficial no WhatsApp da comunidade VaiCar
              </a>
              . A administração da plataforma reserva-se o direito de advertir, suspender temporariamente ou desativar em definitivo contas que violem estes termos, cometam fraudes ou prejudiquem a integridade da comunidade local.
            </p>
          </section>

          {/* Section 8 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
              <Scale className="w-5 h-5 text-emerald-400" />
              <h2>8. Foro de Eleição</h2>
            </div>
            <p>
              Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Para dirimir eventuais dúvidas ou controvérsias oriundas da utilização do software da plataforma, fica eleito o Foro da Comarca de São Sebastião, Estado de São Paulo, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>
        </div>

        {/* Footer links */}
        <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} VaiCar Tecnologia e Mobilidade. São Sebastião - SP.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-emerald-400 hover:underline">
              Política de Privacidade (LGPD)
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

export default TermsPage;
