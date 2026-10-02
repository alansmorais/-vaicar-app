import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Car, Bike, ShieldCheck, MapPin, ArrowRight, Zap, CheckCircle2, DollarSign, Clock, Users, MessageCircle } from 'lucide-react';
import { ridesApi } from '../api/rides.js';
import { mapsApi, KnownLocation } from '../api/maps.js';
import { driversApi, PublicDriverMarker } from '../api/drivers.js';

export const HomePage: React.FC = () => {
  const [popularPlaces, setPopularPlaces] = useState<KnownLocation[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<PublicDriverMarker[]>([]);
  const [originIndex, setOriginIndex] = useState<number>(0);
  const [destinationIndex, setDestinationIndex] = useState<number>(4); // Maresias
  const [estimate, setEstimate] = useState<{ fareAmount: number; distanceKm: number; durationMinutes: number } | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  useEffect(() => {
    mapsApi.getPopularPlaces().then((places) => {
      setPopularPlaces(places);
    }).catch(console.error);

    driversApi.getOnlineDrivers().then((drivers) => {
      setOnlineDrivers(drivers);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (popularPlaces.length >= 2 && popularPlaces[originIndex] && popularPlaces[destinationIndex]) {
      setLoadingEstimate(true);
      const origin = popularPlaces[originIndex];
      const destination = popularPlaces[destinationIndex];
      ridesApi.estimate({
        origin: { address: origin.address, lat: origin.lat, lng: origin.lng },
        destination: { address: destination.address, lat: destination.lat, lng: destination.lng },
      })
        .then((res) => setEstimate(res))
        .catch(console.error)
        .finally(() => setLoadingEstimate(false));
    }
  }, [originIndex, destinationIndex, popularPlaces]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:py-24 border-b border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(22,163,74,0.15),rgba(255,255,255,0))] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Transporte 100% Local • São Sebastião - SP
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
                Mobilidade justa e entregas com <span className="text-emerald-500 underline decoration-emerald-500/40">pagamento direto</span> em São Sebastião.
              </h1>

              <p className="text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Corridas e entregas locais (carro, moto e bicicleta). 
                Motoristas escolhem entre <strong>R$ 100/mês</strong> ou <strong>10% semanal</strong>. 
                Passageiros verificados com antecedentes criminais ganham <strong>5% de desconto</strong>. 
                Pagamento direto ao condutor via Pix ou dinheiro.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <Link
                  to="/passenger"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-950/60 transition-all hover:scale-105 flex items-center justify-center gap-2"
                >
                  <Car className="w-5 h-5" />
                  Pedir Corrida Agora
                </Link>
                <Link
                  to="/driver/register"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 font-bold text-base transition-all hover:scale-105 flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Quero Dirigir ou Fazer Entregas
                </Link>
              </div>

              {/* Key Highlights */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 max-w-lg mx-auto lg:mx-0 text-left">
                <div>
                  <span className="block text-2xl font-black text-emerald-400">5% OFF</span>
                  <span className="text-xs text-slate-400 font-medium">Passageiro verificado</span>
                </div>
                <div>
                  <span className="block text-2xl font-black text-emerald-400">R$ 100/mês</span>
                  <span className="text-xs text-slate-400 font-medium">Ou 10% por corrida</span>
                </div>
                <div>
                  <span className="block text-2xl font-black text-emerald-400">100% Direto</span>
                  <span className="text-xs text-slate-400 font-medium">Pix ou dinheiro</span>
                </div>
              </div>
            </div>

            {/* Right Simulator Card */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400" /> Simulador de Tarifa Local
                  </h3>
                  <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                    Tarifa Oficial 2026
                  </span>
                </div>

                {/* Origin selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Ponto de Partida
                  </label>
                  <select
                    value={originIndex}
                    onChange={(e) => setOriginIndex(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    {popularPlaces.map((p, idx) => (
                      <option key={p.name} value={idx}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" /> Ponto de Destino
                  </label>
                  <select
                    value={destinationIndex}
                    onChange={(e) => setDestinationIndex(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    {popularPlaces.map((p, idx) => (
                      <option key={p.name} value={idx}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Result box */}
                {estimate && (
                  <div className="bg-slate-950 rounded-xl p-4 border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Estimativa Regulamentada:</span>
                      <span className="text-3xl font-black text-emerald-400">
                        {loadingEstimate ? 'Calculando...' : `R$ ${estimate.fareAmount.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="text-right text-xs text-slate-400 space-y-0.5">
                      <div className="flex items-center gap-1 justify-end text-slate-300 font-medium">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" /> ~{estimate.durationMinutes} min
                      </div>
                      <div>{estimate.distanceKm.toFixed(1)} km aproximados</div>
                    </div>
                  </div>
                )}

                <Link
                  to="/passenger"
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
                >
                  Confirmar e Solicitar <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Pillars */}
      <section className="py-16 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Por que escolher o VaiCar em São Sebastião?
            </h2>
            <p className="mt-2 text-slate-400 text-sm">
              Desenvolvido exclusivamente para a geografia e as necessidades da nossa cidade litorânea.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Segurança & 5% de Desconto</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Atestado de antecedentes criminais obrigatório para todos os condutores. Passageiros cadastrados que enviam seus antecedentes ganham <strong>5% de desconto automático</strong> em todas as viagens!
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Pagamento Direto & Planos Justos</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                O passageiro paga diretamente ao motorista via Pix ou dinheiro. Motoristas e entregadores escolhem entre <strong>Mensalidade de R$ 100/mês</strong> ou <strong>10% por corrida com acerto semanal</strong>.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Canal Oficial no WhatsApp</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Entre no nosso grupo oficial no WhatsApp para suporte ágil, atualizações sobre a balsa, trânsito na SP-055 e contato direto com a equipe.
              </p>
              <a
                href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 pt-1"
              >
                Entrar no Grupo Oficial <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Operating Zones Showcase */}
      <section className="py-16 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Principais Rotas & Praias Cobertas</h2>
              <p className="text-xs text-slate-400">De Boracéia a Enseada, você conta com o VaiCar em todos os cantos do município.</p>
            </div>
            <Link
              to="/passenger"
              className="text-emerald-400 hover:text-emerald-300 font-semibold text-xs flex items-center gap-1"
            >
              Ver todas as praias no mapa <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { name: 'Centro Histórico', desc: 'Balsa & Rodoviária' },
              { name: 'Maresias', desc: 'Entradas 1 a 20' },
              { name: 'Boiçucanga', desc: 'Comércio & Pôr do Sol' },
              { name: 'Barequeçaba', desc: 'Mar Calmo & Família' },
              { name: 'Juquehy', desc: 'Gastronomia & Praia' },
              { name: 'Cambury', desc: 'Sertão & Ondas' },
            ].map((zone) => (
              <div
                key={zone.name}
                className="bg-slate-900 border border-slate-800/80 p-3.5 rounded-xl hover:border-emerald-500/50 transition-all group"
              >
                <div className="text-emerald-400 text-xs font-bold mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-500" /> {zone.name}
                </div>
                <span className="text-[11px] text-slate-400 block">{zone.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Driver & Courier Banner */}
      <section className="py-16 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Oportunidade para Profissionais de São Sebastião
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                Dirija ou Faça Entregas de <span className="text-emerald-400">Carro, Moto ou Bike</span>
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Trabalhe com autonomia total. Entregadores podem se cadastrar inclusive com <strong>bicicleta</strong>. Escolha entre o plano de <strong>R$ 100/mês</strong> ou <strong>10% por corrida semanal</strong>. Receba diretamente no seu Pix ou dinheiro!
              </p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Planos transparentes (R$ 100 ou 10%)</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Carro, Moto ou Bicicleta</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Pagamento 100% direto</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full sm:w-auto shrink-0">
              <Link
                to="/driver/register"
                className="px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all hover:scale-105 text-center"
              >
                Cadastre-se Agora <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/driver/login"
                className="px-8 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors text-center"
              >
                Já sou parceiro • Fazer Login
              </Link>
              <a
                href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors text-center"
              >
                <MessageCircle className="w-4 h-4" /> Canal Oficial WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
