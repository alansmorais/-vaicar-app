import React, { useState, useRef, useEffect } from 'react';
import { useTheme, ThemePreference } from '../context/ThemeContext.js';
import { Sun, Moon, Laptop, ChevronDown } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'navbar' | 'mobile' | 'footer' | 'icon';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'navbar', className = '' }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dropdownOpen]);

  // Variant 1: Mobile Segmented Control (for Mobile Drawer)
  if (variant === 'mobile') {
    return (
      <div className={`p-1.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex-1 min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
            theme === 'light'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-pressed={theme === 'light'}
          aria-label="Ativar tema claro"
        >
          <Sun className="w-4 h-4 text-amber-400" />
          <span>Claro</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex-1 min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
            theme === 'dark'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-pressed={theme === 'dark'}
          aria-label="Ativar tema escuro"
        >
          <Moon className="w-4 h-4 text-blue-300" />
          <span>Escuro</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex-1 min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
            theme === 'system'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-pressed={theme === 'system'}
          aria-label="Seguir tema do sistema"
        >
          <Laptop className="w-4 h-4 text-emerald-400" />
          <span>Auto</span>
        </button>
      </div>
    );
  }

  // Variant 2: Footer Theme Selector
  if (variant === 'footer') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-slate-400 font-medium">Tema:</span>
        <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 items-center gap-1">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-xs transition-colors ${
              theme === 'light'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tema Claro"
            aria-pressed={theme === 'light'}
            aria-label="Tema Claro"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-xs transition-colors ${
              theme === 'dark'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tema Escuro"
            aria-pressed={theme === 'dark'}
            aria-label="Tema Escuro"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-xs transition-colors ${
              theme === 'system'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Automático (Seguir Sistema)"
            aria-pressed={theme === 'system'}
            aria-label="Automático (Seguir Sistema)"
          >
            <Laptop className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Variant 3: Icon-only quick toggle button (Navbar mobile)
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-sm active:scale-95 ${className}`}
        title={`Tema atual: ${theme === 'system' ? `Automático (${resolvedTheme === 'dark' ? 'Escuro' : 'Claro'})` : theme === 'dark' ? 'Escuro' : 'Claro'}. Clique para alternar.`}
        aria-pressed={resolvedTheme === 'dark'}
        aria-label="Alternar tema claro e escuro"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-200" />
        ) : (
          <Moon className="w-4 h-4 text-blue-600 animate-in spin-in-180 duration-200" />
        )}
      </button>
    );
  }

  // Variant 4: Default Navbar Dropdown Toggle
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="p-2 sm:px-3 sm:py-2 min-h-[40px] rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
        title="Preferência de Tema (Claro / Escuro / Sistema)"
        aria-expanded={dropdownOpen}
        aria-haspopup="true"
        aria-label="Configurar tema visual"
      >
        {theme === 'system' ? (
          <Laptop className="w-4 h-4 text-emerald-500" />
        ) : resolvedTheme === 'dark' ? (
          <Moon className="w-4 h-4 text-blue-400" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" />
        )}
        <span className="hidden lg:inline capitalize">
          {theme === 'system' ? 'Auto' : theme === 'dark' ? 'Escuro' : 'Claro'}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:inline" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-[100] animate-in fade-in-50 zoom-in-95 duration-100" role="menu">
          <button
            type="button"
            role="menuitem"
            aria-pressed={theme === 'light'}
            onClick={() => {
              setTheme('light');
              setDropdownOpen(false);
            }}
            className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
              theme === 'light'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Claro</span>
          </button>

          <button
            type="button"
            role="menuitem"
            aria-pressed={theme === 'dark'}
            onClick={() => {
              setTheme('dark');
              setDropdownOpen(false);
            }}
            className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
              theme === 'dark'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-300" />
            <span>Escuro</span>
          </button>

          <button
            type="button"
            role="menuitem"
            aria-pressed={theme === 'system'}
            onClick={() => {
              setTheme('system');
              setDropdownOpen(false);
            }}
            className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
              theme === 'system'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Sistema</span>
          </button>
        </div>
      )}
    </div>
  );
};
