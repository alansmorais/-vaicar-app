import React from 'react';
import { Link } from 'react-router-dom';
import { User, Car, Bike, ArrowRight, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="max-w-3xl w-full space-y-8">
        {/* Back Link */}
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="text-center space-y-3">
            <Link to="/" className="inline-block">
              <img src="/vaicar_logo.png" alt="VaiCar" className="h-12 mx-auto rounded-lg object-contain shadow-lg" />
            </Link>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Como você deseja entrar no <span className="text-emerald-500">VaiCar</span>?
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Selecione sua modalidade de acesso. Você pode utilizar o <strong>mesmo e-mail e telefone</strong> para os 3 perfis!
            </p>
          </div>
        </div>

        {/* 3 Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Passageiro */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-xl transition-all hover:scale-[1.02] group">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-emerald-950/50">
                <User className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Portal do Usuário</span>
                <h2 className="text-xl font-bold text-white">Passageiro</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Solicite corridas ou entregas em São Sebastião com pagamento direto ao condutor via Pix ou dinheiro.
                </p>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 5% OFF com verificação
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Acompanhe no mapa
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <Link
                to="/passenger/login"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-colors"
              >
                Entrar como Passageiro <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/passenger/register"
                className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center justify-center transition-colors text-center"
              >
                Criar Conta de Passageiro
              </Link>
            </div>
          </div>

          {/* 2. Motorista */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-xl transition-all hover:scale-[1.02] group">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-emerald-950/50">
                <Car className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Condutor de Carro ou Moto</span>
                <h2 className="text-xl font-bold text-white">Motorista</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Receba chamadas de viagens de passageiros. Escolha entre R$ 100/mês fixo ou 10% por corrida semanal.
                </p>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Planos R$ 100 ou 10%
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Pagamento 100% direto
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <Link
                to="/driver/login"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-colors"
              >
                Entrar como Motorista <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/driver/register?type=car"
                className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center justify-center transition-colors text-center"
              >
                Cadastrar Carro ou Moto
              </Link>
            </div>
          </div>

          {/* 3. Entregador */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-xl transition-all hover:scale-[1.02] group">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-amber-950/50">
                <Bike className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Delivery & Encomendas</span>
                <h2 className="text-xl font-bold text-white">Entregador</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Faça entregas rápidas e delivery com <strong>bicicleta</strong> ou <strong>motocicleta</strong> em São Sebastião.
                </p>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aceita Bicicleta (Sem CNH)
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Delivery na Costa Sul & Centro
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <Link
                to="/driver/login?role=courier"
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-colors"
              >
                Entrar como Entregador <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/driver/register?type=bicycle"
                className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center justify-center transition-colors text-center"
              >
                Cadastrar Bike ou Moto
              </Link>
            </div>
          </div>
        </div>

        {/* Triple Registration Notice */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
          💡 <strong>Conta Unificada:</strong> Você pode se cadastrar como <em>Passageiro</em>, <em>Motorista</em> e <em>Entregador</em> usando o mesmo e-mail e número de telefone internacional/WhatsApp.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
