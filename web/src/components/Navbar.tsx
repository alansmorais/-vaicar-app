import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ThemeToggle } from './ThemeToggle.js';
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
    <nav className="bg-white/95 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 text-slate-100 transition-colors duration-200">
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
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center transition-colors">
                VAI<span className="text-blue-600 dark:text-emerald-400">CAR</span>
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-emerald-400 tracking-wider flex items-center gap-1 uppercase">
                <MapPin className="w-2.5 h-2.5" /> São Sebastião • SP
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                isActive('/')
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200/50 dark:border-slate-700/60 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Início
            </Link>
            <Link
              to="/passenger"
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                location.pathname.startsWith('/passenger') || location.pathname.startsWith('/como-funciona/passageiro')
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200/50 dark:border-slate-700/60 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Passageiro
            </Link>
            <Link
              to="/driver"
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                location.pathname.startsWith('/driver') || location.pathname.startsWith('/como-funciona/motorista')
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200/50 dark:border-slate-700/60 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Motorista & Entregador
            </Link>
            <Link
              to="/parcerias"
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                location.pathname.startsWith('/parcerias') || location.pathname.startsWith('/empresas')
                  ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-slate-800 border border-amber-500/30 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Parcerias
            </Link>
            <Link
              to="/admin"
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                location.pathname.startsWith('/admin')
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Admin
            </Link>
            <a
              href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 border border-emerald-500/20"
            >
              <span>WhatsApp</span>
              <span className="text-[10px]">↗</span>
            </a>
          </div>

          {/* User Auth Info / Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle variant="navbar" />
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
                    <span className="text-xs font-bold text-slate-100 max-w-[120px] truncate">
                      {profile?.displayName || user.email?.split('@')[0]}
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 w-fit">
                      {role === 'admin' || isAdmin ? 'Administrador' : role === 'driver' ? 'Motorista' : 'Passageiro'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 transition-colors"
                  title="Trocar de perfil ou entrar como motorista/passageiro"
                >
                  Trocar Perfil
                </button>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Sair da conta"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/driver/register"
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-all flex items-center gap-1.5"
                >
                  <Car className="w-3.5 h-3.5" /> Seja Motorista
                </Link>
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Entrar
                </button>
                <Link
                  to="/passenger/register"
                  className="px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  Pedir Corrida
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger button & theme icon */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle variant="icon" />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Menu de navegação"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-3 pb-6 space-y-3">
          {/* Appearance selection */}
          <div className="pb-1 border-b border-slate-800/80">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
              Aparência do Site
            </div>
            <ThemeToggle variant="mobile" />
          </div>
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-base font-semibold text-slate-100 hover:bg-slate-800"
          >
            Início
          </Link>

          {/* Passageiro Mobile Group */}
          <div className="space-y-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
            <Link
              to="/passenger"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">🚗 Pedir Corrida (Passageiro)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold">Ativo</span>
            </Link>
            <Link
              to="/como-funciona/passageiro"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              → Como Funciona, 5% OFF e Indique & Ganhe
            </Link>
          </div>

          {/* Motorista & Entregador Mobile Group */}
          <div className="space-y-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
            <Link
              to="/driver"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-bold text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">💼 Portal do Motorista & Entregador</span>
              <span className="text-[10px] text-slate-400">Cockpit</span>
            </Link>
            <Link
              to="/como-funciona/motorista"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              → Requisitos & Planos (R$ 100/mês ou 10%)
            </Link>
            <Link
              to="/driver/register"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              → Cadastro para Carro, Moto e Bike
            </Link>
          </div>

          {/* Parcerias Comerciais Mobile Group */}
          <Link
            to="/parcerias"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50/70 dark:bg-slate-950/80 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm font-bold hover:bg-amber-100/70 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2">🏪 Parcerias para Restaurantes & Pousadas</span>
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Novo</span>
          </Link>

          {/* Downloads Mobile */}
          <Link
            to="/download/passenger"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            📥 Baixar Aplicativos Oficiais (APKs)
          </Link>

          <Link
            to="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ⚙️ Painel de Gestão Administrativa
          </Link>

          <a
            href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-slate-800 text-center"
          >
            💬 Grupo Oficial no WhatsApp ↗
          </a>

          {user ? (
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-100">
                    {profile?.displayName || user.email}
                  </span>
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
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
                  className="flex-1 py-2 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-emerald-500/30 rounded-lg text-center"
                >
                  Trocar Perfil / Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
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
                  className="text-center py-2 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                >
                  Entrar
                </button>
                <Link
                  to="/passenger/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-md shadow-emerald-950/40"
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
            className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setLoginModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Como você deseja entrar"
          >
            <div className="min-h-full flex items-center justify-center p-3 sm:p-4 py-6 sm:py-8">
              <div
                className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 relative animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(false)}
                  className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar modal"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="text-center space-y-1.5 pt-1 pr-6">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Acesso VaiCar
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">Como você deseja entrar?</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
                    Selecione o seu perfil para acessar o painel correspondente:
                  </p>
                </div>

                <div className="space-y-2.5">
                  {/* Option 1: Passageiro */}
                  <Link
                    to="/passenger/login"
                    onClick={() => setLoginModalOpen(false)}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/90 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 flex items-center justify-between group transition-all shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-bold text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors block">
                          Entrar como Passageiro
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
                          Pedir corridas, acompanhar motoristas e entregas
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                  </Link>

                  {/* Option 2: Motorista */}
                  <Link
                    to="/driver/login"
                    onClick={() => setLoginModalOpen(false)}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/90 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 flex items-center justify-between group transition-all shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                        <Car className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-bold text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors block">
                          Entrar como Motorista
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
                          Conduzir carro ou moto (R$ 100/mês ou 10%)
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                  </Link>

                  {/* Option 3: Entregador */}
                  <Link
                    to="/driver/login?role=courier"
                    onClick={() => setLoginModalOpen(false)}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/90 border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 flex items-center justify-between group transition-all shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/90 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-bold text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors block">
                          Entrar como Entregador
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
                          Delivery de bike (sem CNH) ou moto
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                  </Link>
                </div>

                <div className="pt-2 border-t border-slate-800 flex flex-col gap-1.5 text-center">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    💡 <strong>Conta Unificada:</strong> Você pode usar o mesmo e-mail e telefone para os 3 perfis!
                  </p>
                  <Link
                    to="/login"
                    onClick={() => setLoginModalOpen(false)}
                    className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-semibold"
                  >
                    Ver tela completa de login →
                  </Link>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </nav>
  );
};
