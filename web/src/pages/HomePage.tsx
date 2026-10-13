import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  Bike,
  ShieldCheck,
  MapPin,
  ArrowRight,
  Zap,
  CheckCircle2,
  DollarSign,
  Clock,
  Users,
  MessageCircle,
  Download,
  Package,
  Smartphone,
  AlertCircle,
  Sparkles,
  Send,
  Check,
} from 'lucide-react';
import { ridesApi } from '../api/rides.js';
import { mapsApi, KnownLocation } from '../api/maps.js';
import { driversApi, PublicDriverMarker } from '../api/drivers.js';
import { MapDisplay } from '../components/MapDisplay.js';
import { deliveriesApi } from '../api/deliveries.js';
import { DeliveryWaitlistRole } from '../../../shared/src/types.js';

interface DestinationCard {
  name: string;
  zone: string;
  label: string;
  image: string;
  alt: string;
  searchKey: string;
}

const DESTINATION_CARDS: DestinationCard[] = [
  {
    name: 'Praia de Maresias',
    zone: 'Costa Sul',
    label: 'Entradas 1 a 20 • Surf & Vida Noturna',
    image: '/images/sao-sebastiao/praia-maresias.jpg',
    alt: 'Vista panorâmica da Praia de Maresias com ondas e areia branca em São Sebastião',
    searchKey: 'Maresias',
  },
  {
    name: 'Praia de Juquehy',
    zone: 'Costa Sul',
    label: 'Gastronomia Nobre & Areia Branca',
    image: '/images/sao-sebastiao/praia-juquehy.jpg',
    alt: 'Orla e faixa de areia da Praia de Juquehy em São Sebastião',
    searchKey: 'Juquehy',
  },
  {
    name: 'Praia de Boiçucanga',
    zone: 'Costa Sul',
    label: 'Polo Comercial & Pôr do Sol no Mar',
    image: '/images/sao-sebastiao/praia-boicucanga.jpg',
    alt: 'Enseada da Praia de Boiçucanga em São Sebastião com morros ao fundo',
    searchKey: 'Boiçucanga',
  },
  {
    name: 'Toque-Toque (Grande & Pequeno)',
    zone: 'Costa Sul',
    label: 'Baía Calma, Ilha & Pôr do Sol',
    image: '/images/sao-sebastiao/praia-toque-toque.jpg',
    alt: 'Baía de águas calmas da Praia de Toque-Toque Grande e ilha ao fundo',
    searchKey: 'Toque-Toque',
  },
  {
    name: 'Camburi & Camburizinho',
    zone: 'Costa Sul',
    label: 'Sertão, Ecoturismo & Ondas',
    image: '/images/sao-sebastiao/praia-camburi.jpg',
    alt: 'Praia de Camburi em São Sebastião com mar aberto e vegetação nativa',
    searchKey: 'Cambury',
  },
  {
    name: 'Praia de Guaecá',
    zone: 'Centro-Sul',
    label: 'Pé na Areia & Vista Frontal para Ilhabela',
    image: '/images/sao-sebastiao/praia-guaeca.jpg',
    alt: 'Praia de Guaecá em São Sebastião com vista panorâmica para o canal e Ilhabela',
    searchKey: 'Guaecá',
  },
  {
    name: 'Centro Histórico & Balsa',
    zone: 'Centro',
    label: 'Rua da Praia, Balsa & Rodoviária',
    image: '/images/sao-sebastiao/centro-historico.jpg',
    alt: 'Rua da Praia no Centro Histórico de São Sebastião com orla e coqueiros',
    searchKey: 'Centro Histórico',
  },
  {
    name: 'Cachoeiras do Ribeirão de Itu',
    zone: 'Mata Atlântica',
    label: 'Trilha, Poços Naturais & Samambaiaçu',
    image: '/images/sao-sebastiao/cachoeira-itu.jpg',
    alt: 'Queda dágua cristalina da Trilha das Cachoeiras do Ribeirão de Itu em Boiçucanga',
    searchKey: 'Boiçucanga',
  },
];

export const HomePage: React.FC = () => {
  const [popularPlaces, setPopularPlaces] = useState<KnownLocation[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<PublicDriverMarker[]>([]);
  const [originIndex, setOriginIndex] = useState<number>(0);
  const [destinationIndex, setDestinationIndex] = useState<number>(4); // Maresias
  const [estimate, setEstimate] = useState<{ fareAmount: number; distanceKm: number; durationMinutes: number } | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  // Delivery waitlist form state
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistPhone, setWaitlistPhone] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistRole, setWaitlistRole] = useState<DeliveryWaitlistRole>('courier_motorcycle');
  const [waitlistNeighborhood, setWaitlistNeighborhood] = useState('Centro');
  const [waitlistNotes, setWaitlistNotes] = useState('');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState<string | null>(null);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const handleSelectDestination = (searchKey: string) => {
    if (!popularPlaces.length) return;
    const idx = popularPlaces.findIndex((p) => p.name.toLowerCase().includes(searchKey.toLowerCase()));
    if (idx !== -1) {
      setDestinationIndex(idx);
      document.getElementById('simulador')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

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

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistError(null);
    setWaitlistSuccess(null);

    if (!waitlistName.trim() || waitlistName.trim().length < 2) {
      setWaitlistError('Por favor, informe seu nome completo.');
      return;
    }

    const cleanPhone = waitlistPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setWaitlistError('Por favor, informe um WhatsApp ou telefone válido com DDD.');
      return;
    }

    setWaitlistSubmitting(true);
    try {
      const res = await deliveriesApi.joinWaitlist({
        name: waitlistName.trim(),
        phone: waitlistPhone.trim(),
        email: waitlistEmail.trim() || undefined,
        role: waitlistRole,
        neighborhood: waitlistNeighborhood,
        notes: waitlistNotes.trim() || undefined,
      });

      setWaitlistSuccess(res.message || 'Interesse registrado com sucesso na lista de espera!');
      setWaitlistName('');
      setWaitlistPhone('');
      setWaitlistEmail('');
      setWaitlistNotes('');
    } catch (err: any) {
      setWaitlistError(err.message || 'Falha ao registrar interesse. Tente novamente.');
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Centralized sub-header banner */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 py-2.5 px-4 text-center">
        <p className="text-xs sm:text-sm font-medium text-slate-300 max-w-4xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
          <span>
            Mobilidade justa em São Sebastião: <strong className="text-emerald-400">Corridas ativas</strong> com pagamento direto • <span className="text-amber-400 font-semibold">Entregas (moto e bike) em breve!</span>
          </span>
        </p>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-20 lg:py-24 border-b border-slate-900 bg-slate-950">
        {/* Authentic Coastal Road & Atlantic Forest Photography Background */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/sao-sebastiao/hero-rio-santos.jpg"
            alt="Trecho costeiro da Rodovia Rio-Santos entre a Mata Atlântica e o mar de São Sebastião"
            className="w-full h-full object-cover object-center opacity-25 lg:opacity-30 pointer-events-none"
          />
          {/* Deep Navy Gradient Overlays to preserve absolute text readability & contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/80" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Transporte 100% Local • São Sebastião - SP
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Seu aplicativo de corridas locais no <span className="text-emerald-400">Litoral Norte</span>.
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Transporte de passageiros ativo em São Sebastião com tarifas oficiais transparentes. Condutores escolhem entre dois planos alternativos (não cumulativos): <strong>Plano Comissão de 10%</strong> (com acerto semanal) ou <strong>Plano Mensalidade de R$ 100/mês</strong> (sem comissão por corrida). Passageiros totalmente verificados podem ter acesso a <strong>5% de desconto</strong>, conforme as condições aplicáveis. Pagamento 100% direto ao condutor via Pix ou dinheiro.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <Link
                  to="/passenger"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/60 transition-all hover:scale-105 flex items-center justify-center gap-2"
                >
                  <Car className="w-4 h-4" />
                  Pedir Corrida (Passageiro)
                </Link>
                <Link
                  to="/driver/register"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 font-bold text-sm transition-all hover:scale-105 flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Quero Dirigir
                </Link>
                <a
                  href="#servicos-apk"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  Baixar APKs
                </a>
              </div>

              {/* Key Highlights */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 max-w-lg mx-auto lg:mx-0 text-left">
                <div>
                  <span className="block text-2xl font-black text-emerald-400">5% OFF</span>
                  <span className="text-xs text-slate-400 font-medium">Passageiro totalmente verificado</span>
                </div>
                <div>
                  <span className="block text-2xl font-black text-emerald-400">R$ 100 ou 10%</span>
                  <span className="text-xs text-slate-400 font-medium">Planos alternativos</span>
                </div>
                <div>
                  <span className="block text-2xl font-black text-emerald-400">100% Direto</span>
                  <span className="text-xs text-slate-400 font-medium">Pix ou dinheiro ao condutor</span>
                </div>
              </div>

              {/* Location Badge */}
              <div className="pt-2 flex items-center justify-center lg:justify-start gap-2 text-[11px] text-slate-400 font-medium">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Atendimento de Boracéia à Enseada • Conexão Costa Sul, Centro e Balsa</span>
              </div>
            </div>

            {/* Right Simulator Card */}
            <div className="lg:col-span-5" id="simulador">
              <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-5">
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

                {/* Interactive Route Map Preview */}
                <div className="rounded-xl overflow-hidden border border-slate-800 shadow-lg">
                  <MapDisplay
                    pickup={
                      popularPlaces[originIndex]
                        ? {
                            address: popularPlaces[originIndex].address,
                            lat: popularPlaces[originIndex].lat,
                            lng: popularPlaces[originIndex].lng,
                          }
                        : {
                            address: 'Centro, São Sebastião - SP',
                            lat: -23.8055,
                            lng: -45.4011,
                          }
                    }
                    destination={
                      popularPlaces[destinationIndex]
                        ? {
                            address: popularPlaces[destinationIndex].address,
                            lat: popularPlaces[destinationIndex].lat,
                            lng: popularPlaces[destinationIndex].lng,
                          }
                        : null
                    }
                    drivers={onlineDrivers}
                    height="240px"
                  />
                </div>

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

      {/* THREE CORE SERVICE AREAS */}
      <section id="servicos-apk" className="py-20 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30">
              Ecossistema VaiCar em São Sebastião
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mt-3">
              Serviços Transparentes para Nossa Cidade
            </h2>
            <p className="mt-2 text-slate-400 text-sm">
              Conheça como solicitar corridas, como atuar como motorista parceiro e o futuro serviço de entregas locais.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* AREA 1: PASSENGERS */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              
              {/* Subtle Coastal Photo Header Accent */}
              <div className="relative h-32 -mx-7 -mt-7 mb-6 overflow-hidden rounded-t-3xl">
                <img
                  src="/images/sao-sebastiao/service-passenger-pauba.jpg"
                  alt="Praia de Paúba em São Sebastião sob o sol"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
                <div className="absolute bottom-3 left-6 flex items-center gap-2">
                  <div className="w-11 h-11 rounded-xl bg-emerald-950/90 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-md backdrop-blur-sm">
                    <Car className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-slate-950/85 px-2.5 py-0.5 rounded-full border border-emerald-500/30 backdrop-blur-sm">
                    Serviço Ativo
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-white mt-1">Passageiros</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Viagens seguras de carro por toda São Sebastião (Centro até Boracéia). Solicite sua corrida em segundos pelo aplicativo nativo ou diretamente no navegador.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>5% de Desconto Exclusivo:</strong> Disponível e aplicado automaticamente apenas para passageiros com verificação de segurança completa (antecedentes criminais validados). O cadastro simples isolado não concede o benefício.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Pagamento 100% Direto ao Condutor:</strong> O passageiro paga diretamente ao motorista via Pix ou dinheiro. A VaiCar não retém e nem custodia o valor das corridas.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Preço Justo e Regulamentado:</strong> Base de R$ 10,00, R$ 1,00/km e R$ 0,25/minuto com tolerância de espera de 4 min.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-6 mt-6 border-t border-slate-800">
                <a
                  href="/downloads/vaicar-passenger.apk"
                  download="vaicar-passenger.apk"
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Download className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  Baixar APK Passageiro (16.8 MB)
                </a>
                <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
                  <Link to="/download/passenger" className="hover:text-emerald-400 underline">
                    Instruções & Verificação SHA-256 →
                  </Link>
                  <Link to="/passenger" className="hover:text-white underline">
                    Acessar via Web →
                  </Link>
                </div>
              </div>
            </div>

            {/* AREA 2: DRIVERS */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Subtle Coastal Road Photo Header Accent */}
              <div className="relative h-32 -mx-7 -mt-7 mb-6 overflow-hidden rounded-t-3xl">
                <img
                  src="/images/sao-sebastiao/service-driver-road.jpg"
                  alt="Curva e mirante da Rodovia Rio-Santos sobre o litoral de São Sebastião"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
                <div className="absolute bottom-3 left-6 flex items-center gap-2">
                  <div className="w-11 h-11 rounded-xl bg-emerald-950/90 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-md backdrop-blur-sm">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-slate-950/85 px-2.5 py-0.5 rounded-full border border-emerald-500/30 backdrop-blur-sm">
                    Oportunidade Local
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-white mt-1">Motoristas Parceiros</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Trabalhe com autonomia total sem repassar fatias abusivas para intermediários. Seja valorizado como profissional do trânsito no Litoral Norte.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Planos Alternativos e Não Cumulativos (Escolha 1):</strong><br />
                    • <strong>Plano A:</strong> 10% de comissão por corrida, com acerto semanal.<br />
                    • <strong>Plano B:</strong> Mensalidade fixa de R$ 100/mês, sem cobrança de 10% por corrida. O motorista opta por um dos planos.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>100% no seu Pix ou Dinheiro:</strong> O passageiro paga diretamente para você na conclusão da corrida. A VaiCar não retém repasses.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Cadastro Descomplicado:</strong> Validação ágil de CNH com EAR, CRLV e perfil profissional.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-6 mt-6 border-t border-slate-800">
                <a
                  href="/downloads/vaicar-driver.apk"
                  download="vaicar-driver.apk"
                  className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  Baixar APK Motorista (18.2 MB)
                </a>
                <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
                  <Link to="/download/driver" className="hover:text-emerald-400 underline">
                    Instruções & Verificação SHA-256 →
                  </Link>
                  <Link to="/driver/register" className="text-emerald-400 font-semibold hover:underline">
                    Quero me Cadastrar →
                  </Link>
                </div>
              </div>
            </div>

            {/* AREA 3: DELIVERIES - COMING SOON */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-7 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Styled Accent Header */}
              <div className="relative h-32 -mx-7 -mt-7 mb-6 overflow-hidden rounded-t-3xl bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-950 border-b border-amber-500/20 p-6 flex flex-col justify-end">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-11 h-11 rounded-xl bg-amber-950/90 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-md">
                      <Package className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-slate-950/85 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                      Expansão de Serviços
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
                    Em Breve
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-white mt-1">VaiCar Entregas</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Estamos estruturando o serviço de entregas expressas para conectar o comércio local, restaurantes, farmácias e moradores de São Sebastião.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                      <span>🏍️ Motocicletas</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Entregas ágeis de refeições, remédios e volumes médios com rapidez pela SP-055.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
                      <Bike className="w-3.5 h-3.5" /> <span>Bicicletas</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Entregas ecológicas, sem custo de combustível, ideais para o Centro Histórico e orla.
                    </p>
                  </div>
                </div>

                {/* Important Transparency Notice */}
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso:</strong> O serviço de entregas está em preparação operacional. Pedidos de entrega não estão ativos nesta versão e os APKs atuais atendem exclusivamente passageiros e motoristas.
                  </span>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-800">
                <a
                  href="#lista-espera"
                  className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Cadastrar na Lista de Espera
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DELIVERY SERVICE WAITLIST / INTEREST REGISTRATION FORM */}
      <section id="lista-espera" className="py-20 bg-slate-900/50 border-b border-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-8">
              <span className="px-3 py-1 rounded-full bg-amber-950 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider">
                Lista de Espera Oficial • VaiCar Entregas
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Cadastre seu Interesse para o Lançamento
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Seja avisado com prioridade assim que as operações de entrega forem iniciadas em São Sebastião. Cadastre-se como entregador de moto ou bike, comerciante parceiro ou cliente.
              </p>
            </div>

            {waitlistSuccess && (
              <div className="p-4 mb-6 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{waitlistSuccess}</span>
              </div>
            )}

            {waitlistError && (
              <div className="p-4 mb-6 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs sm:text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{waitlistError}</span>
              </div>
            )}

            <form onSubmit={handleWaitlistSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nome Completo / Nome do Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    value={waitlistName}
                    onChange={(e) => setWaitlistName(e.target.value)}
                    placeholder="Ex: João da Silva ou Pizzaria Maresias"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    WhatsApp com DDD *
                  </label>
                  <input
                    type="tel"
                    required
                    value={waitlistPhone}
                    onChange={(e) => setWaitlistPhone(e.target.value)}
                    placeholder="(12) 99999-9999"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Perfil de Interesse *
                  </label>
                  <select
                    value={waitlistRole}
                    onChange={(e) => setWaitlistRole(e.target.value as DeliveryWaitlistRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="courier_motorcycle">🏍️ Entregador (Motocicleta)</option>
                    <option value="courier_bicycle">🚲 Entregador (Bicicleta)</option>
                    <option value="merchant">🏪 Comércio / Restaurante</option>
                    <option value="consumer">📦 Consumidor / Encomendas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Bairro / Região em São Sebastião
                  </label>
                  <input
                    type="text"
                    value={waitlistNeighborhood}
                    onChange={(e) => setWaitlistNeighborhood(e.target.value)}
                    placeholder="Ex: Centro, Maresias, Juquehy..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    E-mail (Opcional)
                  </label>
                  <input
                    type="email"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Observações ou Modelo do Veículo (Opcional)
                </label>
                <input
                  type="text"
                  value={waitlistNotes}
                  onChange={(e) => setWaitlistNotes(e.target.value)}
                  placeholder="Ex: Moto 160cc com baú, bike própria, horário disponível..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 text-center sm:text-right">
                <button
                  type="submit"
                  disabled={waitlistSubmitting}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50"
                >
                  {waitlistSubmitting ? (
                    'Enviando...'
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Entrar na Lista de Espera
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Operating Zones & Beaches Showcase with Real Photography */}
      <section id="praias-cobertas" className="py-20 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30">
                Cobertura Geográfica Real • São Sebastião
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2.5">
                Principais Rotas & Praias Cobertas
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                Mobilidade porta a porta em todo o município de São Sebastião — da Costa Sul ao Centro Histórico, travessia da balsa e cachoeiras da Mata Atlântica.
              </p>
            </div>
            <Link
              to="/passenger"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
            >
              Pedir Corrida pelo Mapa <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {DESTINATION_CARDS.map((dest) => (
              <div
                key={dest.name}
                onClick={() => handleSelectDestination(dest.searchKey)}
                className="group relative rounded-2xl overflow-hidden border border-slate-800/90 hover:border-emerald-500/60 bg-slate-900 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-950/30 cursor-pointer flex flex-col justify-end"
                style={{ minHeight: '220px' }}
              >
                {/* Authentic Location Photo */}
                <img
                  src={dest.image}
                  alt={dest.alt}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {/* Gradient Overlays for flawless contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors" />

                {/* Content Overlay */}
                <div className="relative z-10 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-slate-950/85 px-2 py-0.5 rounded-md border border-emerald-500/30 backdrop-blur-sm flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-emerald-400" /> {dest.zone}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      Simular rota →
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                    {dest.name}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-medium leading-tight">
                    {dest.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-900 gap-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Mais de 30 praias e bairros atendidos com raio de busca de até 15 km
            </span>
            <span className="text-[11px] text-slate-500">
              Dica: Clique em qualquer praia para selecionar como destino no simulador
            </span>
          </div>
        </div>
      </section>

      {/* Community & WhatsApp Banner */}
      <section className="relative py-16 overflow-hidden bg-slate-950 border-t border-slate-800">
        {/* Subtle Canal Panoramic Backdrop Texture */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/sao-sebastiao/community-canal.jpg"
            alt="Vista panorâmica do Canal e da Cidade de São Sebastião"
            loading="lazy"
            className="w-full h-full object-cover opacity-15 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/80 via-slate-950/95 to-slate-950" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Comunidade Oficial VaiCar
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                Fique por dentro da balsa, trânsito e novidades no Litoral Norte
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Entre no nosso grupo oficial no WhatsApp para suporte rápido, avisos sobre filas da balsa para Ilhabela, condições da rodovia Rio-Santos (SP-055) e contato direto com a equipe.
              </p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Suporte ágil</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Atualizações locais</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Motoristas e passageiros</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full sm:w-auto shrink-0">
              <a
                href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all hover:scale-105 text-center"
              >
                <MessageCircle className="w-5 h-5" /> Entrar no Grupo Oficial
              </a>
              <Link
                to="/driver/register"
                className="px-8 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors text-center"
              >
                Cadastrar como Motorista
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
