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
  Store,
  Gift,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Percent,
  Award,
  UtensilsCrossed,
  Hotel,
  ExternalLink,
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

interface FaqItem {
  category: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'Passageiros',
    question: 'Como funciona o pagamento das corridas no VaiCar?',
    answer:
      'O pagamento é realizado 100% diretamente ao motorista parceiro no final da corrida, via Pix ou dinheiro. A VaiCar não retém nem intermedia pagamentos de passageiros, garantindo tarifas transparentes e sem cobranças ocultas de cartão de crédito.',
  },
  {
    category: 'Passageiros',
    question: 'Como funciona a tarifa regulamentada e transparente do VaiCar?',
    answer:
      'As tarifas são calculadas de forma clara e previsível com base na tabela regulamentada de São Sebastião (tarifa base + km rodado e tempo estimado), sem cobrança de tarifa dinâmica abusiva em horários de pico, chuva ou alta temporada.',
  },
  {
    category: 'Passageiros',
    question: 'Como funciona o Programa de Indicação (R$ 5,00 de bônus)?',
    answer:
      'Cada passageiro cadastrado possui um código de indicação exclusivo. Ao compartilhar com um amigo, ele ganha R$ 5,00 de desconto na primeira corrida. Assim que a primeira viagem dele for concluída, você recebe R$ 5,00 em créditos na sua conta para abater em viagens futuras. O motorista parceiro sempre recebe o valor integral, pois o desconto é 100% subsidiado pela VaiCar.',
  },
  {
    category: 'Motoristas',
    question: 'Quais são os planos para motoristas parceiros em São Sebastião?',
    answer:
      'Condutores escolhem entre dois planos alternativos não cumulativos: o Plano Mensalidade de R$ 100/mês (com 0% de comissão por corrida, onde 100% do valor da viagem fica com o condutor) OU o Plano Comissão de 10% por corrida (com acerto semanal). Você escolhe o plano que melhor se adapta à sua rotina de trabalho.',
  },
  {
    category: 'Condutores & Entregadores',
    question: 'Quais são os requisitos para dirigir carro ou entregar de moto e bike?',
    answer:
      'Para carro: CNH definitiva com EAR, veículo 4 portas com ar-condicionado, CRLV em dia, antecedentes criminais e residência. Para moto: CNH A com EAR, CRLV e antecedentes. Para bicicleta: maior de 18 anos, documento de identidade oficial (RG/CNH), CPF e antecedentes criminais (sem necessidade de CNH ou taxas do Detran).',
  },
  {
    category: 'Entregas & Empresas',
    question: 'O serviço de entregas de moto e bike já está funcionando para pedidos imediatos?',
    answer:
      'O serviço VaiCar Entregas está em fase de estruturação operacional e lista de espera para comerciantes, restaurantes e entregadores de São Sebastião. Ele não está disponível para agendamento imediato nesta versão dos aplicativos. Cadastre-se na lista de espera para ser avisado com prioridade no lançamento.',
  },
  {
    category: 'Empresas',
    question: 'Como restaurantes, pousadas e comércios locais podem ser parceiros?',
    answer:
      'Estabelecimentos locais podem se cadastrar na nossa página de Parcerias Locais (/parcerias) para conectar-se a entregadores parceiros sem as taxas abusivas de 25% a 30% dos grandes marketplaces, ou solicitar códigos de desconto exclusivos para seus hóspedes e clientes.',
  },
  {
    category: 'Cobertura',
    question: 'Qual é a área de atendimento em São Sebastião?',
    answer:
      'Atendemos toda a extensão do município de São Sebastião — da Costa Sul (Boracéia, Barra do Una, Juquehy, Camburi, Boiçucanga, Maresias, Paúba, Toque-Toque) ao Centro Histórico, travessia da balsa para Ilhabela e Costa Norte (São Francisco, Enseada, Canto do Mar).',
  },
];

export const HomePage: React.FC = () => {
  const [popularPlaces, setPopularPlaces] = useState<KnownLocation[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<PublicDriverMarker[]>([]);
  const [originIndex, setOriginIndex] = useState<number>(0);
  const [destinationIndex, setDestinationIndex] = useState<number>(4); // Maresias
  const [estimate, setEstimate] = useState<{ fareAmount: number; distanceKm: number; durationMinutes: number } | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);

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

  // FAQ state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

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
      <div className="bg-blue-50/70 dark:bg-slate-900/90 border-b border-blue-200/60 dark:border-slate-800/80 py-2.5 px-4 text-center">
        <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 max-w-4xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-emerald-500 inline-block animate-pulse shrink-0" />
          <span>
            Mobilidade justa em São Sebastião: <strong className="text-blue-700 dark:text-emerald-400">Corridas ativas</strong> com pagamento direto • <span className="text-blue-700 dark:text-emerald-400 font-semibold">Sem tarifa dinâmica</span> • <span className="text-amber-700 dark:text-amber-400 font-semibold">Entregas em breve!</span>
          </span>
        </p>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:py-20 border-b border-slate-200 dark:border-slate-900 bg-slate-950">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/sao-sebastiao/hero-rio-santos.jpg"
            alt="Trecho costeiro da Rodovia Rio-Santos entre a Mata Atlântica e o mar de São Sebastião"
            className="w-full h-full object-cover object-center opacity-15 lg:opacity-25 dark:opacity-25 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/90 to-white/70 dark:from-slate-950 dark:via-slate-950/95 dark:to-slate-950/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-white/60 dark:from-slate-950 dark:via-transparent dark:to-slate-950/80" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(21,93,252,0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Mobile Quick Action Tabs (Top of Hero on Mobile) */}
          <div className="grid grid-cols-3 gap-2.5 pb-6 lg:hidden">
            <Link
              to="/passenger"
              className="p-3 rounded-2xl bg-blue-600 text-white text-center flex flex-col items-center justify-center space-y-1 shadow-md shadow-blue-500/25 active:scale-95 transition-all"
            >
              <Car className="w-5 h-5 text-white" />
              <span className="text-[11px] font-extrabold text-white leading-tight">Pedir Corrida</span>
              <span className="text-[9px] font-bold text-blue-100 uppercase">Tarifa Justa</span>
            </Link>

            <Link
              to="/driver/register"
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center space-y-1 shadow-sm active:scale-95 transition-all"
            >
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">Quero Dirigir</span>
              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">R$ 100 ou 10%</span>
            </Link>

            <Link
              to="/parcerias"
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center space-y-1 shadow-sm active:scale-95 transition-all"
            >
              <Store className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">Empresas</span>
              <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 uppercase">Parcerias</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-800 text-blue-700 dark:text-blue-400 text-xs font-semibold backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-emerald-500 animate-pulse" />
                Transporte 100% Local • São Sebastião - SP
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15]">
                Sua corrida, do seu jeito, <span className="text-blue-600 dark:text-emerald-400">aqui em São Sebastião.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Mobilidade prática de Boracéia à Enseada com tarifas oficiais transparentes. Peça sua corrida em instantes, viaje com motoristas parceiros locais verificados e pague direto via Pix ou dinheiro.
              </p>

              {/* CTAs */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                  <Link
                    to="/passenger"
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2.5"
                  >
                    <Car className="w-5 h-5" />
                    Pedir Corrida
                  </Link>
                  <Link
                    to="/driver/register"
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-bold text-sm transition-all hover:scale-[1.01] flex items-center justify-center gap-2 shadow-sm"
                  >
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Quero Dirigir
                  </Link>
                </div>

                {/* Secondary accessible options (Empresas & Entregas) without competing with primary CTA */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-400 dark:text-slate-500">Outros serviços:</span>
                  <Link
                    to="/parcerias"
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <Store className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    Para Empresas
                  </Link>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <a
                    href="#entregas"
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <Package className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    Entregas locais (Em breve)
                  </a>
                </div>
              </div>

              {/* Key Highlights */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800/80 max-w-lg mx-auto lg:mx-0 text-left">
                <div>
                  <span className="block text-2xl font-black text-blue-600 dark:text-emerald-400">Sem Dinâmica</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tarifa justa em São Sebastião</span>
                </div>
                <div>
                  <span className="block text-2xl font-black text-slate-900 dark:text-white">R$ 100 ou 10%</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Planos alternativos</span>
                </div>
                <div>
                  <span className="block text-2xl font-black text-emerald-600 dark:text-emerald-400">100% Direto</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pix ou dinheiro ao condutor</span>
                </div>
              </div>

              {/* Location Badge */}
              <div className="pt-2 flex items-center justify-center lg:justify-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-emerald-400 shrink-0" />
                <span>Atendimento de Boracéia à Enseada • Conexão Costa Sul, Centro e Balsa</span>
              </div>
            </div>

            {/* Right Simulator Card */}
            <div className="lg:col-span-5" id="simulador">
              <div className="bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md dark:shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-600 dark:text-emerald-400" /> Simulador de Tarifa Local
                  </h3>
                  <span className="text-[11px] font-semibold text-blue-700 dark:text-emerald-400 px-2 py-0.5 rounded bg-blue-50 dark:bg-emerald-950 border border-blue-200 dark:border-emerald-800">
                    Tarifa Oficial 2026
                  </span>
                </div>

                {/* Origin selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-emerald-400" /> Ponto de Partida
                  </label>
                  <select
                    value={originIndex}
                    onChange={(e) => setOriginIndex(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" /> Ponto de Destino
                  </label>
                  <select
                    value={destinationIndex}
                    onChange={(e) => setDestinationIndex(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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
                  <div className="bg-blue-50/60 dark:bg-slate-950 rounded-xl p-4 border border-blue-200 dark:border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Estimativa Regulamentada:</span>
                      <span className="text-3xl font-black text-blue-600 dark:text-emerald-400">
                        {loadingEstimate ? 'Calculando...' : `R$ ${estimate.fareAmount.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                      <div className="flex items-center gap-1 justify-end text-slate-700 dark:text-slate-300 font-medium">
                        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-emerald-400" /> ~{estimate.durationMinutes} min
                      </div>
                      <div>{estimate.distanceKm.toFixed(1)} km aproximados</div>
                    </div>
                  </div>
                )}

                {/* Interactive Route Map Preview & Navigation Controls */}
                {(() => {
                  const currentOrigin = popularPlaces[originIndex];
                  const currentDestination = popularPlaces[destinationIndex];
                  const gmapsUrl = currentOrigin && currentDestination
                    ? `https://www.google.com/maps/dir/?api=1&origin=${currentOrigin.lat},${currentOrigin.lng}&destination=${currentDestination.lat},${currentDestination.lng}&travelmode=driving`
                    : currentDestination
                      ? `https://www.google.com/maps/dir/?api=1&destination=${currentDestination.lat},${currentDestination.lng}&travelmode=driving`
                      : 'https://www.google.com/maps';

                  const wazeUrl = currentDestination
                    ? `https://waze.com/ul?ll=${currentDestination.lat},${currentDestination.lng}&navigate=yes`
                    : currentOrigin
                      ? `https://waze.com/ul?ll=${currentOrigin.lat},${currentOrigin.lng}&navigate=yes`
                      : 'https://waze.com';

                  return (
                    <div className="space-y-3">
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative">
                        <MapDisplay
                          pickup={
                            currentOrigin
                              ? {
                                  address: currentOrigin.address,
                                  lat: currentOrigin.lat,
                                  lng: currentOrigin.lng,
                                }
                              : {
                                  address: 'Centro, São Sebastião - SP',
                                  lat: -23.8055,
                                  lng: -45.4011,
                                }
                          }
                          destination={
                            currentDestination
                              ? {
                                  address: currentDestination.address,
                                  lat: currentDestination.lat,
                                  lng: currentDestination.lng,
                                }
                              : null
                          }
                          drivers={onlineDrivers}
                          height="250px"
                          showHud={false}
                          compactPins={true}
                          onRouteInfoChange={setRouteMetrics}
                        />
                      </div>

                      {/* Route Trajectory & Distance/Time Panel */}
                      <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-3 border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          {/* Trajectory */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-sm" />
                              <span
                                className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[110px] sm:max-w-[130px]"
                                title={currentOrigin?.name}
                              >
                                {currentOrigin?.name || 'Origem'}
                              </span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-sm" />
                              <span
                                className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[110px] sm:max-w-[130px]"
                                title={currentDestination?.name}
                              >
                                {currentDestination?.name || 'Destino'}
                              </span>
                            </div>
                          </div>

                          {/* Distance & Time badge */}
                          {(estimate || routeMetrics) && (
                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                📍 {(estimate?.distanceKm ?? routeMetrics?.distanceKm)?.toFixed(1)} km
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="text-[11px] font-bold text-blue-600 dark:text-emerald-400">
                                ⏱️ ~{estimate?.durationMinutes ?? routeMetrics?.durationMinutes} min
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* External Navigation Launchers Action Bar */}
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={gmapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                          title="Abrir rota no Google Maps"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>Google Maps</span>
                        </a>
                        <a
                          href={wazeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-slate-950 dark:hover:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                          title="Navegar no Waze"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                          <span>Waze</span>
                        </a>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-1.5 pt-1">
                  <Link
                    to="/passenger"
                    className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/25 hover:shadow-lg active:scale-95 group"
                  >
                    <Car className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>Pedir Corrida no Painel</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                    Acesse o painel do passageiro para solicitar sua viagem
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA & DIFERENCIAIS DE CONFIANÇA */}
      <section id="como-funciona" className="py-14 sm:py-18 bg-transparent border-b border-slate-200 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-emerald-400 px-3.5 py-1 rounded-full bg-blue-50 dark:bg-emerald-950/80 border border-blue-200 dark:border-emerald-500/30 inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Simples, Rápido e Local
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Como Funciona o VaiCar em São Sebastião
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Sem intermediários complicados: você pede sua viagem em segundos, viaja com motoristas da nossa cidade e paga direto a quem dirige.
            </p>
          </div>

          {/* 3 Simple Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-sm">
                    1
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50/80 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/60">
                    Simule & Peça
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  1. Escolha Origem e Destino
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Pelo navegador ou aplicativo, selecione sua rota em São Sebastião e visualize a estimativa de tempo e tarifa regulamentada antes de confirmar.
                </p>
              </div>
              <div className="pt-2 text-xs font-semibold text-blue-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sem tarifa dinâmica surpresa</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-sm">
                    2
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/60">
                    Embarque Seguro
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  2. Viaje com Parceiro Local
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Um motorista parceiro local aceita sua corrida. Acompanhe a chegada em tempo real com identificação de veículo e condutor verificado.
                </p>
              </div>
              <div className="pt-2 text-xs font-semibold text-blue-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Condutores com CNH e certidão de antecedentes</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-emerald-400 font-black text-sm">
                    3
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-emerald-400 uppercase tracking-wider bg-blue-50/80 dark:bg-slate-950/80 px-2 py-0.5 rounded border border-blue-200/60 dark:border-slate-800">
                    Acerto Direto
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  3. Pague Direto e Avalie
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Ao concluir a viagem, realize o pagamento diretamente ao motorista no Pix ou dinheiro. Avalie a experiência para mantermos a qualidade do serviço.
                </p>
              </div>
              <div className="pt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span>100% do valor vai para o motorista</span>
              </div>
            </div>
          </div>

          {/* Real Trust Differentiators Banner */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Motoristas Verificados</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    CNH, CRLV e certidão de antecedentes verificados pela plataforma.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Pagamento 100% Direto</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Pix ou dinheiro direto a quem dirige. Sem retenções abusivas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-emerald-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Tarifa Justa e Oficial</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Base transparente de R$ 10 + R$ 1/km e R$ 0,25/minuto, sem surpresas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Bônus de Indicação</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    R$ 5,00 de desconto na primeira corrida indicada por um amigo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REFERRAL MARKETING SPOTLIGHT (INDIQUE E GANHE) */}
      <section className="py-14 sm:py-18 bg-transparent border-b border-slate-200 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-emerald-500/40 rounded-3xl p-6 sm:p-10 shadow-md dark:shadow-2xl relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-emerald-950 border border-blue-200 dark:border-emerald-500/40 text-blue-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <Gift className="w-3.5 h-3.5" />
                  <span>Programa de Indicação VaiCar</span>
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  Indique Amigos e Ganhe <span className="text-blue-600 dark:text-emerald-400">R$ 5,00 em Créditos</span>
                </h2>

                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  Cada passageiro cadastrado possui um código de indicação exclusivo. Compartilhe com amigos, turistas e familiares em São Sebastião: seu amigo ganha <strong>R$ 5,00 de desconto</strong> na primeira corrida, e você recebe <strong>R$ 5,00 em créditos</strong> na sua carteira após a conclusão da viagem!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-xs font-bold text-blue-600 dark:text-emerald-400 block">1. Compartilhe seu Código</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">Disponível no seu painel de passageiro em 1 clique via WhatsApp.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-xs font-bold text-blue-600 dark:text-emerald-400 block">2. Amigo Ganha R$ 5</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">Desconto imediato na primeira viagem realizada em São Sebastião.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-xs font-bold text-blue-600 dark:text-emerald-400 block">3. Você Recebe R$ 5</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">Crédito automático para abater nas suas próximas viagens.</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-3 text-center sm:text-left">
                <Link
                  to="/passenger"
                  className="px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all text-center active:scale-95"
                >
                  <Gift className="w-4 h-4" />
                  <span>Pegar meu Código de Indicação</span>
                </Link>
                <Link
                  to="/como-funciona/passageiro"
                  className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors text-center"
                >
                  <span>Ver Regras do Programa</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE CORE SERVICE AREAS */}
      <section id="servicos-apk" className="py-16 sm:py-20 bg-transparent border-b border-slate-200 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-emerald-400 px-3 py-1 rounded-full bg-blue-50 dark:bg-emerald-950/80 border border-blue-200 dark:border-emerald-500/30">
              Ecossistema VaiCar em São Sebastião
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight mt-3">
              Serviços Transparentes para Nossa Cidade
            </h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">
              Conheça como solicitar corridas, como atuar como motorista parceiro e o futuro serviço de entregas locais.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* AREA 1: PASSENGERS */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-7 flex flex-col justify-between hover:border-blue-500/50 dark:hover:border-emerald-500/50 transition-all shadow-md dark:shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 dark:bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              
              {/* Photo Header */}
              <div className="relative h-36 -mx-7 -mt-7 mb-6 overflow-hidden rounded-t-3xl">
                <img
                  src="/images/sao-sebastiao/service-passenger-pauba.jpg"
                  alt="Praia de Paúba em São Sebastião sob o sol"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent" />
                <div className="absolute bottom-3 left-6 flex items-center gap-2">
                  <div className="w-11 h-11 rounded-xl bg-blue-600/90 dark:bg-emerald-950/90 border border-blue-400/40 dark:border-emerald-500/50 flex items-center justify-center text-white dark:text-emerald-400 shadow-md backdrop-blur-sm">
                    <Car className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-slate-900/85 px-2.5 py-0.5 rounded-full border border-slate-700 backdrop-blur-sm">
                    Serviço Ativo
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Passageiros</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    Viagens seguras de carro por toda São Sebastião (Centro até Boracéia). Solicite sua corrida em segundos pelo aplicativo nativo ou diretamente no navegador.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Bônus de Indicação:</strong> R$ 5,00 de desconto na primeira corrida para novos passageiros convidados por amigos cadastrados.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Pagamento 100% Direto ao Condutor:</strong> O passageiro paga diretamente ao motorista via Pix ou dinheiro. A VaiCar não retém o valor das corridas.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Preço Justo e Regulamentado:</strong> Base de R$ 10,00, R$ 1,00/km e R$ 0,25/minuto com tolerância de espera de 4 min.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                <a
                  href="/downloads/vaicar-passenger.apk"
                  download="vaicar-passenger.apk"
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Download className="w-4 h-4 text-white stroke-[2.5]" />
                  Baixar APK Passageiro (16.8 MB)
                </a>
                <div className="flex items-center justify-between text-[11px] px-1 text-slate-500 dark:text-slate-400">
                  <Link to="/como-funciona/passageiro" className="hover:text-blue-600 dark:hover:text-emerald-400 underline">
                    Como Funciona a Plataforma →
                  </Link>
                  <Link to="/passenger" className="hover:text-slate-900 dark:hover:text-white underline">
                    Acessar via Web →
                  </Link>
                </div>
              </div>
            </div>

            {/* AREA 2: DRIVERS */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-7 flex flex-col justify-between hover:border-slate-400 dark:hover:border-emerald-500/50 transition-all shadow-md dark:shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Photo Header */}
              <div className="relative h-36 -mx-7 -mt-7 mb-6 overflow-hidden rounded-t-3xl">
                <img
                  src="/images/sao-sebastiao/service-driver-road.jpg"
                  alt="Curva e mirante da Rodovia Rio-Santos sobre o litoral de São Sebastião"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent" />
                <div className="absolute bottom-3 left-6 flex items-center gap-2">
                  <div className="w-11 h-11 rounded-xl bg-emerald-600/90 dark:bg-emerald-950/90 border border-emerald-400/40 dark:border-emerald-500/50 flex items-center justify-center text-white dark:text-emerald-400 shadow-md backdrop-blur-sm">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-slate-900/85 px-2.5 py-0.5 rounded-full border border-slate-700 backdrop-blur-sm">
                    Oportunidade Local
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Motoristas Parceiros</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    Trabalhe com autonomia total sem repassar fatias abusivas para intermediários. Seja valorizado como profissional do trânsito no Litoral Norte.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Planos Alternativos (Escolha 1):</strong><br />
                    • <strong>Plano A:</strong> Mensalidade de R$ 100/mês sem comissão por corrida.<br />
                    • <strong>Plano B:</strong> 10% de comissão com acerto semanal.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>100% no seu Pix ou Dinheiro:</strong> O passageiro paga diretamente para você na conclusão da corrida. A VaiCar não retém repasses.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Cadastro Descomplicado:</strong> Validação ágil de CNH, CRLV e certidão de antecedentes.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                <a
                  href="/downloads/vaicar-driver.apk"
                  download="vaicar-driver.apk"
                  className="w-full py-3.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 dark:border-slate-600 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  Baixar APK Motorista (18.2 MB)
                </a>
                <div className="flex items-center justify-between text-[11px] px-1 text-slate-500 dark:text-slate-400">
                  <Link to="/como-funciona/motorista" className="hover:text-blue-600 dark:hover:text-emerald-400 underline">
                    Requisitos & Planos Detalhados →
                  </Link>
                  <Link to="/driver/register" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                    Quero me Cadastrar →
                  </Link>
                </div>
              </div>
            </div>

            {/* AREA 3: DELIVERIES - COMING SOON */}
            <div id="entregas" className="bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 border border-amber-200 dark:border-amber-500/40 rounded-3xl p-7 flex flex-col justify-between shadow-md dark:shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Styled Accent Header */}
              <div className="relative h-36 -mx-7 -mt-7 mb-6 overflow-hidden rounded-t-3xl bg-gradient-to-br from-amber-50/80 via-white to-amber-50/50 dark:from-amber-950/70 dark:via-slate-900 dark:to-slate-950 border-b border-amber-200 dark:border-amber-500/20 p-6 flex flex-col justify-end">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/90 dark:bg-amber-950/90 border border-amber-400/40 dark:border-amber-500/50 flex items-center justify-center text-white dark:text-amber-400 shadow-md">
                      <Package className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 bg-amber-100/90 dark:bg-slate-950/85 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-500/30">
                      Expansão de Serviços
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">
                    Em Breve
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">VaiCar Entregas</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    Estamos estruturando o serviço de entregas expressas para conectar o comércio local, restaurantes, farmácias e moradores de São Sebastião.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-xs">
                      <span>🏍️ Motocicletas</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Entregas ágeis de refeições, remédios e volumes médios com rapidez pela SP-055.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                      <Bike className="w-3.5 h-3.5" /> <span>Bicicletas</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Entregas ecológicas, sem custo de combustível, ideais para o Centro Histórico e orla.
                    </p>
                  </div>
                </div>

                {/* Important Transparency Notice */}
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200/90 leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso:</strong> O serviço de entregas está em preparação operacional. Pedidos de entrega não estão ativos nesta versão e os APKs atuais atendem exclusivamente passageiros e motoristas.
                  </span>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                <a
                  href="#lista-espera"
                  className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm text-center"
                >
                  <Sparkles className="w-4 h-4" />
                  Cadastrar na Lista de Espera
                </a>
                <Link
                  to="/parcerias"
                  className="text-center text-xs text-amber-700 dark:text-amber-400 hover:underline font-semibold pt-1"
                >
                  É restaurante ou comércio? Conheça as parcerias →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOCAL BUSINESS PARTNERSHIP CALLOUT BANNER */}
      <section className="py-12 bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/5 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-amber-500/30 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm dark:shadow-2xl">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-500/40">
                Para Estabelecimentos de São Sebastião
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Tem um Restaurante, Pousada ou Comércio Local?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl">
                Seja um parceiro VaiCar para entregas ágeis e mobilidade para seus hóspedes e clientes, sem taxas predatórias.
              </p>
            </div>
            <Link
              to="/parcerias"
              className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shrink-0 shadow-sm shadow-amber-500/20"
            >
              <Store className="w-4 h-4" />
              <span>Conhecer Parcerias Comerciais</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* DELIVERY SERVICE WAITLIST / INTEREST REGISTRATION FORM */}
      <section id="lista-espera" className="py-20 bg-slate-950/60 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-md dark:shadow-2xl relative overflow-hidden">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-8">
              <span className="px-3 py-1 rounded-full bg-amber-950 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider">
                Lista de Espera Oficial • VaiCar Entregas
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                Cadastre seu Interesse para o Lançamento
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
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
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{waitlistError}</span>
              </div>
            )}

            <form onSubmit={handleWaitlistSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nome Completo / Nome do Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    value={waitlistName}
                    onChange={(e) => setWaitlistName(e.target.value)}
                    placeholder="Ex: João da Silva ou Pizzaria Maresias"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    WhatsApp com DDD *
                  </label>
                  <input
                    type="tel"
                    required
                    value={waitlistPhone}
                    onChange={(e) => setWaitlistPhone(e.target.value)}
                    placeholder="(12) 99999-9999"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Perfil de Interesse *
                  </label>
                  <select
                    value={waitlistRole}
                    onChange={(e) => setWaitlistRole(e.target.value as DeliveryWaitlistRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                  >
                    <option value="courier_motorcycle">🏍️ Entregador (Motocicleta)</option>
                    <option value="courier_bicycle">🚲 Entregador (Bicicleta)</option>
                    <option value="merchant">🏪 Comércio / Restaurante</option>
                    <option value="consumer">📦 Consumidor / Encomendas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Bairro / Região em São Sebastião
                  </label>
                  <input
                    type="text"
                    value={waitlistNeighborhood}
                    onChange={(e) => setWaitlistNeighborhood(e.target.value)}
                    placeholder="Ex: Centro, Maresias, Juquehy..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    E-mail (Opcional)
                  </label>
                  <input
                    type="email"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Observações ou Modelo do Veículo (Opcional)
                </label>
                <input
                  type="text"
                  value={waitlistNotes}
                  onChange={(e) => setWaitlistNotes(e.target.value)}
                  placeholder="Ex: Moto 160cc com baú, bike própria, horário disponível..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 text-center sm:text-right">
                <button
                  type="submit"
                  disabled={waitlistSubmitting}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm shadow-amber-500/25 disabled:opacity-50"
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
      <section id="praias-cobertas" className="py-20 bg-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-emerald-400 px-3 py-1 rounded-full bg-blue-50 dark:bg-emerald-950/80 border border-blue-200 dark:border-emerald-500/30">
                Cobertura Geográfica Real • São Sebastião
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-2.5">
                Principais Rotas & Praias Cobertas
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Mobilidade porta a porta em todo o município de São Sebastião — da Costa Sul ao Centro Histórico, travessia da balsa e cachoeiras da Mata Atlântica.
              </p>
            </div>
            <Link
              to="/passenger"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white dark:bg-slate-900 dark:hover:bg-slate-800 dark:border dark:border-slate-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-sm"
            >
              Pedir Corrida pelo Mapa <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {DESTINATION_CARDS.map((dest) => (
              <div
                key={dest.name}
                onClick={() => handleSelectDestination(dest.searchKey)}
                className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/90 hover:border-blue-500/60 dark:hover:border-emerald-500/60 bg-slate-900 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-end"
                style={{ minHeight: '220px' }}
              >
                {/* Authentic Location Photo */}
                <img
                  src={dest.image}
                  alt={dest.alt}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors" />

                {/* Content Overlay */}
                <div className="relative z-10 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 dark:text-emerald-400 bg-slate-950/85 px-2 py-0.5 rounded-md border border-blue-500/30 dark:border-emerald-500/30 backdrop-blur-sm flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-blue-400 dark:text-emerald-400" /> {dest.zone}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-200 bg-slate-900/80 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      Simular rota →
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white group-hover:text-blue-200 dark:group-hover:text-emerald-300 transition-colors">
                    {dest.name}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-medium leading-tight">
                    {dest.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-800 gap-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-emerald-400" /> Mais de 30 praias e bairros atendidos com raio de busca de até 15 km
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Dica: Clique em qualquer praia para selecionar como destino no simulador
            </span>
          </div>
        </div>
      </section>

      {/* PERGUNTAS FREQUENTES (FAQ) SECTION */}
      <section id="faq" className="py-20 bg-slate-950/60 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-emerald-400 px-3 py-1 rounded-full bg-blue-50 dark:bg-emerald-950 border border-blue-200 dark:border-emerald-500/30 inline-flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> Dúvidas Frequentes
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Tudo sobre o VaiCar em São Sebastião
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Respostas claras sobre tarifas regulamentadas, programa de indicação, requisitos de condutores e parcerias comerciais.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.question}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'bg-slate-900 border-blue-500/50 dark:border-emerald-500/50 shadow-md'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={isOpen}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-emerald-400">
                        {item.category}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                        {item.question}
                      </h3>
                    </div>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isOpen ? 'bg-blue-600 dark:bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 sm:pb-5 pt-0 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-800 animate-in fade-in duration-150">
                      <p className="pt-3">{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Ainda tem dúvidas? Fale com a equipe pelo WhatsApp:</p>
            <a
              href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-emerald-400 hover:text-blue-700 dark:hover:text-emerald-300 hover:underline"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Entrar no Grupo Oficial de Suporte ↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* Community & WhatsApp Banner */}
      <section className="relative py-16 overflow-hidden bg-slate-950 border-t border-slate-800">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/sao-sebastiao/community-canal.jpg"
            alt="Vista panorâmica do Canal e da Cidade de São Sebastião"
            loading="lazy"
            className="w-full h-full object-cover opacity-15 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/10 via-slate-950/95 to-slate-950 dark:from-emerald-950/80 dark:via-slate-950/95 dark:to-slate-950" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-slate-900/90 border border-slate-800 dark:border-emerald-500/30 rounded-3xl p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-md dark:shadow-2xl relative overflow-hidden backdrop-blur-sm">
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-emerald-950 dark:border-emerald-500/40 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Comunidade Oficial VaiCar
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Fique por dentro da balsa, trânsito e novidades no Litoral Norte
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Entre no nosso grupo oficial no WhatsApp para suporte rápido, avisos sobre filas da balsa para Ilhabela, condições da rodovia Rio-Santos (SP-055) e contato direto com a equipe.
              </p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-emerald-400" /> Suporte ágil</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-emerald-400" /> Atualizações locais</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-emerald-400" /> Motoristas e passageiros</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full sm:w-auto shrink-0">
              <a
                href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all hover:scale-105 text-center"
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
