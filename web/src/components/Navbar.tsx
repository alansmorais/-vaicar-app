import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Car, Bike, User, Shield, LogOut, Menu, X, MapPin, ArrowRight } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, profile, role, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [loginModalOpen, setLoginModalOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/vaicar_logo.png"
              alt="VaiCar"
              className="h-11 w-auto rounded-lg object-contain transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-2xl font-extrabold tracking-tight text-white flex items-center">
                VAI<span className="text-emerald-500">CAR</span>
              </span>
              <span className="text-[10px] font-medium text-emerald-400 tracking-wider flex items-center gap-1 uppercase">
                <MapPin className="w-2.5 h-2.5" /> São Sebastião • SP
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/') ? 'text-emerald-400 bg-slate-900' : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              Início
            </Link>
            <Link
              to="/passenger"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                location.pathname.startsWith('/passenger')
                  ? 'text-emerald-400 bg-slate-900'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              Passageiro
            </Link>
            <Link
              to="/driver"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                location.pathname.startsWith('/driver')
                  ? 'text-emerald-400 bg-slate-900'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              Motorista & Entregador
            </Link>
            <Link
              to="/admin"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                location.pathname.startsWith('/admin')
                  ? 'text-emerald-400 bg-slate-900'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              Painel Admin
            </Link>
            <a
              href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-slate-900/60 transition-colors flex items-center gap-1 border border-emerald-500/20"
            >
              <span>Grupo WhatsApp</span>
              <span className="text-[10px]">↗</span>
            </a>
          </div>

          {/* User Auth Info / Actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
                <div className="flex items-center gap-2">
                  {profile?.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt={profile.displayName}
                      className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-white max-w-[120px] truncate">
                      {profile?.displayName || user.email?.split('@')[0]}
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 w-fit">
                      {role === 'admin' || isAdmin ? 'Administrador' : role === 'driver' ? 'Motorista' : 'Passageiro'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                  title="Sair da conta"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/driver/register"
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Car className="w-3.5 h-3.5" /> Seja Motorista / Entregador
                </Link>
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  className="px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                >
                  Entrar
                </button>
                <Link
                  to="/passenger/register"
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] flex items-center gap-1.5"
                >
                  Pedir Corrida
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-3 pb-6 space-y-3">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-200 hover:bg-slate-800"
          >
            Início
          </Link>
          <Link
            to="/passenger"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-200 hover:bg-slate-800"
          >
            Passageiro
          </Link>
          <Link
            to="/driver"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-200 hover:bg-slate-800"
          >
            Motorista & Entregador
          </Link>
          <Link
            to="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-200 hover:bg-slate-800"
          >
            Painel Admin
          </Link>
          <a
            href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-bold text-emerald-400 hover:bg-slate-800"
          >
            Grupo Oficial WhatsApp ↗
          </a>

          {user ? (
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-semibold text-slate-200">
                  {profile?.displayName || user.email}
                </span>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="text-sm text-rose-400 font-semibold px-3 py-1.5 rounded bg-slate-800"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLoginModalOpen(true);
                  }}
                  className="text-center py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-emerald-400 border border-emerald-500/30"
                >
                  Entrar
                </button>
                <Link
                  to="/passenger/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 px-3 rounded-lg bg-slate-700 text-sm font-semibold text-slate-200"
                >
                  Pedir Corrida
                </Link>
              </div>
              <Link
                to="/driver/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-md shadow-emerald-950/40"
              >
                Cadastre-se como Motorista ou Entregador
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Role Selection Modal on Entrar */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setLoginModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1.5 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Acesso à Plataforma
              </span>
              <h3 className="text-xl font-bold text-white">Como você deseja entrar?</h3>
              <p className="text-xs text-slate-400">
                Selecione o seu perfil para acessar o painel correspondente:
              </p>
            </div>

            <div className="space-y-3">
              {/* Option 1: Passageiro */}
              <Link
                to="/passenger/login"
                onClick={() => setLoginModalOpen(false)}
                className="w-full p-4 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/60 flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors block">
                      Entrar como Passageiro
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Solicitar viagens e entregas de encomendas
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </Link>

              {/* Option 2: Motorista */}
              <Link
                to="/driver/login"
                onClick={() => setLoginModalOpen(false)}
                className="w-full p-4 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/60 flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <Car className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors block">
                      Entrar como Motorista
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Conduzir carro ou moto (R$ 100/mês ou 10%)
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </Link>

              {/* Option 3: Entregador */}
              <Link
                to="/driver/login?role=courier"
                onClick={() => setLoginModalOpen(false)}
                className="w-full p-4 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/60 flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors block">
                      Entrar como Entregador
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Delivery com bike (sem CNH) ou moto
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </Link>
            </div>

            <div className="pt-2 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-400">
                💡 <strong>Conta Unificada:</strong> Você pode usar o mesmo e-mail e telefone para os 3 perfis!
              </p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
