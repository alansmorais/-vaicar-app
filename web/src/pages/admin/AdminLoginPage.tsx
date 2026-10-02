import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { Shield, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginEmailPassword, devLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginEmailPassword(email.trim(), password);
      navigate('/admin');
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError(err.message || 'Credenciais de administrador inválidas.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAdminLogin = async () => {
    setLoading(true);
    try {
      await devLogin('test-admin-01', 'admin@vaicar.app', 'admin', 'Administrador Chefe');
      navigate('/admin');
    } catch (err: any) {
      setError(err.message);
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
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-2xl font-black text-white">Painel Administrativo</h2>
          </div>
          <p className="text-xs text-slate-400">
            Acesso restrito para gestão de motoristas, corridas e configurações do VaiCar.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/60 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Institucional</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vaicar.app"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha administrativa"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
          >
            {loading ? 'Validando acesso...' : 'Acessar Central de Gestão'}{' '}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleTestAdminLogin}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-emerald-500/30 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Shield className="w-4 h-4" /> Acesso Rápido de Teste (Admin Geral)
          </button>
        </div>
      </div>
    </div>
  );
};
