import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { MapDisplay } from '../../components/MapDisplay.js';
import { PlaceAutocompleteInput } from '../../components/PlaceAutocompleteInput.js';
import { WaitingTimer } from '../../components/WaitingTimer.js';
import { ReceiptModal } from '../../components/ReceiptModal.js';
import { ridesApi, EstimateRideResult } from '../../api/rides.js';
import { mapsApi, KnownLocation } from '../../api/maps.js';
import { driversApi, PublicDriverMarker } from '../../api/drivers.js';
import { passengersApi } from '../../api/passengers.js';
import { storageApi } from '../../api/storage.js';
import { processImageFile } from '../../utils/imageUtils.js';
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
  MessageSquare,
  Camera,
  Upload,
  Crosshair,
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
  const [pickupInput, setPickupInput] = useState('Av. Dr. Altino Arantes, Centro, São Sebastião - SP');
  const [destination, setDestination] = useState<{ address: string; lat: number; lng: number } | null>({
    address: 'Av. Dr. Francisco Loup, Maresias, São Sebastião - SP',
    lat: -23.7915,
    lng: -45.5683,
  });
  const [destinationInput, setDestinationInput] = useState('Praia de Maresias (Entrada 8)');
  const [popularPlaces, setPopularPlaces] = useState<KnownLocation[]>([]);

  // Real device GPS states
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [hasUserGps, setHasUserGps] = useState(false);

  // Request passenger GPS location and reverse geocode
  const requestPassengerGps = useCallback(async () => {
    if (!navigator.geolocation) {
      setGpsError('Seu dispositivo ou navegador não suporta geolocalização.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setHasUserGps(true);
        try {
          const res = await mapsApi.reverseGeocode(lat, lng);
          const address = res.address || `Meu Local (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          setPickup({ lat, lng, address });
          setPickupInput(address);
          setGpsError(null);
        } catch (err) {
          console.warn('Reverse geocode failed, using coordinates:', err);
          const fallback = `Meu Local (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          setPickup({ lat, lng, address: fallback });
          setPickupInput(fallback);
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        console.warn('Passenger GPS error:', err);
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsError('Permissão de GPS necessária. Clique em "Permitir" para definir seu local de partida exato.');
        } else if (err.code === 2) {
          setGpsError('Sinal de GPS indisponível no dispositivo.');
        } else if (err.code === 3) {
          setGpsError('Tempo esgotado ao buscar GPS.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5000,
      }
    );
  }, []);

  // Request passenger GPS automatically on initial mount
  useEffect(() => {
    requestPassengerGps();
  }, [requestPassengerGps]);

  // Drivers and estimate
  const [onlineDrivers, setOnlineDrivers] = useState<PublicDriverMarker[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
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
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  const [checkingPayment, setCheckingPayment] = useState(false);
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
      setEditPhotoUrl(passenger.photoUrl || '');
    } else if (profile) {
      setEditName(profile.displayName);
      setEditWhatsapp(profile.whatsapp || '');
      setEditPhotoUrl(profile.photoUrl || '');
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

  // Polling active ride when present: continues polling until payment is approved by driver
  useEffect(() => {
    if (!activeRide) return;

    const interval = setInterval(async () => {
      try {
        const updated = await ridesApi.getById(activeRide.id);
        setActiveRide(updated);

        // Only stop polling when completed AND payment is approved by driver
        if (updated.status === 'COMPLETED') {
          const isApproved = updated.paymentApprovedByDriver || updated.paymentStatus === 'PAID';
          if (isApproved) {
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
        }
      } catch (err) {
        console.error('Ride poll error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status, activeRide?.paymentStatus, activeRide?.paymentApprovedByDriver]);

  const handleCheckPaymentStatus = async () => {
    if (!activeRide) return;
    setCheckingPayment(true);
    setError(null);
    try {
      const updated = await ridesApi.getById(activeRide.id);
      setActiveRide(updated);
      if (updated.status === 'COMPLETED' && (updated.paymentApprovedByDriver || updated.paymentStatus === 'PAID')) {
        if (!updated.ratingByPassenger) {
          setShowRatingModal(true);
        }
        if (updated.receiptId) {
          const { receiptsApi } = await import('../../api/receipts.js');
          receiptsApi.getById(updated.receiptId).then(setReceiptToShow).catch(console.error);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao consultar status de pagamento.');
    } finally {
      setCheckingPayment(false);
    }
  };

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

  const handleSelectPickup = useCallback((place: { address: string; lat: number; lng: number }) => {
    setPickup(place);
    setPickupInput(place.address);
    setError(null);
  }, []);

  const handlePickupMarkerChange = useCallback((lat: number, lng: number, address?: string) => {
    const finalAddress = address || `Ponto ajustado (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    setPickup({ lat, lng, address: finalAddress });
    setPickupInput(finalAddress);
    setError(null);
  }, []);

  const handleSelectDestination = useCallback((place: { address: string; lat: number; lng: number }) => {
    setDestination(place);
    setDestinationInput(place.address);
    setError(null);
  }, []);

  const handleDestinationMarkerChange = useCallback((lat: number, lng: number, address?: string) => {
    const finalAddress = address || `Destino no mapa (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    setDestination({ lat, lng, address: finalAddress });
    setDestinationInput(finalAddress);
    setError(null);
  }, []);

  const handleSelectPopular = (place: KnownLocation) => {
    setDestination({
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    setDestinationInput(place.name);
    setError(null);
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

    if (onlineDrivers.length === 0 && !selectedDriverId) {
      const proceed = window.confirm(
        'Atenção: Não há motoristas online no aplicativo neste momento em São Sebastião.\n\nClique em OK para registrar o pedido no sistema e aguardar um motorista conectar, ou Cancelar para acionar o grupo de motoristas no WhatsApp.'
      );
      if (!proceed) {
        window.open('https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3', '_blank');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const ride = await ridesApi.request({
        origin: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
        destination: { address: destination.address, lat: destination.lat, lng: destination.lng },
        paymentMethod,
        requestedDriverId: selectedDriverId || undefined,
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
      await passengersApi.updateMe({
        name: editName,
        whatsapp: editWhatsapp,
        photoUrl: editPhotoUrl || undefined,
      });
      setShowProfileModal(false);
      alert('Perfil atualizado com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar perfil.');
    }
  };

  const handleUploadPassengerPhoto = async (file: File) => {
    if (!user) return;
    setPhotoUploading(true);
    setError(null);
    try {
      const base64Data = await processImageFile(file);
      const res = await storageApi.uploadImage(base64Data, 'passengers', `${user.uid}_foto`);
      setEditPhotoUrl(res.url);
      await passengersApi.updateMe({ photoUrl: res.url });
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar foto de perfil.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const selectedDriver = estimate?.availableDrivers?.find((d) => d.driverId === selectedDriverId);
  const activeFareAmount = selectedDriver ? selectedDriver.fareAmount : (estimate?.fareAmount ?? 0);
  const activeOriginalFare = selectedDriver ? (selectedDriver.originalFareAmount ?? selectedDriver.fareAmount) : (estimate?.originalFareAmount ?? 0);
  const activeDiscountApplied = selectedDriver ? (selectedDriver.discountApplied ?? false) : (estimate?.discountApplied ?? false);

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
            activeRide.status === 'COMPLETED' && (!activeRide.paymentApprovedByDriver || activeRide.paymentStatus === 'PENDING') ? (
              <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl p-6 shadow-2xl space-y-5 animate-pulse-border">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Aguardando Motorista</span>
                  </div>
                  <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-700">
                    Pagamento Pendente
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-600/60 text-xs text-amber-200 space-y-2">
                  <div className="font-extrabold text-sm text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Viagem/Entrega Concluída • Confirmação de Pagamento</span>
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    O motorista/entregador parceiro precisa <strong>aprovar o recebimento do pagamento</strong> no aplicativo dele para que novas corridas ou entregas possam ser solicitadas.
                  </p>
                </div>

                {/* Driver Info */}
                {activeRide.driverName && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {activeRide.driverPhotoUrl ? (
                        <img
                          src={activeRide.driverPhotoUrl}
                          alt={activeRide.driverName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-amber-500 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-amber-400">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-bold text-white block">{activeRide.driverName}</span>
                        <span className="text-xs text-slate-400 block">
                          {activeRide.vehicle?.brand} {activeRide.vehicle?.model} ({activeRide.vehicle?.plate})
                        </span>
                        <span className="text-xs text-emerald-400 font-mono block mt-0.5">{activeRide.driverPhone}</span>
                      </div>
                    </div>

                    {activeRide.driverPhone && (
                      <a
                        href={`https://wa.me/55${activeRide.driverPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-colors"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                )}

                {/* Amount to pay */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Valor a Pagar / Pago:</span>
                    <span className="text-2xl font-black text-emerald-400">R$ {activeRide.fareAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 pt-1.5 border-t border-slate-800">
                    <span>Forma de Pagamento:</span>
                    <span className="font-bold text-white">{activeRide.paymentMethod}</span>
                  </div>

                  {activeRide.paymentMethod === 'PIX' && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-amber-300 leading-relaxed">
                      💡 <strong>Pagamento via Pix:</strong> Efetue a transferência diretamente para a chave Pix informada pelo motorista e peça para ele clicar em <strong>"Confirmar Pagamento Recebido"</strong> no celular dele.
                    </div>
                  )}
                </div>

                {/* Verification in real time */}
                <div className="space-y-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    <span>Verificando confirmação do motorista automaticamente em tempo real...</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckPaymentStatus}
                    disabled={checkingPayment}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all hover:scale-[1.01]"
                  >
                    {checkingPayment ? 'Verificando...' : '🔄 Já Realizei o Pagamento • Verificar Agora'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReportTarget({ rideId: activeRide.id, targetName: activeRide.driverName });
                      setShowReportModal(true);
                    }}
                    className="w-full py-2 rounded-xl bg-slate-950 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-800 text-slate-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    Relatar Problema / Suporte
                  </button>
                </div>
              </div>
            ) : (
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
                    {activeRide.status === 'COMPLETED' && (
                      <button
                        onClick={() => setActiveRide(null)}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                      >
                        Pedir Nova Corrida
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
            )
          ) : (
            /* RIDE REQUEST FORM */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Car className="w-4 h-4 text-emerald-400" /> Nova Corrida em São Sebastião
                </h3>
                <span className={`text-[11px] font-semibold ${onlineDrivers.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {onlineDrivers.length > 0 ? `${onlineDrivers.length} veículos online` : '0 online no momento'}
                </span>
              </div>

              {/* GPS status / error alert if permission needed */}
              {gpsError && (
                <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{gpsError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={requestPassengerGps}
                    disabled={gpsLoading}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition-colors flex items-center gap-1.5"
                  >
                    <Crosshair className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                    Tentar GPS Novamente
                  </button>
                </div>
              )}

              {/* Pickup PlaceAutocompleteInput */}
              <PlaceAutocompleteInput
                label="Ponto de Partida (Embarque)"
                placeholder="Digite a rua, bairro ou número..."
                value={pickupInput}
                onChange={setPickupInput}
                onSelectPlace={handleSelectPickup}
                onUseCurrentLocation={requestPassengerGps}
                isLocating={gpsLoading}
                icon="pickup"
                helperText={
                  hasUserGps
                    ? '📍 Localização exata obtida via GPS do dispositivo. Arraste o pino verde para ajustar.'
                    : "Arraste o pino verde no mapa ou digite o endereço de partida."
                }
              />
              {!pickupInput.trim() && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPickup({ address: 'Av. Dr. Altino Arantes, Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 });
                      setPickupInput('Av. Dr. Altino Arantes, Centro, São Sebastião - SP');
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500 text-slate-300 hover:text-emerald-300 transition-colors"
                  >
                    📍 Definir Centro Histórico
                  </button>
                  <button
                    type="button"
                    onClick={requestPassengerGps}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900 text-emerald-300 font-semibold transition-colors flex items-center gap-1"
                  >
                    🎯 Usar Meu GPS
                  </button>
                </div>
              )}

              {/* Destination PlaceAutocompleteInput */}
              <PlaceAutocompleteInput
                label="Para onde vamos? (Destino)"
                placeholder="Digite a praia, rua, condomínio ou clique no mapa..."
                value={destinationInput}
                onChange={setDestinationInput}
                onSelectPlace={handleSelectDestination}
                icon="destination"
                helperText="Busca inteligente Google Maps. Você também pode arrastar o pino vermelho ou clicar no mapa."
              />

              {/* Quick Popular Destinos (Shortcuts) */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Atalhos Rápidos de São Sebastião:
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

              {/* Driver Selection & Price Comparison List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Escolha o Motorista por Preço e Proximidade:
                  </label>
                  <span className={`text-[11px] font-semibold ${(estimate?.availableDrivers?.length || onlineDrivers.length) > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {(estimate?.availableDrivers?.length || onlineDrivers.length) > 0
                      ? `${estimate?.availableDrivers?.length || onlineDrivers.length} disponíveis na cidade`
                      : '0 online no momento'}
                  </span>
                </div>

                {onlineDrivers.length === 0 && (!estimate?.availableDrivers || estimate.availableDrivers.length === 0) ? (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Nenhum motorista ou entregador online agora</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Nenhum profissional está com o aplicativo aberto neste instante em São Sebastião. O mapa e a lista exibem apenas motoristas reais cadastrados e aprovados quando estão online. Você pode acionar o grupo oficial no WhatsApp:
                    </p>
                    <a
                      href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-lg"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Pedir no Grupo WhatsApp dos Motoristas
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {/* Automatic (Best Price / Fastest) Option */}
                    <div
                      onClick={() => setSelectedDriverId(null)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedDriverId === null
                          ? 'bg-emerald-950/70 border-emerald-500 shadow-md shadow-emerald-950/40 text-white'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-base shrink-0">
                          ⚡
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold block">Mais Rápido / Melhor Tarifa</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 font-bold uppercase">
                              Automático
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Chama o primeiro motorista disponível mais próximo
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {estimate ? (
                          <span className="text-xs font-extrabold text-emerald-400 block">
                            A partir de R$ {estimate.fareAmount.toFixed(2)}
                          </span>
                        ) : null}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                            selectedDriverId === null
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {selectedDriverId === null ? 'Selecionado' : 'Escolher'}
                        </span>
                      </div>
                    </div>

                    {/* If estimate with availableDrivers is loaded, show each driver with their individual fare */}
                    {estimate?.availableDrivers && estimate.availableDrivers.length > 0 ? (
                      estimate.availableDrivers.map((d) => {
                        const isSelected = selectedDriverId === d.driverId;
                        const isBike = d.vehicle?.type === 'bicycle';
                        const isMoto = d.vehicle?.type === 'motorcycle' || d.isCourier;
                        return (
                          <div
                            key={d.driverId}
                            onClick={() => setSelectedDriverId(d.driverId)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-950/70 border-emerald-500 shadow-md shadow-emerald-950/40 text-white'
                                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {d.photoUrl ? (
                                <img
                                  src={d.photoUrl}
                                  alt={d.name}
                                  className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-sm shrink-0">
                                  {isBike ? '🚲' : isMoto ? '🛵' : '🚗'}
                                </div>
                              )}
                              <div className="text-left min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-white truncate max-w-[130px]">{d.name}</span>
                                  <span className="text-[10px] text-amber-400 font-semibold flex items-center">
                                    ⭐ {d.rating.toFixed(1)}
                                  </span>
                                  {d.isFixedRoute && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                                      🏷️ Rota Fixa
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                                  {d.vehicle?.brand} {d.vehicle?.model} ({d.vehicle?.color})
                                  {d.vehicle?.plate ? ` • ${d.vehicle.plate}` : ''}
                                </span>
                                <span className="text-[10px] text-emerald-400 font-medium block">
                                  📍 {d.distanceToPickupKm.toFixed(1)} km • ~{d.etaMinutes} min até você
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 ml-2">
                              <div className="text-base font-extrabold text-emerald-400 leading-none">
                                R$ {d.fareAmount.toFixed(2)}
                              </div>
                              {d.discountApplied && d.originalFareAmount && d.originalFareAmount > d.fareAmount && (
                                <span className="text-[10px] line-through text-slate-500 block">
                                  R$ {d.originalFareAmount.toFixed(2)}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                                  isSelected
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {isSelected ? 'Escolhido' : 'Escolher'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      /* When no destination selected yet, list online drivers */
                      onlineDrivers.map((d) => {
                        const isSelected = selectedDriverId === d.uid;
                        const isBike = d.vehicle?.type === 'bicycle';
                        const isMoto = d.vehicle?.type === 'motorcycle' || d.isCourier;
                        return (
                          <div
                            key={d.uid}
                            onClick={() => setSelectedDriverId(d.uid)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-950/70 border-emerald-500 shadow-md shadow-emerald-950/40 text-white'
                                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {d.photoUrl ? (
                                <img
                                  src={d.photoUrl}
                                  alt={d.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm shrink-0">
                                  {isBike ? '🚲' : isMoto ? '🛵' : '🚗'}
                                </div>
                              )}
                              <div className="text-left">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white">{d.name}</span>
                                  <span className="text-[10px] text-amber-400 font-semibold flex items-center">
                                    ⭐ {d.rating.toFixed(1)}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block truncate max-w-[200px]">
                                  {d.vehicle.brand} {d.vehicle.model} ({d.vehicle.color})
                                  {d.vehicle.plate ? ` • ${d.vehicle.plate}` : ''}
                                </span>
                                <span className="text-[9px] text-slate-500 block">
                                  Digite o destino para ver a tarifa deste motorista
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {isSelected ? 'Escolhido' : 'Escolher'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
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
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        {selectedDriver ? `Tarifa de ${selectedDriver.name}:` : 'Tarifa Estimada (A partir de):'}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-emerald-400">
                          R$ {activeFareAmount.toFixed(2)}
                        </span>
                        {activeDiscountApplied && activeOriginalFare > activeFareAmount && (
                          <span className="text-sm line-through text-slate-500">
                            R$ {activeOriginalFare.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-300 space-y-0.5">
                      <span className="block font-semibold">~{estimate.durationMinutes} min de viagem</span>
                      <span className="block text-[11px] text-slate-500">{estimate.distanceKm.toFixed(1)} km</span>
                    </div>
                  </div>

                  {activeDiscountApplied ? (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 flex items-center justify-between font-semibold">
                      <span>🏷️ 5% Desconto Passageiro Verificado incluso!</span>
                      <span>-R$ {(activeOriginalFare - activeFareAmount).toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>💡 Ganhe 5% de desconto em todas as corridas</span>
                      <Link to="/passenger/register" className="text-emerald-400 font-semibold hover:underline">
                        Anexar Antecedentes
                      </Link>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Base de cálculo:</span>
                    {selectedDriver ? (
                      selectedDriver.isFixedRoute ? (
                        <span className="font-semibold text-emerald-400">
                          Preço Fixo da Rota ({selectedDriver.fixedRouteName})
                        </span>
                      ) : (
                        <span className="font-mono text-emerald-400 font-semibold">
                          Mínimo R$ {selectedDriver.customPricing?.minimumFare.toFixed(2)} + R$ {selectedDriver.customPricing?.perKmRate.toFixed(2)}/km
                          {selectedDriver.customPricing?.perMinuteRate ? ` + R$ ${selectedDriver.customPricing.perMinuteRate.toFixed(2)}/min` : ''}
                        </span>
                      )
                    ) : (
                      <span className="font-mono text-emerald-400 font-semibold">
                        Piso VaiCar: R$ 10,00 mín + R$ 1,00/km (cada motorista define sua tarifa)
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300/90 flex items-center gap-1.5">
                    <span>💵</span>
                    <span>Pagamento direto ao motorista (Pix, cartão ou dinheiro) no veículo.</span>
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
                  : selectedDriver
                  ? `Chamar ${selectedDriver.name} • R$ ${selectedDriver.fareAmount.toFixed(2)}`
                  : estimate
                  ? `Confirmar e Pedir VaiCar • R$ ${estimate.fareAmount.toFixed(2)}`
                  : 'Confirmar e Pedir VaiCar'}
              </button>
            </div>
          )}
        </div>

        {/* Right Map View */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-slate-200 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">📍</span>
              <span className="leading-snug">
                <strong className="text-emerald-400">Pinos no Mapa:</strong> Você pode <strong>arrastar o pino verde (Partida)</strong> e o <strong>pino vermelho (Destino)</strong> para qualquer rua, ou clicar diretamente no mapa!
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPickup({ address: 'Av. Dr. Altino Arantes, Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 });
                setPickupInput('Av. Dr. Altino Arantes, Centro, São Sebastião - SP');
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 font-bold shrink-0 transition-colors whitespace-nowrap"
            >
              Centralizar Centro
            </button>
          </div>

          <MapDisplay
            pickup={pickup}
            destination={destination}
            onPickupChange={handlePickupMarkerChange}
            onDestinationChange={handleDestinationMarkerChange}
            drivers={onlineDrivers}
            selectedDriverId={selectedDriverId}
            onDriverSelect={(d) => setSelectedDriverId(d.uid)}
            driverLocation={
              activeRide?.driverId && onlineDrivers.find((d) => d.uid === activeRide.driverId)?.currentLocation
                ? onlineDrivers.find((d) => d.uid === activeRide.driverId)!.currentLocation
                : null
            }
            height="560px"
          />

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Serviço regulamentado pela <strong className="text-white">Lei Federal nº 13.640/2018</strong> (Art. 11-A) e diretrizes municipais. Pagamento 100% direto ao condutor.
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link to="/terms" className="text-emerald-400 hover:text-emerald-300 underline font-medium">
                Termos & Responsabilidades
              </Link>
              <span className="text-slate-600">•</span>
              <Link to="/privacy" className="text-emerald-400 hover:text-emerald-300 underline font-medium">
                Privacidade
              </Link>
            </div>
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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRatingModal(false);
                  setActiveRide(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Pular
              </button>
              <button
                onClick={handleSubmitRating}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase transition-colors"
              >
                Enviar Avaliação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {receiptToShow && <ReceiptModal receipt={receiptToShow} onClose={() => setReceiptToShow(null)} />}

      {/* PROFILE EDIT MODAL */}
      {showProfileModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200"
            onClick={() => setShowProfileModal(false)}
          >
            <div
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 relative my-auto animate-in zoom-in-95 duration-150 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-base font-bold text-white">Editar Perfil do Passageiro</h3>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Photo Upload Section */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 overflow-hidden shrink-0">
                      {editPhotoUrl ? (
                        <img src={editPhotoUrl} alt={editName} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Foto de Perfil</span>
                      <span className="text-[10px] text-slate-400">Visível para motoristas</span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="passenger-photo-upload"
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      {photoUploading ? 'Salvando...' : 'Alterar Foto'}
                    </label>
                    <input
                      id="passenger-photo-upload"
                      type="file"
                      accept="image/*"
                      disabled={photoUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadPassengerPhoto(file);
                      }}
                      className="hidden"
                    />
                  </div>
                </div>

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
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
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
