import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Car, User, Shield, LogOut, Menu, X, MapPin } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, profile, role, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

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
              Motorista
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
                  to="/passenger/login"
                  className="px-3.5 py-2 text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  to="/passenger/register"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] flex items-center gap-1.5"
                >
                  <Car className="w-4 h-4" /> Cadastre-se
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
            Motorista
          </Link>
          <Link
            to="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-200 hover:bg-slate-800"
          >
            Painel Admin
          </Link>

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
            <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
              <Link
                to="/passenger/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 px-3 rounded-lg bg-slate-800 text-sm font-semibold text-slate-200"
              >
                Entrar
              </Link>
              <Link
                to="/passenger/register"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 px-3 rounded-lg bg-emerald-600 text-sm font-semibold text-white"
              >
                Cadastre-se
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
