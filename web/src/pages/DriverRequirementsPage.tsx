import React from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  Bike,
  DollarSign,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Download,
  Users,
  Smartphone,
  Sparkles,
} from 'lucide-react';

export const DriverRequirementsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Sub-header notification */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 py-2.5 px-4 text-center">
        <p className="text-xs sm:text-sm font-medium text-slate-300 max-w-4xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
          <span>
            Trabalhe com autonomia em São Sebastião: <strong className="text-emerald-400">R$ 100/mês ou 10% de comissão</strong> • Pagamento 100% direto no seu Pix!
          </span>
        </p>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:py-20 border-b border-slate-900 bg-slate-950">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/sao-sebastiao/service-driver-road.jpg"
            alt="Rodovia Rio-Santos no litoral de São Sebastião"
            className="w-full h-full object-cover object-center opacity-25 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/80" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold backdrop-blur-sm">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Condutores e Entregadores Parceiros • VaiCar São Sebastião</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Dirija ou Entregue com <span className="text-emerald-400">Dignidade e Lucro Real</span>.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Diga adeus às taxas abusivas dos aplicativos tradicionais. No VaiCar, você escolhe entre planos transparentes, recebe pagamentos 100% diretamente dos passageiros via Pix ou dinheiro e conta com suporte de quem conhece São Sebastião de ponta a ponta.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/driver/register"
                className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all flex items-center gap-2"
              >
                <span>Fazer meu Cadastro</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/download/driver"
                className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Baixar APK do Motorista</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Partnership Plans */}
      <section className="py-16 bg-slate-900/50 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30">
              Transparência Financeira
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Dois Planos Alternativos. Você Escolhe.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Planos não cumulativos projetados para maximizar o seu ganho diário.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plano A: Mensalidade Fixa */}
            <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-7 sm:p-8 space-y-6 shadow-2xl relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-xs font-bold uppercase">
                    Plano Mensalidade
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">Mais Popular</span>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-white">R$ 100</span>
                    <span className="text-xs text-slate-400 font-medium">/ mês</span>
                  </div>
                  <p className="text-xs text-emerald-400 font-bold mt-1">
                    ZERO por cento por corrida. 100% do valor da viagem é seu.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Sem cobrança de comissão percentual por corrida.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Ideal para condutores de tempo integral ou alta temporada.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Pagamento direto do passageiro via Pix ou dinheiro.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Acesso total ao cockpit e mapa de calor.</span>
                  </li>
                </ul>
              </div>

              <Link
                to="/driver/register?plan=monthly_100"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider text-center shadow-md transition-colors"
              >
                Escolher Plano Mensalidade (R$ 100)
              </Link>
            </div>

            {/* Plano B: Comissão 10% */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 sm:p-8 space-y-6 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold uppercase">
                    Plano Comissão
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">Sem Fixo Mensal</span>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-white">10%</span>
                    <span className="text-xs text-slate-400 font-medium">/ corrida</span>
                  </div>
                  <p className="text-xs text-slate-300 font-semibold mt-1">
                    Com acerto semanal transparente. Só paga se rodar.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Sem taxa fixa mensal ou compromisso antecipado.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Ideal para condutores ocasionais ou fins de semana.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Pagamento direto do passageiro via Pix ou dinheiro.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Extrato semanal no cockpit para acerto da comissão.</span>
                  </li>
                </ul>
              </div>

              <Link
                to="/driver/register?plan=weekly_percent_10"
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider text-center border border-slate-700 transition-colors"
              >
                Escolher Plano Comissão (10%)
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Modalities & Requirements Breakdown */}
      <section className="py-16 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30">
              Requisitos de Verificação
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Documentação Necessária por Categoria
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Confira os documentos para aprovação ágil do seu perfil profissional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Modality 1: Carro */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Car className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    Serviço Ativo
                  </span>
                  <h3 className="text-lg font-bold text-white">Motorista de Carro</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Transporte de passageiros por todo o município de São Sebastião (Costa Sul, Centro e Balsa).
                </p>

                <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <strong className="text-white block text-[11px] uppercase tracking-wide">Documentos Obrigatórios:</strong>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>CNH definitiva com observação EAR (Exerce Atividade Remunerada)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>CRLV do veículo em dia (Carro 4 portas com ar-condicionado)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Atestado de Antecedentes Criminais (estadual ou federal)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Comprovante de residência atualizado</span>
                  </div>
                </div>
              </div>

              <Link
                to="/driver/register?type=car"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                Cadastrar Carro →
              </Link>
            </div>

            {/* Modality 2: Moto */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-950 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <span className="text-xl">🏍️</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/30">
                    Entregas & Corridas
                  </span>
                  <h3 className="text-lg font-bold text-white">Entregador de Moto</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Entregas expressas de encomendas, refeições e farmácias pela SP-055 com máxima agilidade.
                </p>

                <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <strong className="text-white block text-[11px] uppercase tracking-wide">Documentos Obrigatórios:</strong>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>CNH categoria A com EAR</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>CRLV da motocicleta regularizado</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Atestado de Antecedentes Criminais</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Baú ou mochila térmica para transporte seguro</span>
                  </div>
                </div>
              </div>

              <Link
                to="/driver/register?type=motorcycle&role=courier"
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                Cadastrar Motocicleta →
              </Link>
            </div>

            {/* Modality 3: Bicicleta */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Bike className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    Custo Zero Combustível
                  </span>
                  <h3 className="text-lg font-bold text-white">Entregador de Bike</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Entregas ecológicas no Centro Histórico, orlas e áreas planas. Sem IPVA, gasolina ou taxas do Detran.
                </p>

                <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <strong className="text-white block text-[11px] uppercase tracking-wide">Documentos Obrigatórios:</strong>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Maior de 18 anos</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Documento de Identidade oficial (RG ou CNH) e CPF</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Atestado de Antecedentes Criminais</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Bicicleta própria revisada e mochila térmica</span>
                  </div>
                </div>
              </div>

              <Link
                to="/driver/register?type=bicycle&role=courier"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                Cadastrar Bicicleta →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Community Callout */}
      <section className="py-16 bg-slate-950 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <h3 className="text-xl font-bold text-white">Dúvidas sobre o cadastro ou documentação?</h3>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            Nossa equipe de suporte local atende condutores parceiros via WhatsApp oficial em São Sebastião.
          </p>
          <div className="pt-2">
            <a
              href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 text-emerald-400 font-bold text-xs transition-colors"
            >
              Falar com o Plantão no WhatsApp →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
