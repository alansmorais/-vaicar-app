import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { authApi } from '../../api/auth.js';
import { Mail, Lock, AlertCircle, ArrowRight, Car, Bike, KeyRound, CheckCircle2 } from 'lucide-react';

export const DriverLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isCourier = searchParams.get('role') === 'courier';
  const { loginEmailPassword, migrateAccount, forgotPassword, resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Migration state for existing drivers without Firebase Auth credentials
  const [showMigration, setShowMigration] = useState(false);
  const [pin, setPin] = useState('');
  const [pinSent, setPinSent] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  // Password reset state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPin, setForgotPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotPinSent, setForgotPinSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      await loginEmailPassword(normalizedEmail, password);
      navigate('/driver');
    } catch (err: any) {
      console.warn('Driver login notice:', err);

      // Check if this is an existing driver in Firestore needing PIN migration
      try {
        const check = await authApi.checkAccount(normalizedEmail);
        if (check.needsMigration) {
          setShowMigration(true);
          setShowForgotPassword(false);
          setInfo(`Cadastro existente identificado para ${check.name || 'este motorista'}! Para sua segurança, envie o código PIN para confirmar o e-mail e ativar sua senha.`);
          setLoading(false);
          return;
        }
      } catch (checkErr) {
        console.warn('Account check notice:', checkErr);
      }

      setError(err?.message || 'E-mail ou senha incorretos.');
      setLoading(false);
    }
  };

  const handleRequestPin = async () => {
    setPinLoading(true);
    setError(null);
    try {
      const res = await authApi.requestPin(email.trim().toLowerCase(), 'driver');
      setPinSent(true);
      setInfo(res.message || 'Código PIN de 6 dígitos enviado para seu e-mail cadastrado.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar o código PIN. Aguarde alguns instantes.');
    } finally {
      setPinLoading(false);
    }
  };

  const handleMigrate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || pin.trim().length !== 6) {
      setError('Informe o código PIN de 6 dígitos recebido por e-mail.');
      return;
    }
    if (!password || password.length < 6) {
      setError('A senha de acesso deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await migrateAccount(email.trim().toLowerCase(), pin.trim(), password);
      navigate('/driver');
    } catch (err: any) {
      setError(err?.message || 'Falha ao validar PIN ou ativar acesso. Verifique o código e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestForgotPin = async () => {
    if (!email.trim()) {
      setError('Informe seu e-mail cadastrado para receber o PIN de recuperação.');
      return;
    }
    setForgotLoading(true);
    setError(null);
    try {
      const res = await forgotPassword(email.trim().toLowerCase());
      setForgotPinSent(true);
      setInfo(res.message || 'Código PIN de recuperação enviado para seu e-mail.');
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

    setLoading(true);
    setError(null);
    try {
      await resetPassword(email.trim().toLowerCase(), forgotPin.trim(), newPassword);
      setInfo('Senha redefinida com sucesso! Acessando seu cockpit...');
      await loginEmailPassword(email.trim().toLowerCase(), newPassword);
      navigate('/driver');
    } catch (err: any) {
      setError(err?.message || 'Falha ao redefinir senha. Verifique o código PIN e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            <img src="/vaicar_logo.png" alt="VaiCar" className="h-10 mx-auto rounded object-contain" />
          </Link>
          <div className="flex items-center justify-center gap-2">
            {isCourier ? (
              <span className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400">
                <Bike className="w-5 h-5" />
              </span>
            ) : (
              <span className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                <Car className="w-5 h-5" />
              </span>
            )}
            <h2 className="text-2xl font-black text-white">
              {isCourier ? 'Login do Entregador' : 'Login do Motorista'}
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            {isCourier
              ? 'Acesse seu cockpit para gerenciar entregas rápidas de bicicleta ou motocicleta.'
              : 'Acesse seu cockpit para gerenciar disponibilidade e receber chamadas de corridas.'}
          </p>
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

        {!showMigration && !showForgotPassword ? (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">Senha</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Esqueceu sua senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
            >
              {loading ? 'Validando credenciais...' : 'Acessar Cockpit'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : showForgotPassword ? (
          <div className="space-y-4 border border-emerald-500/30 rounded-xl p-4 bg-slate-950">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" /> Recuperação de Senha
              </h3>
              <p className="text-[11px] text-slate-400">
                Informe seu e-mail de motorista para receber um código PIN de recuperação via Gmail.
              </p>
            </div>

            {!forgotPinSent ? (
              <div className="space-y-3">
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
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRequestForgotPin}
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
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
                    className="py-2.5 px-3 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Código PIN (6 dígitos)</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={forgotPin}
                    onChange={(e) => setForgotPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-lg tracking-widest text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nova Senha</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 dígitos"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? 'Redefinindo...' : 'Confirmar e Entrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPinSent(false);
                      setError(null);
                      setInfo(null);
                    }}
                    className="py-2.5 px-3 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleMigrate} className="space-y-4 border border-emerald-500/30 rounded-xl p-4 bg-slate-950">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" /> Ativação de Conta Existente
              </h3>
              <p className="text-[11px] text-slate-400">
                Confirmando que você é o titular de <strong>{email}</strong>, seu perfil e histórico de aprovação serão vinculados com segurança.
              </p>
            </div>

            {!pinSent ? (
              <button
                type="button"
                onClick={handleRequestPin}
                disabled={pinLoading}
                className="w-full py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                {pinLoading ? 'Enviando PIN...' : 'Enviar Código PIN por E-mail'}
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Código PIN (6 dígitos)</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-lg tracking-widest text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Sua Senha de Acesso</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nova senha (mínimo 6 dígitos)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? 'Ativando...' : 'Confirmar e Entrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMigration(false)}
                    className="py-2.5 px-3 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div className="text-center text-xs text-slate-400">
            Ainda não é parceiro?{' '}
            <Link to="/driver/register" className="text-emerald-400 font-semibold hover:underline">
              Cadastre-se como Motorista ou Entregador (R$ 100/mês ou 10% semanal)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
