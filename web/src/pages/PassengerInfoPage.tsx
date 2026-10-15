import React from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  ShieldCheck,
  Percent,
  Gift,
  DollarSign,
  MapPin,
  Clock,
  ArrowRight,
  Download,
  CheckCircle2,
  Lock,
  Smartphone,
  Sparkles,
} from 'lucide-react';

export const PassengerInfoPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Centralized sub-header banner */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 py-2.5 px-4 text-center">
        <p className="text-xs sm:text-sm font-medium text-slate-300 max-w-4xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
          <span>
            Mobilidade segura em São Sebastião: <strong className="text-emerald-400">5% OFF para passageiros verificados</strong> + <span className="text-emerald-400 font-semibold">R$ 5,00 na 1ª corrida</span> com indicação!
          </span>
        </p>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:py-20 border-b border-slate-900 bg-slate-950">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/sao-sebastiao/service-passenger-pauba.jpg"
            alt="Praia de Paúba em São Sebastião"
            className="w-full h-full object-cover object-center opacity-25 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/80" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold backdrop-blur-sm">
              <Car className="w-3.5 h-3.5" />
              <span>Guia do Passageiro VaiCar • São Sebastião - SP</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Viagens Seguras, Preço Justo e <span className="text-emerald-400">Descontos Reais</span>.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Descubra como solicitar corridas em São Sebastião de forma simples pelo navegador ou pelo aplicativo nativo Android. Conheça as vantagens exclusivas: 5% de desconto contínuo para passageiros verificados e R$ 5,00 de desconto na sua primeira corrida via código de indicação.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/passenger"
                className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all flex items-center gap-2"
              >
                <Car className="w-4 h-4" />
                <span>Pedir Corrida Agora</span>
              </Link>
              <Link
                to="/passenger/register"
                className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Criar Conta com Desconto</span>
              </Link>
              <Link
                to="/download/passenger"
                className="px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Baixar APK</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Core Advantages */}
      <section className="py-16 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30">
              Economia e Segurança
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Por que viajar de VaiCar em São Sebastião?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Um modelo transparente feito sob medida para o Litoral Norte.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. 5% de Desconto VIP */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Percent className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    Benefício Contínuo
                  </span>
                  <h3 className="text-lg font-bold text-white">5% de Desconto em Todas as Viagens</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Para estimular uma comunidade 100% segura, o passageiro que valida sua certidão de antecedentes criminais ganha <strong>5% de desconto automático</strong> em todas as viagens solicitadas.
                </p>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <strong className="text-white block">Como obter:</strong>
                  <span>Emita seu atestado grátis no site da Polícia Civil ou Federal e anexe na criação da conta ou no seu perfil.</span>
                </div>
              </div>

              <Link
                to="/passenger/register"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                Cadastrar com Antecedentes →
              </Link>
            </div>

            {/* 2. Programa Indique e Ganhe */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Gift className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    R$ 5 Amigo + R$ 5 Você
                  </span>
                  <h3 className="text-lg font-bold text-white">Programa de Indicação VaiCar</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Cada passageiro cadastrado possui um código de indicação único. Compartilhe com amigos, familiares e hóspedes de São Sebastião!
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Seu amigo recebe <strong>R$ 5,00 OFF</strong> na primeira corrida.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Você recebe <strong>R$ 5,00 em créditos</strong> na sua carteira após a corrida dele ser concluída.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>O motorista parceiro recebe 100% do valor integral (subsídio custeado pela VaiCar).</span>
                  </li>
                </ul>
              </div>

              <Link
                to="/passenger"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                Pegar meu Código de Indicação →
              </Link>
            </div>

            {/* 3. Pagamento 100% Direto */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-emerald-400">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Transparência Total
                  </span>
                  <h3 className="text-lg font-bold text-white">Pagamento Direto via Pix ou Dinheiro</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Chega de surpresas no cartão de crédito. Ao final de cada corrida, você realiza o pagamento diretamente para a chave Pix ou em dinheiro ao motorista.
                </p>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between text-white font-medium">
                    <span>Bandeirada Base:</span>
                    <span>R$ 10,00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quilômetro rodado:</span>
                    <span>R$ 1,00 / km</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tempo de viagem:</span>
                    <span>R$ 0,25 / min</span>
                  </div>
                </div>
              </div>

              <Link
                to="/#simulador"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                Simular Tarifa no Mapa →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Step by Step Walkthrough */}
      <section className="py-16 bg-slate-900/50 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30">
              Passo a Passo
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Como pedir sua corrida no VaiCar
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Sem burocracia, direto no seu smartphone ou computador.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                1
              </span>
              <h3 className="text-base font-bold text-white">Acesse o Portal ou App</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Entre pelo navegador ou abra o APK nativo no seu Android. Faça login com seu e-mail e senha.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                2
              </span>
              <h3 className="text-base font-bold text-white">Escolha Partida e Destino</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Digite o endereço ou selecione diretamente no mapa interativo de São Sebastião.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                3
              </span>
              <h3 className="text-base font-bold text-white">Confira o Preço e Descontos</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Veja o valor exato calculado com os 5% de desconto ou créditos de indicação já aplicados.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                4
              </span>
              <h3 className="text-base font-bold text-white">Acompanhe e Pague Direto</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Acompanhe o motorista em tempo real e pague via Pix ou dinheiro ao chegar ao seu destino.
              </p>
            </div>
          </div>

          <div className="text-center pt-4">
            <Link
              to="/passenger"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all hover:scale-105"
            >
              <Car className="w-4 h-4" />
              <span>Entrar no Painel do Passageiro</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Safety Commitment */}
      <section className="py-16 bg-slate-950 border-b border-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Segurança em Primeiro Lugar</h3>
                <p className="text-xs text-slate-400">Conheça os padrões exigidos para todos os condutores parceiros</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>CNH definitiva com EAR (Exerce Atividade Remunerada) obrigatória.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Checagem documental rigorosa e certidão negativa de antecedentes criminais.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Veículos 4 portas com ar-condicionado e documentação (CRLV) em dia.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Canal direto no WhatsApp para suporte e emergências na cidade.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
