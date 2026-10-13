import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Car, Bike, ArrowRight, ArrowLeft, CheckCircle2, KeyRound, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { forgotPassword, resetPassword, loginEmailPassword } = useAuth();

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [forgotPin, setForgotPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotPinSent, setForgotPinSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleRequestForgotPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Informe seu e-mail cadastrado para receber o PIN de recuperação.');
      return;
    }
    setForgotLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await forgotPassword(email.trim().toLowerCase());
      setForgotPinSent(true);
      setInfo(res?.message || 'Código PIN de recuperação de 6 dígitos enviado para seu e-mail.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível solicitar a recuperação. Verifique o e-mail informado.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPin.trim() || forgotPin.trim().length !== 6) {
      setError('Informe o código PIN de 6 dígitos recebido por e-mail.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não confere.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await resetPassword(email.trim().toLowerCase(), forgotPin.trim(), newPassword);
      setInfo('Senha redefinida com sucesso! Acessando sua conta...');
      await loginEmailPassword(email.trim().toLowerCase(), newPassword);
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Falha ao redefinir senha. Verifique o código PIN e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

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
              {showForgotPassword ? (
                <>Recuperação de <span className="text-emerald-500">Senha</span></>
              ) : (
                <>Como você deseja entrar no <span className="text-emerald-500">VaiCar</span>?</>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              {showForgotPassword
                ? 'Informe seu e-mail cadastrado para redefinir sua senha de acesso via PIN seguro.'
                : 'Selecione sua modalidade de acesso. Você pode utilizar o mesmo e-mail e telefone para os 3 perfis!'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/60 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/60 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{info}</span>
          </div>
        )}

        {showForgotPassword ? (
          /* Password Recovery Card */
          <div className="max-w-md mx-auto bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-400" /> Esqueci Minha Senha
              </h3>
              <p className="text-xs text-slate-400">
                Funciona para <strong>Passageiro</strong>, <strong>Motorista</strong> e <strong>Entregador</strong>.
              </p>
            </div>

            {!forgotPinSent ? (
              <form onSubmit={handleRequestForgotPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Cadastrado</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
                  >
                    {forgotLoading ? 'Enviando...' : 'Enviar PIN por E-mail'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setError(null);
                      setInfo(null);
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Código PIN (6 dígitos)</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={forgotPin}
                    onChange={(e) => setForgotPin(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white tracking-widest text-center font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nova Senha (mínimo 6 caracteres)</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nova senha forte"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Confirmar Nova Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
                  >
                    {loading ? 'Redefinindo...' : 'Salvar Nova Senha'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPinSent(false);
                      setShowForgotPassword(false);
                      setError(null);
                      setInfo(null);
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* 3 Role Selection Cards */
          <>
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

            {/* Bottom Actions: Unified Account Info & Password Recovery Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs shadow-lg">
              <div className="text-slate-400 text-center sm:text-left">
                💡 <strong>Conta Unificada:</strong> Você pode usar o mesmo e-mail para Passageiro, Motorista e Entregador.
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setError(null);
                  setInfo(null);
                }}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-semibold transition-colors border border-slate-700/60"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Esqueceu sua senha?
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
