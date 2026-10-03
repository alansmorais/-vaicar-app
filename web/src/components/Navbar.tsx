import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Car, Bike, User, Shield, LogOut, Menu, X, MapPin, ArrowRight } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, profile, role, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    if (!loginModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLoginModalOpen(false);
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [loginModalOpen]);

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
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30 transition-colors"
                  title="Trocar de perfil ou entrar como motorista/passageiro"
                >
                  Trocar Perfil
                </button>

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
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-slate-200">
                    {profile?.displayName || user.email}
                  </span>
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  {role === 'admin' || isAdmin ? 'Admin' : role === 'driver' ? 'Motorista' : 'Passageiro'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLoginModalOpen(true);
                  }}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-emerald-400 bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 rounded-lg text-center"
                >
                  Trocar Perfil / Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="py-2 px-3 text-xs font-semibold text-rose-400 bg-slate-800 hover:bg-slate-700 rounded-lg"
                >
                  Sair
                </button>
              </div>
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
      {loginModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200"
            onClick={() => setLoginModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Como você deseja entrar"
          >
            <div
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 relative my-auto animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-2 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  Acesso à Plataforma VaiCar
                </span>
                <h3 className="text-2xl font-black text-white tracking-tight">Como você deseja entrar?</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Selecione o seu perfil para acessar o painel correspondente:
                </p>
              </div>

              <div className="space-y-3">
                {/* Option 1: Passageiro */}
                <Link
                  to="/passenger/login"
                  onClick={() => setLoginModalOpen(false)}
                  className="w-full p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/60 flex items-center justify-between group transition-all shadow-md"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-950/90 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors block">
                        Entrar como Passageiro
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Pedir corridas, acompanhar motoristas e entregas
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                </Link>

                {/* Option 2: Motorista */}
                <Link
                  to="/driver/login"
                  onClick={() => setLoginModalOpen(false)}
                  className="w-full p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/60 flex items-center justify-between group transition-all shadow-md"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-950/90 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
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
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                </Link>

                {/* Option 3: Entregador */}
                <Link
                  to="/driver/login?role=courier"
                  onClick={() => setLoginModalOpen(false)}
                  className="w-full p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/60 flex items-center justify-between group transition-all shadow-md"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-950/90 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors block">
                        Entrar como Entregador
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Delivery de bike (sem CNH) ou moto
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                </Link>
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2 text-center">
                <p className="text-[11px] text-slate-400">
                  💡 <strong>Conta Unificada:</strong> Você pode usar o mesmo e-mail e telefone para os 3 perfis!
                </p>
                <Link
                  to="/login"
                  onClick={() => setLoginModalOpen(false)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  Ver tela completa de login →
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}
    </nav>
  );
};
