import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { MapDisplay } from '../../components/MapDisplay.js';
import { WaitingTimer } from '../../components/WaitingTimer.js';
import { ReceiptModal } from '../../components/ReceiptModal.js';
import { ridesApi, EstimateRideResult } from '../../api/rides.js';
import { mapsApi, KnownLocation } from '../../api/maps.js';
import { driversApi, PublicDriverMarker } from '../../api/drivers.js';
import { passengersApi } from '../../api/passengers.js';
import { Ride, PaymentMethod, Receipt } from '../../../../shared/src/types.js';
import {
  MapPin,
  Navigation,
  CreditCard,
  Banknote,
  QrCode,
  Car,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Star,
  X,
  AlertCircle,
  User,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { ReportModal } from '../../components/ReportModal.js';

export const PassengerDashboardPage: React.FC = () => {
  const { user, profile, passenger, logout, devLogin } = useAuth();
  const navigate = useNavigate();

  // Locations state
  const [pickup, setPickup] = useState({
    address: 'Av. Dr. Altino Arantes, Centro, São Sebastião - SP',
    lat: -23.8055,
    lng: -45.4011,
  });
  const [destination, setDestination] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [popularPlaces, setPopularPlaces] = useState<KnownLocation[]>([]);
  const [customDestinationInput, setCustomDestinationInput] = useState('');

  // Drivers and estimate
  const [onlineDrivers, setOnlineDrivers] = useState<PublicDriverMarker[]>([]);
  const [estimate, setEstimate] = useState<EstimateRideResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');

  // Active ride state
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [receiptToShow, setReceiptToShow] = useState<Receipt | null>(null);

  // Rating modal state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ rideId?: string; targetName?: string } | null>(null);

  // Profile edit state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load locations and active ride on mount
  useEffect(() => {
    mapsApi.getPopularPlaces().then(setPopularPlaces).catch(console.error);

    const fetchDrivers = () => {
      driversApi.getOnlineDrivers().then(setOnlineDrivers).catch(console.error);
    };
    fetchDrivers();
    const intervalDrivers = setInterval(fetchDrivers, 10000);

    return () => clearInterval(intervalDrivers);
  }, []);

  // Sync profile details
  useEffect(() => {
    if (passenger) {
      setEditName(passenger.name);
      setEditWhatsapp(passenger.whatsapp);
    } else if (profile) {
      setEditName(profile.displayName);
      setEditWhatsapp(profile.whatsapp || '');
    }
  }, [passenger, profile]);

  // Check active ride on load
  const refreshActiveRide = useCallback(async () => {
    if (!user) return;
    try {
      const active = await passengersApi.getActiveRide();
      setActiveRide(active);
    } catch {
      // Ignored
    }
  }, [user]);

  useEffect(() => {
    refreshActiveRide();
  }, [refreshActiveRide]);

  // Polling active ride when present
  useEffect(() => {
    if (!activeRide) return;

    const interval = setInterval(async () => {
      try {
        const updated = await ridesApi.getById(activeRide.id);
        setActiveRide(updated);

        // If completed, trigger rating & receipt
        if (updated.status === 'COMPLETED') {
          if (!updated.ratingByPassenger) {
            setShowRatingModal(true);
          }
          if (updated.receiptId) {
            import('../../api/receipts.js').then(({ receiptsApi }) => {
              receiptsApi.getById(updated.receiptId!).then(setReceiptToShow).catch(console.error);
            });
          }
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Ride poll error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeRide]);

  // Recalculate estimate whenever pickup or destination changes
  useEffect(() => {
    if (pickup && destination) {
      ridesApi
        .estimate({
          origin: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
          destination: { address: destination.address, lat: destination.lat, lng: destination.lng },
        })
        .then(setEstimate)
        .catch(console.error);
    } else {
      setEstimate(null);
    }
  }, [pickup, destination]);

  const handlePickupChange = (lat: number, lng: number) => {
    setPickup((prev) => ({
      ...prev,
      lat,
      lng,
      address: `Ponto ajustado (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    }));
  };

  const handleSelectPopular = (place: KnownLocation) => {
    setDestination({
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    setCustomDestinationInput(place.name);
  };

  const handleCustomGeocode = async () => {
    if (!customDestinationInput.trim()) return;
    try {
      const res = await mapsApi.geocode(customDestinationInput.trim());
      setDestination({
        address: res.address,
        lat: res.lat,
        lng: res.lng,
      });
    } catch {
      setError('Não foi possível localizar o endereço informado.');
    }
  };

  const handleRequestRide = async () => {
    if (!destination) {
      setError('Selecione um destino para a corrida.');
      return;
    }
    if (!user) {
      navigate('/passenger/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ride = await ridesApi.request({
        origin: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
        destination: { address: destination.address, lat: destination.lat, lng: destination.lng },
        paymentMethod,
      });
      setActiveRide(ride);
    } catch (err: any) {
      setError(err.message || 'Falha ao solicitar corrida.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    if (!window.confirm('Tem certeza que deseja cancelar esta corrida?')) return;

    try {
      await ridesApi.cancel(activeRide.id, 'Cancelado pelo passageiro');
      setActiveRide(null);
    } catch (err: any) {
      setError(err.message || 'Falha ao cancelar corrida.');
    }
  };

  const handleSubmitRating = async () => {
    if (!activeRide) return;
    try {
      await ridesApi.rate(activeRide.id, ratingStars, ratingFeedback);
      setShowRatingModal(false);
      setActiveRide(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await passengersApi.updateMe({ name: editName, whatsapp: editWhatsapp });
      setShowProfileModal(false);
      alert('Perfil atualizado com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar perfil.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 py-3.5 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <img src="/vaicar_logo.png" alt="VaiCar" className="h-8 w-auto rounded object-contain" />
          </Link>
          <span className="text-sm font-bold text-white flex items-center gap-1">
            Painel do Passageiro • <span className="text-emerald-400">São Sebastião</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>{passenger?.name || profile?.displayName || 'Meu Perfil'}</span>
            </button>
          ) : (
            <Link
              to="/passenger/login"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white"
            >
              Entrar
            </Link>
          )}
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Control Panel */}
        <div className="lg:col-span-5 space-y-5">
          {/* PASSENGER BLOCKED ALERT */}
          {passenger?.isBlocked && (
            <div className="p-5 rounded-2xl bg-rose-950/80 border-2 border-rose-500 text-rose-200 text-xs space-y-2.5 shadow-2xl">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                <span>Conta Suspensa por Falta de Pagamento</span>
              </div>
              <p className="leading-relaxed text-slate-200">
                {passenger.blockedReason ||
                  'Sua conta está impossibilitada de solicitar novas corridas devido a pendências de pagamento com motoristas parceiros.'}
              </p>
              {passenger.hasUnpaidDebt && passenger.unpaidAmount && (
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-rose-800 font-semibold text-rose-300">
                  Débito pendente: R$ {passenger.unpaidAmount.toFixed(2)}
                </div>
              )}
              <div className="pt-1">
                <a
                  href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-lg"
                >
                  Regularizar Débito no WhatsApp Oficial
                </a>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ACTIVE RIDE CARD */}
          {activeRide ? (
            <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl p-6 shadow-2xl space-y-5 animate-pulse-border">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status da Viagem</span>
                <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700">
                  {activeRide.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Waiting timer if driver has arrived */}
              {activeRide.status === 'ARRIVED' && activeRide.waitingTimerStartedAt && (
                <WaitingTimer startedAt={activeRide.waitingTimerStartedAt} />
              )}

              {/* Driver info if assigned */}
              {activeRide.driverName ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
                  {activeRide.driverPhotoUrl ? (
                    <img
                      src={activeRide.driverPhotoUrl}
                      alt={activeRide.driverName}
                      className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                      <User className="w-7 h-7" />
                    </div>
                  )}
                  <div className="flex-1 text-xs">
                    <span className="text-sm font-extrabold text-white block">{activeRide.driverName}</span>
                    <span className="text-slate-300 block">
                      {activeRide.vehicle?.brand} {activeRide.vehicle?.model} • {activeRide.vehicle?.color}
                    </span>
                    <span className="text-emerald-400 font-mono font-bold block mt-0.5">
                      Placa: {activeRide.vehicle?.plate}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center text-xs text-slate-400 space-y-1">
                  <div className="flex justify-center">
                    <Car className="w-8 h-8 text-emerald-400 animate-bounce" />
                  </div>
                  <p className="font-semibold text-white">Buscando motoristas parceiros próximos...</p>
                  <p className="text-[11px]">Sua corrida está sendo enviada aos veículos na região.</p>
                </div>
              )}

              {/* Route Summary */}
              <div className="space-y-2 text-xs bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">{activeRide.origin.address}</span>
                </div>
                <div className="flex items-start gap-2 pt-2 border-t border-slate-800/80">
                  <Navigation className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">{activeRide.destination.address}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 text-emerald-400 font-bold">
                  <span>Valor: R$ {activeRide.fareAmount.toFixed(2)}</span>
                  <span>Forma: {activeRide.paymentMethod}</span>
                </div>
                {activeRide.discountApplied && (
                  <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span>🏷️</span>
                    <span>5% de Desconto de Passageiro Verificado incluso</span>
                  </div>
                )}
                <div className="text-[11px] text-amber-300/90 pt-1.5 border-t border-slate-800/80">
                  💵 <strong>Pagamento Direto:</strong> Pague diretamente ao motorista via Pix ou dinheiro.
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  {activeRide.status !== 'COMPLETED' && (
                    <button
                      onClick={handleCancelRide}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      Cancelar Corrida
                    </button>
                  )}
                  {activeRide.receiptId && (
                    <button
                      onClick={() => {
                        if (activeRide.receiptId) {
                          import('../../api/receipts.js').then(({ receiptsApi }) => {
                            receiptsApi.getById(activeRide.receiptId!).then(setReceiptToShow);
                          });
                        }
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" /> Ver Recibo
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReportTarget({ rideId: activeRide.id, targetName: activeRide.driverName });
                    setShowReportModal(true);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-950 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-800 text-slate-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Reportar Problema com o Motorista
                </button>
              </div>
            </div>
          ) : (
            /* RIDE REQUEST FORM */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Car className="w-4 h-4 text-emerald-400" /> Nova Corrida em São Sebastião
                </h3>
                <span className="text-[11px] text-emerald-400 font-medium">
                  {onlineDrivers.length} carros disponíveis
                </span>
              </div>

              {/* Pickup field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Ponto de Partida
                </label>
                <input
                  type="text"
                  value={pickup.address}
                  onChange={(e) => setPickup((p) => ({ ...p, address: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Dica: Você também pode arrastar o pino verde no mapa ao lado.
                </span>
              </div>

              {/* Destination search */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-rose-400" /> Para onde vamos?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customDestinationInput}
                    onChange={(e) => setCustomDestinationInput(e.target.value)}
                    placeholder="Digite a praia, rua ou bairro..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleCustomGeocode}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                  >
                    Buscar
                  </button>
                </div>
              </div>

              {/* Quick Popular Destinos */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Locais Frequentes:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {popularPlaces.map((place) => (
                    <button
                      key={place.name}
                      onClick={() => handleSelectPopular(place)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-800 text-[11px] text-slate-300 transition-colors"
                    >
                      {place.name.split('(')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Forma de Pagamento (Direto no Carro)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PIX')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'PIX'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <QrCode className="w-4 h-4" /> PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD_MACHINE')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'CARD_MACHINE'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> Cartão
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Banknote className="w-4 h-4" /> Dinheiro
                  </button>
                </div>
              </div>

              {/* Fare Estimate Box */}
              {estimate && (
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Tarifa Estimada:</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-emerald-400">
                          R$ {estimate.fareAmount.toFixed(2)}
                        </span>
                        {estimate.discountApplied && estimate.originalFareAmount && (
                          <span className="text-sm line-through text-slate-500">
                            R$ {estimate.originalFareAmount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-300 space-y-0.5">
                      <span className="block font-semibold">~{estimate.durationMinutes} min de viagem</span>
                      <span className="block text-[11px] text-slate-500">{estimate.distanceKm.toFixed(1)} km</span>
                    </div>
                  </div>

                  {estimate.discountApplied ? (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 flex items-center justify-between font-semibold">
                      <span>🏷️ 5% Desconto Passageiro Verificado incluso!</span>
                      <span>-R$ {estimate.discountAmount?.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>💡 Ganhe 5% de desconto em todas as corridas</span>
                      <Link to="/passenger/register" className="text-emerald-400 font-semibold hover:underline">
                        Anexar Antecedentes
                      </Link>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300/90 flex items-center gap-1.5">
                    <span>💵</span>
                    <span>Pagamento direto ao motorista (Pix ou dinheiro) no veículo.</span>
                  </div>
                </div>
              )}

              {/* Request CTA */}
              <button
                onClick={handleRequestRide}
                disabled={loading || !destination || Boolean(passenger?.isBlocked)}
                className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
                  passenger?.isBlocked
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-emerald-950/40 hover:scale-[1.01]'
                }`}
              >
                {loading
                  ? 'Solicitando...'
                  : passenger?.isBlocked
                  ? 'Conta Suspensa por Falta de Pagamento'
                  : 'Confirmar e Pedir VaiCar'}
              </button>
            </div>
          )}
        </div>

        {/* Right Map View */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <MapDisplay
            pickup={pickup}
            destination={destination}
            onPickupChange={handlePickupChange}
            drivers={onlineDrivers}
            driverLocation={
              activeRide?.driverId && onlineDrivers.find((d) => d.uid === activeRide.driverId)?.currentLocation
                ? onlineDrivers.find((d) => d.uid === activeRide.driverId)!.currentLocation
                : null
            }
            height="560px"
          />

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Corridas cobertas por seguro e monitoramento 24h em São Sebastião</span>
            </div>
            <span className="text-emerald-400 font-semibold">Taxa Zero VaiCar</span>
          </div>
        </div>
      </main>

      {/* RATING MODAL */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Viagem Concluída!</h3>
            <p className="text-xs text-slate-400">Como foi sua experiência com o motorista?</p>

            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingStars(star)}
                  className="p-1 text-2xl transition-transform hover:scale-125"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= ratingStars ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={ratingFeedback}
              onChange={(e) => setRatingFeedback(e.target.value)}
              placeholder="Comentário opcional sobre a corrida..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none h-20"
            />

            <button
              onClick={handleSubmitRating}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase"
            >
              Enviar Avaliação
            </button>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {receiptToShow && <ReceiptModal receipt={receiptToShow} onClose={() => setReceiptToShow(null)} />}

      {/* PROFILE EDIT MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Editar Perfil do Passageiro</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp</label>
                <input
                  type="text"
                  required
                  value={editWhatsapp}
                  onChange={(e) => setEditWhatsapp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        rideId={reportTarget?.rideId}
        targetRole="driver"
        targetName={reportTarget?.targetName}
      />
    </div>
  );
};
