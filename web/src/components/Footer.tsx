import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, ShieldCheck, Heart } from 'lucide-react';
import { zones } from '../../../shared/src/tokens.js';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand & Market */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src="/vaicar_logo.png" alt="VaiCar" className="h-8 w-auto rounded object-contain" />
              <span className="text-xl font-black text-white">
                VAI<span className="text-emerald-500">CAR</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              O marketplace local oficial de mobilidade urbana e entregas em São Sebastião, Litoral Norte de São Paulo.
              Conectando passageiros e condutores parceiros com tarifas justas, taxas reduzidas e pagamento direto.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Regulamentado pela Lei Federal nº 13.640/2018 (Art. 11-A)</span>
            </div>
          </div>

          {/* Zones */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Regiões Atendidas
            </h4>
            <div className="grid grid-cols-1 gap-1 text-xs">
              {zones.slice(0, 6).map((z) => (
                <span key={z} className="text-slate-400 hover:text-emerald-400 transition-colors">
                  • {z}
                </span>
              ))}
              <span className="text-emerald-400 font-medium">E todo o Litoral Norte SP</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
              Portais da Plataforma
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/passenger" className="hover:text-emerald-400 transition-colors">
                  Área do Passageiro (Pedir Corrida)
                </Link>
              </li>
              <li>
                <Link to="/passenger/register" className="hover:text-emerald-400 transition-colors">
                  Cadastro de Passageiro
                </Link>
              </li>
              <li>
                <Link to="/driver" className="hover:text-emerald-400 transition-colors">
                  Portal do Motorista & Entregador
                </Link>
              </li>
              <li>
                <Link to="/driver/register" className="hover:text-emerald-400 transition-colors">
                  Cadastro de Motorista ou Entregador (Planos Justos)
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-emerald-400 transition-colors">
                  Termos de Uso e Legislação
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-emerald-400 transition-colors">
                  Política de Privacidade (LGPD)
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-emerald-400 transition-colors">
                  Painel de Gestão Administrativa
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-500" /> Atendimento & Plantão
            </h4>
            <p className="text-xs text-slate-400 mb-2">
              Dúvidas, suporte da comunidade ou atendimento em São Sebastião:
            </p>
            <div className="p-3 rounded-lg bg-slate-900 border border-emerald-500/30 text-xs">
              <span className="text-slate-400 block text-[11px]">Canal Oficial WhatsApp:</span>
              <a
                href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-bold text-sm hover:underline inline-flex items-center gap-1.5 mt-1"
              >
                <span>Entrar no Grupo Oficial</span>
                <span className="text-xs">↗</span>
              </a>
              <span className="text-[10px] text-slate-500 block mt-1">Grupo de motoristas, entregadores e passageiros</span>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            <span>© {new Date().getFullYear()} VaiCar — Tecnologia de Mobilidade Local.</span>
            <Link to="/terms" className="hover:text-slate-300 underline">
              Termos de Uso
            </Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-slate-300 underline">
              Privacidade (LGPD)
            </Link>
          </div>
          <p className="text-slate-500 flex items-center gap-1">
            Feito com <Heart className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500 inline" /> para São Sebastião - SP
          </p>
        </div>
      </div>
    </footer>
  );
};
