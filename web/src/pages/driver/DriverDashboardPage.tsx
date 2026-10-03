import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { WaitingTimer } from '../../components/WaitingTimer.js';
import { ReceiptModal } from '../../components/ReceiptModal.js';
import { MapDisplay } from '../../components/MapDisplay.js';
import { driversApi } from '../../api/drivers.js';
import { ridesApi } from '../../api/rides.js';
import { storageApi } from '../../api/storage.js';
import { processDocumentOrImageFile } from '../../utils/imageUtils.js';
import { zones } from '../../../../shared/src/tokens.js';
import { DriverProfile, Ride, Receipt } from '../../../../shared/src/types.js';
import { DriverPricingModal } from '../../components/DriverPricingModal.js';
import {
  Car,
  Bike,
  Power,
  Shield,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Navigation,
  Phone,
  DollarSign,
  Clock,
  Star,
  CheckCircle,
  AlertCircle,
  User,
  History,
  FileText,
  ArrowRight,
  AlertTriangle,
  X,
  ExternalLink,
  Upload,
  Volume2,
  Camera,
  Check,
  Crosshair,
  Menu,
  ChevronRight,
  ArrowLeft,
  Settings,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { ReportModal } from '../../components/ReportModal.js';

// Calculates haversine distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Estimates urban driving time in minutes (~28 km/h on coastal avenues)
function estimateDrivingMinutes(distanceKm: number): number {
  if (distanceKm <= 0.2) return 1;
  return Math.max(2, Math.round((distanceKm / 28) * 60));
}

// Formats short neighborhood / landmark / city name
function formatShortAddress(address?: string): string {
  if (!address) return 'Local';
  const knownZones = [
    'Centro', 'Maresias', 'Boiçucanga', 'Camburi', 'Juquehy',
    'São Francisco', 'Topolândia', 'Barequeçaba', 'Guaecá',
    'Toque-Toque Grande', 'Toque-Toque Pequeno', 'Barra do Sahy',
    'Barra do Una', 'Boraceia', 'Enseada', 'Cigarras', 'Portal da Olaria',
    'Itatinga', 'Varadouro', 'Pontal da Cruz', 'Praia Grande'
  ];
  for (const zone of knownZones) {
    if (address.toLowerCase().includes(zone.toLowerCase())) {
      return zone;
    }
  }
  const parts = address.split(/[-–,]/).map((p) => p.trim());
  if (parts.length > 1 && parts[1].length > 2 && parts[1].length < 25) {
    return parts[1];
  }
  return parts[0].slice(0, 24);
}

function formatRouteSummary(origin?: string, destination?: string): string {
  const o = formatShortAddress(origin);
  const d = formatShortAddress(destination);
  return `${o} → ${d}`;
}

// Synthesizes an audible incoming ride chime without external audio file dependencies
function playIncomingRideChime() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15); // A5
    gain2.gain.setValueAtTime(0.35, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch {
    // AudioContext blocked
  }
}

export const DriverDashboardPage: React.FC = () => {
  const { user, profile, driver: authDriver, logout } = useAuth();
  const navigate = useNavigate();

  const [driver, setDriver] = useState<DriverProfile | null>(authDriver);
  const [isOnline, setIsOnline] = useState<boolean>(authDriver?.isOnline || false);
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [receiptToShow, setReceiptToShow] = useState<Receipt | null>(null);

  // Real GPS State
  const [driverGps, setDriverGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  // Active route map view mode: 'to_passenger' (navigating to pickup) or 'full_trip' (origin -> destination)
  const [driverRouteMode, setDriverRouteMode] = useState<'to_passenger' | 'full_trip'>('to_passenger');

  // Cockpit Drawer State (Secondary Menu ☰)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'menu' | 'ratings' | 'earnings' | 'history' | 'settings'>('menu');

  // Arrived 4-Minute Tolerance Countdown State
  const [arrivedSecondsRemaining, setArrivedSecondsRemaining] = useState<number>(240);

  // Incoming ride alert state
  const [dismissedRideIds, setDismissedRideIds] = useState<string[]>([]);
  const [incomingCountdown, setIncomingCountdown] = useState<number>(30);
  const playedChimesRef = useRef<Set<string>>(new Set());

  // Passenger rating modal state (driver rating passenger)
  const [showPassengerRatingModal, setShowPassengerRatingModal] = useState<boolean>(false);
  const [completedRideToRate, setCompletedRideToRate] = useState<Ride | null>(null);
  const [passengerStars, setPassengerStars] = useState<number>(5);
  const [passengerFeedback, setPassengerFeedback] = useState<string>('');
  const [passengerFeedbackTags, setPassengerFeedbackTags] = useState<string[]>([]);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);

  // Profile and Documents Editor modal state
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Profile form state
  const [editName, setEditName] = useState<string>('');
  const [editWhatsapp, setEditWhatsapp] = useState<string>('');
  const [editCnhNumber, setEditCnhNumber] = useState<string>('');
  const [editBrand, setEditBrand] = useState<string>('');
  const [editModel, setEditModel] = useState<string>('');
  const [editYear, setEditYear] = useState<string>('');
  const [editColor, setEditColor] = useState<string>('');
  const [editPlate, setEditPlate] = useState<string>('');
  const [editVehicleType, setEditVehicleType] = useState<'car' | 'motorcycle' | 'van' | 'bicycle'>('car');
  const [editZones, setEditZones] = useState<string[]>([]);

  // Document files being uploaded/updated
  const [docCnhUrl, setDocCnhUrl] = useState<string>('');
  const [docCrlvUrl, setDocCrlvUrl] = useState<string>('');
  const [docProofAddressUrl, setDocProofAddressUrl] = useState<string>('');
  const [docCriminalUrl, setDocCriminalUrl] = useState<string>('');
  const [docUploading, setDocUploading] = useState<string | null>(null);

  // Plan change modal state
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState<'monthly_100' | 'weekly_percent_10'>('monthly_100');
  const [planChangeLoading, setPlanChangeLoading] = useState<boolean>(false);
  const [planSuccessMessage, setPlanSuccessMessage] = useState<string | null>(null);

  // Payment completion & approval states
  const [showPaymentCompletionModal, setShowPaymentCompletionModal] = useState<boolean>(false);
  const [paymentApprovalSuccessMessage, setPaymentApprovalSuccessMessage] = useState<string | null>(null);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportTarget, setReportTarget] = useState<{ rideId?: string; targetName?: string; amount?: number } | null>(null);

  // Custom Pricing modal state
  const [showPricingModal, setShowPricingModal] = useState<boolean>(false);

  // Driver emergency cancellation state
  const [showDriverEmergencyModal, setShowDriverEmergencyModal] = useState<boolean>(false);
  const [driverEmergencyType, setDriverEmergencyType] = useState<string>('Pane mecânica no veículo');
  const [driverEmergencyDetails, setDriverEmergencyDetails] = useState<string>('');
  const [driverEmergencySubmitting, setDriverEmergencySubmitting] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch driver profile
  const loadDriverProfile = useCallback(async () => {
    try {
      const data = await driversApi.getMe();
      setDriver(data);
      setIsOnline(data.isOnline);
      setError(null);
    } catch (err: any) {
      console.warn('Driver profile fetch notice:', err);
      if (authDriver) {
        setDriver(authDriver);
        setIsOnline(authDriver.isOnline);
        setError(null);
      } else {
        setDriver(null);
        setError(err.message || 'Perfil de motorista não encontrado.');
      }
    } finally {
      setLoading(false);
    }
  }, [authDriver]);

  useEffect(() => {
    if (authDriver && !driver) {
      setDriver(authDriver);
      setIsOnline(authDriver.isOnline);
    }
  }, [authDriver, driver]);

  useEffect(() => {
    loadDriverProfile();
  }, [loadDriverProfile]);

  // Check active ride on load
  const loadActiveRide = useCallback(async () => {
    try {
      const active = await driversApi.getActiveRide();
      setActiveRide(active);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    loadActiveRide();
    driversApi.getRides().then(setRideHistory).catch(console.error);
  }, [loadActiveRide]);

  // Active ride state sync interval
  useEffect(() => {
    if (!activeRide) return;

    const interval = setInterval(async () => {
      try {
        const updated = await ridesApi.getById(activeRide.id);
        setActiveRide(updated);
        if (updated.status === 'COMPLETED' && updated.receiptId) {
          import('../../api/receipts.js').then(({ receiptsApi }) => {
            receiptsApi.getById(updated.receiptId!).then(setReceiptToShow).catch(console.error);
          });
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Ride poll error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeRide]);

  // Stream available rides and active ride state when online
  useEffect(() => {
    if (!isOnline) {
      setAvailableRides([]);
      return;
    }

    const fetchUpdates = async () => {
      try {
        const [rides, active] = await Promise.all([
          driversApi.getAvailableRides(),
          driversApi.getActiveRide().catch(() => null),
        ]);
        if (active) {
          setActiveRide(active);
          setAvailableRides([]);
          return;
        }
        setAvailableRides(rides);
      } catch (err) {
        console.error('Available rides error:', err);
      }
    };

    fetchUpdates();
    const interval = setInterval(fetchUpdates, 2500);
    return () => clearInterval(interval);
  }, [isOnline]);

  // Find current incoming ride alert (first available ride not dismissed)
  const incomingRide = useMemo(() => {
    if (!isOnline || activeRide) return null;
    return availableRides.find((r) => !dismissedRideIds.includes(r.id)) || null;
  }, [isOnline, activeRide, availableRides, dismissedRideIds]);

  // Audio chime & 30s countdown for incoming ride alert pop-up
  useEffect(() => {
    if (!incomingRide) {
      setIncomingCountdown(30);
      return;
    }

    if (!playedChimesRef.current.has(incomingRide.id)) {
      playedChimesRef.current.add(incomingRide.id);
      playIncomingRideChime();
    }

    setIncomingCountdown(30);
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed++;
      if (elapsed % 5 === 0) {
        playIncomingRideChime();
      }
      setIncomingCountdown((prev) => {
        if (prev <= 1) {
          handleDeclineRide(incomingRide.id);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingRide?.id]);

  // Request Driver GPS on mount (and on-demand)
  const requestDriverGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Seu dispositivo ou navegador não suporta geolocalização.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const heading = pos.coords.heading || 0;
        setDriverGps({ lat, lng });
        setGpsError(null);
        if (isOnline) {
          driversApi.updateLocation(lat, lng, heading).catch(console.error);
        }
      },
      (err) => {
        console.warn('Driver GPS prompt error:', err);
        if (err.code === 1) {
          setGpsError('Permissão de GPS necessária. Clique em "Ativar GPS" para permitir que o app mostre sua localização exata.');
        } else if (err.code === 2) {
          setGpsError('Sinal de GPS indisponível no dispositivo.');
        } else if (err.code === 3) {
          setGpsError('Tempo esgotado ao buscar localização GPS.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
  }, [isOnline]);

  // Initialize driverGps from driver.currentLocation if available
  useEffect(() => {
    if (driver?.currentLocation?.lat && driver?.currentLocation?.lng) {
      setDriverGps((curr) => curr || {
        lat: driver.currentLocation!.lat,
        lng: driver.currentLocation!.lng,
      });
    }
  }, [driver?.currentLocation]);

  // Request driver GPS on initial mount so browser prompts for permission right away
  useEffect(() => {
    requestDriverGps();
  }, [requestDriverGps]);

  // Real device GPS geolocation while online OR during an active ride (continuous tracking)
  useEffect(() => {
    if (!isOnline && !activeRide) return;

    if (!navigator.geolocation) {
      setGpsError('Seu dispositivo ou navegador não suporta geolocalização.');
      return;
    }

    const reportLocation = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const heading = pos.coords.heading || 0;
      setDriverGps({ lat, lng });
      setGpsError(null);
      driversApi.updateLocation(lat, lng, heading).catch(console.error);
    };

    const handleGpsError = (err: GeolocationPositionError) => {
      console.warn('Geolocation notice:', err.message);
      if (err.code === 1) {
        setGpsError('Permissão de GPS negada. Ative a localização para que os passageiros vejam sua posição exata no mapa.');
      }
    };

    navigator.geolocation.getCurrentPosition(reportLocation, handleGpsError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    });

    const watchId = navigator.geolocation.watchPosition(reportLocation, handleGpsError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });

    const periodicSync = setInterval(() => {
      navigator.geolocation.getCurrentPosition(reportLocation, () => {}, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10000,
      });
    }, 10000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(periodicSync);
    };
  }, [isOnline, activeRide?.id]);

  // 4-Minute Arrival Tolerance Countdown Effect
  useEffect(() => {
    if (activeRide?.status !== 'ARRIVED') {
      setArrivedSecondsRemaining(240);
      return;
    }

    const startIso = activeRide.waitingTimerStartedAt || activeRide.arrivedAt || new Date().toISOString();
    const startMs = new Date(startIso).getTime();

    const updateRemaining = () => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      setArrivedSecondsRemaining(Math.max(0, 240 - elapsed));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [activeRide?.status, activeRide?.waitingTimerStartedAt, activeRide?.arrivedAt]);

  const arrivedMinutes = Math.floor(arrivedSecondsRemaining / 60);
  const arrivedSecs = arrivedSecondsRemaining % 60;
  const formattedArrivedTime = `${String(arrivedMinutes).padStart(2, '0')}:${String(arrivedSecs).padStart(2, '0')}`;

  const effectiveDriverLocation = useMemo(() => {
    return driverGps || (
      driver?.currentLocation?.lat && driver?.currentLocation?.lng
        ? { lat: driver.currentLocation.lat, lng: driver.currentLocation.lng }
        : null
    );
  }, [driverGps, driver?.currentLocation]);

  const distToPickupKm = useMemo(() => {
    const target = incomingRide?.origin || (activeRide?.status === 'DRIVER_ARRIVING' ? activeRide.origin : null);
    if (!target || !effectiveDriverLocation) return null;
    return calculateDistanceKm(effectiveDriverLocation.lat, effectiveDriverLocation.lng, target.lat, target.lng);
  }, [incomingRide?.origin, activeRide?.status, activeRide?.origin, effectiveDriverLocation]);

  const etaToPickupMin = useMemo(() => {
    if (distToPickupKm === null) return 5;
    return estimateDrivingMinutes(distToPickupKm);
  }, [distToPickupKm]);

  const pendingPayments = useMemo(() => {
    return rideHistory.filter(
      (r) => r.status === 'COMPLETED' && (r.paymentStatus === 'PENDING' || r.paymentApprovedByDriver === false)
    );
  }, [rideHistory]);

  const handleToggleOnline = async () => {
    if (!driver) return;
    if (driver.status !== 'APPROVED') {
      setError(`Sua conta está com status: ${driver.status}. Aguarde a aprovação do administrador.`);
      return;
    }

    // Prompt GPS permission if going online
    if (!isOnline && navigator.geolocation) {
      requestDriverGps();
    }

    setError(null);
    setActionLoading(true);
    try {
      const res = await driversApi.toggleOnline(!isOnline);
      setIsOnline(res.isOnline);
    } catch (err: any) {
      setError(err.message || 'Falha ao alterar status online.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRide = async (rideId: string) => {
    setError(null);
    setActionLoading(true);
    try {
      const accepted = await ridesApi.accept(rideId);
      setActiveRide(accepted);
      setAvailableRides([]);
      setDriverRouteMode('to_passenger');
      requestDriverGps();
    } catch (err: any) {
      setError(err.message || 'Não foi possível aceitar a corrida.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRide = async (rideId: string) => {
    setDismissedRideIds((curr) => [...curr, rideId]);
    try {
      await ridesApi.decline(rideId);
    } catch {
      // ignore
    }
  };

  const handleMarkArrived = async () => {
    if (!activeRide) return;
    setActionLoading(true);
    try {
      const updated = await ridesApi.arrived(activeRide.id);
      setActiveRide(updated);
    } catch (err: any) {
      setError(err.message || 'Falha ao marcar chegada.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    setActionLoading(true);
    try {
      const updated = await ridesApi.start(activeRide.id);
      setActiveRide(updated);
    } catch (err: any) {
      setError(err.message || 'Falha ao iniciar viagem.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDriverCancelPreRide = async () => {
    if (!activeRide) return;
    const reason = window.prompt(
      'Motivo do cancelamento (ex: Passageiro não compareceu no embarque / Imprevisto no trajeto):',
      'Passageiro não compareceu no ponto de embarque'
    );
    if (!reason || !reason.trim()) return;

    setActionLoading(true);
    setError(null);
    try {
      await ridesApi.cancel(activeRide.id, reason.trim());
      setActiveRide(null);
      alert('Corrida cancelada.');
      loadDriverProfile();
    } catch (err: any) {
      setError(err.message || 'Falha ao cancelar corrida.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDriverEmergencyCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRide) return;
    if (!driverEmergencyDetails.trim()) {
      setError('Por favor, informe a justificativa detalhada da ocorrência.');
      return;
    }
    setDriverEmergencySubmitting(true);
    setError(null);
    try {
      const fullReason = `${driverEmergencyType}: ${driverEmergencyDetails.trim()}`;
      await ridesApi.cancel(activeRide.id, fullReason, true);
      setShowDriverEmergencyModal(false);
      setDriverEmergencyDetails('');
      setActiveRide(null);
      alert('Cancelamento emergencial registrado com sucesso. A equipe do VaiCar foi notificada da ocorrência.');
      loadDriverProfile();
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar cancelamento emergencial.');
    } finally {
      setDriverEmergencySubmitting(false);
    }
  };

  const handleCompleteRide = async (paymentApproved: boolean = true) => {
    if (!activeRide) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await ridesApi.complete(activeRide.id, paymentApproved);
      setActiveRide(res.ride);
      if (res.receipt) {
        setReceiptToShow(res.receipt);
      }
      setShowPaymentCompletionModal(false);
      // Trigger passenger rating modal for driver to rate passenger (Item 3)
      setCompletedRideToRate(res.ride);
      setShowPassengerRatingModal(true);

      if (paymentApproved) {
        setPaymentApprovalSuccessMessage(
          `Pagamento de R$ ${res.ride.fareAmount.toFixed(2)} confirmado com sucesso! Recibo gerado e passageiro liberado.`
        );
      } else {
        setPaymentApprovalSuccessMessage(
          `Viagem finalizada com pagamento pendente. O passageiro permanecerá bloqueado na plataforma até que você aprove o recebimento.`
        );
      }
      setTimeout(() => setPaymentApprovalSuccessMessage(null), 8000);
      // Reload history and profile
      loadDriverProfile();
      driversApi.getRides().then(setRideHistory).catch(console.error);
    } catch (err: any) {
      setError(err.message || 'Falha ao finalizar viagem.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovePayment = async (rideId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await ridesApi.approvePayment(rideId);
      if (activeRide && activeRide.id === rideId) {
        setActiveRide(res.ride);
      }
      if (res.receipt) {
        setReceiptToShow(res.receipt);
      }
      setPaymentApprovalSuccessMessage(
        `Pagamento de R$ ${res.ride.fareAmount.toFixed(2)} aprovado com sucesso! Recibo oficial emitido e passageiro desbloqueado.`
      );
      setTimeout(() => setPaymentApprovalSuccessMessage(null), 8000);
      loadDriverProfile();
      driversApi.getRides().then(setRideHistory).catch(console.error);
    } catch (err: any) {
      setError(err.message || 'Falha ao aprovar pagamento.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitPassengerRating = async () => {
    if (!completedRideToRate) return;
    setRatingSubmitting(true);
    try {
      const tagsStr = passengerFeedbackTags.length > 0 ? `[${passengerFeedbackTags.join(', ')}] ` : '';
      const finalFeedback = (tagsStr + passengerFeedback).trim();
      await ridesApi.ratePassenger(completedRideToRate.id, passengerStars, finalFeedback || undefined);
      setShowPassengerRatingModal(false);
      setCompletedRideToRate(null);
      setPassengerStars(5);
      setPassengerFeedback('');
      setPassengerFeedbackTags([]);
    } catch (err: any) {
      console.error('Rate passenger error:', err);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleOpenProfileModal = () => {
    if (driver) {
      setEditName(driver.name || '');
      setEditWhatsapp(driver.whatsapp || '');
      setEditCnhNumber(driver.cnhNumber || '');
      setEditBrand(driver.vehicle?.brand || '');
      setEditModel(driver.vehicle?.model || '');
      setEditYear(driver.vehicle?.year ? String(driver.vehicle.year) : '');
      setEditColor(driver.vehicle?.color || '');
      setEditPlate(driver.vehicle?.plate || '');
      setEditVehicleType(driver.vehicle?.type || 'car');
      setEditZones(driver.operatingZones || ['Centro']);
      setDocCnhUrl(driver.cnhUrl || '');
      setDocCrlvUrl(driver.crlvUrl || '');
      setDocProofAddressUrl(driver.proofOfAddressUrl || '');
      setDocCriminalUrl(driver.criminalRecordUrl || '');
    }
    setShowProfileModal(true);
  };

  const handleUploadDoc = async (
    file: File,
    docType: 'cnh' | 'crlv' | 'residencia' | 'antecedentes' | 'photo'
  ) => {
    if (!driver) return;
    setDocUploading(docType);
    setError(null);
    try {
      const base64Data = await processDocumentOrImageFile(file);
      const suffix = docType === 'photo' ? '_foto' : `_${docType}`;
      const uploadRes = await storageApi.uploadImage(base64Data, 'drivers', `${driver.uid}${suffix}`);
      const uploadedUrl = uploadRes.url;

      if (docType === 'photo') {
        const updated = await driversApi.updateMe({ photoUrl: uploadedUrl });
        setDriver(updated);
      } else if (docType === 'cnh') {
        setDocCnhUrl(uploadedUrl);
      } else if (docType === 'crlv') {
        setDocCrlvUrl(uploadedUrl);
      } else if (docType === 'residencia') {
        setDocProofAddressUrl(uploadedUrl);
      } else if (docType === 'antecedentes') {
        setDocCriminalUrl(uploadedUrl);
      }
      setProfileSuccessMsg('Arquivo anexado e salvo com sucesso!');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao processar e salvar arquivo.');
    } finally {
      setDocUploading(null);
    }
  };

  const handleSaveProfileAndDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    setProfileSaving(true);
    setError(null);
    try {
      const payload: Partial<DriverProfile> = {
        name: editName.trim(),
        whatsapp: editWhatsapp.replace(/\D/g, ''),
        cnhNumber: editCnhNumber.trim(),
        cnhUrl: docCnhUrl || undefined,
        crlvUrl: docCrlvUrl || undefined,
        proofOfAddressUrl: docProofAddressUrl || undefined,
        criminalRecordUrl: docCriminalUrl || undefined,
        operatingZones: editZones.length > 0 ? editZones : ['Centro'],
        vehicle: {
          brand: editBrand.trim(),
          model: editModel.trim(),
          year: parseInt(editYear) || 2020,
          color: editColor.trim(),
          plate: editPlate.trim().toUpperCase(),
          type: editVehicleType,
        },
      };

      const updated = await driversApi.updateMe(payload);
      setDriver(updated);
      setProfileSuccessMsg('Perfil e documentação atualizados com sucesso!');
      setTimeout(() => {
        setProfileSuccessMsg(null);
        setShowProfileModal(false);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao atualizar perfil e documentos.');
    } finally {
      setProfileSaving(false);
    }
  };

  const isApproved = driver?.status === 'APPROVED';

  // Plan switch logic & eligibility
  const currentPlan = driver?.subscriptionPlan || 'monthly_100';
  const isWeekly = currentPlan === 'weekly_percent_10';
  const minDays = isWeekly ? 7 : 30;

  const planSelectedAt = driver?.subscriptionPlanSelectedAt
    ? new Date(driver.subscriptionPlanSelectedAt)
    : new Date(driver?.createdAt || Date.now());

  const eligibleDate = driver?.nextPlanSwitchAllowedAt
    ? new Date(driver.nextPlanSwitchAllowedAt)
    : new Date(planSelectedAt.getTime() + minDays * 24 * 60 * 60 * 1000);

  const now = new Date();
  const isSwitchEligible = now.getTime() >= eligibleDate.getTime();
  const msRemaining = eligibleDate.getTime() - now.getTime();
  const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  const handleChangePlan = async () => {
    if (!selectedNewPlan) return;
    setPlanChangeLoading(true);
    setError(null);
    try {
      const res = await driversApi.changePlan(selectedNewPlan);
      setDriver(res.driver);
      setPlanSuccessMessage(res.message);
      setShowPlanModal(false);
      setTimeout(() => setPlanSuccessMessage(null), 8000);
    } catch (err: any) {
      setError(err.message || 'Falha ao alterar plano.');
    } finally {
      setPlanChangeLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-16">
        <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-7">
          <div className="space-y-3">
            <Link to="/" className="inline-block">
              <img src="/vaicar_logo.png" alt="VaiCar" className="h-12 mx-auto rounded object-contain" />
            </Link>
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Central do Motorista & Entregador
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Trabalhe com autonomia em São Sebastião
            </h1>
            <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
              O passageiro/cliente paga <strong>diretamente a você</strong> via Pix ou dinheiro. Escolha entre <strong>Mensalidade Fixa de R$ 100/mês</strong> ou <strong>10% por corrida semanal</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Car className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Motorista (Carro / Van)</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Transporte passageiros no Centro e praias da Costa Sul e Norte.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Bike className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Entregador (Moto)</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Entregas rápidas de comida e encomendas com agilidade no trânsito.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Bike className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Entregador (Bike)</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Entregas sustentáveis de bicicleta em comércios e bairros locais.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-left space-y-2">
            <span className="font-bold text-emerald-400 block uppercase tracking-wider text-[11px]">
              Modelos de Parceria Transparentes:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Opção 1:</strong> Mensalidade Fixa de R$ 100/mês (sem taxa por corrida, 100% dos ganhos para você)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Opção 2:</strong> 10% por corrida com acerto semanal</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80">
              💵 <strong>Pagamento Direto:</strong> O cliente paga diretamente a você via Pix ou dinheiro no veículo.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <Link
              to="/driver/register"
              className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all hover:scale-[1.02]"
            >
              Cadastre-se como Motorista ou Entregador
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              to="/driver/login"
              className="w-full py-3.5 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              Já sou parceiro cadastrado • Fazer Login no Painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* 1. FULLSCREEN / 80-90% MAP CANVAS (COCKPIT MAIN VIEW) */}
      <div className="absolute inset-0 z-0 w-full h-full">
        {incomingRide ? (
          <MapDisplay
            pickup={incomingRide.origin}
            destination={incomingRide.destination}
            driverLocation={effectiveDriverLocation}
            mode="planning"
            pickupLabel={`Embarque: ${incomingRide.passengerName}`}
            destinationLabel="Destino da Corrida"
            draggable={false}
            showHud={false}
            height="100%"
            className="h-full w-full rounded-none border-0"
          />
        ) : activeRide?.status === 'IN_PROGRESS' ? (
          <MapDisplay
            pickup={effectiveDriverLocation ? { lat: effectiveDriverLocation.lat, lng: effectiveDriverLocation.lng, address: 'Sua Localização' } : activeRide.origin}
            destination={activeRide.destination}
            mode="driver_to_destination"
            pickupLabel="Você + Passageiro"
            destinationLabel="Destino Final"
            draggable={false}
            showHud={false}
            height="100%"
            className="h-full w-full rounded-none border-0"
          />
        ) : activeRide ? (
          driverRouteMode === 'full_trip' ? (
            <MapDisplay
              pickup={activeRide.origin}
              destination={activeRide.destination}
              mode="planning"
              pickupLabel={`Embarque: ${activeRide.passengerName}`}
              destinationLabel="Destino Final"
              draggable={false}
              showHud={false}
              height="100%"
              className="h-full w-full rounded-none border-0"
            />
          ) : (
            <MapDisplay
              pickup={effectiveDriverLocation ? { lat: effectiveDriverLocation.lat, lng: effectiveDriverLocation.lng, address: 'Sua Localização' } : activeRide.origin}
              destination={activeRide.origin}
              mode="driver_to_pickup"
              pickupLabel="Você (Sua Localização)"
              destinationLabel={`Passageiro: ${activeRide.passengerName}`}
              draggable={false}
              showHud={false}
              height="100%"
              className="h-full w-full rounded-none border-0"
            />
          )
        ) : (
          <MapDisplay
            pickup={effectiveDriverLocation ? { lat: effectiveDriverLocation.lat, lng: effectiveDriverLocation.lng, address: 'Sua Localização' } : { lat: -23.8055, lng: -45.4011, address: 'Centro de São Sebastião' }}
            driverLocation={effectiveDriverLocation}
            mode="planning"
            pickupLabel="Você (Sua Localização)"
            draggable={false}
            showHud={false}
            height="100%"
            className="h-full w-full rounded-none border-0"
          />
        )}
      </div>

      {/* 2. FLOATING COCKPIT HEADER (TOP BAR) */}
      <header className="absolute top-3 left-3 right-3 z-30 pointer-events-none flex items-center justify-between">
        {/* Left: Online / Offline Toggle Pill */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={handleToggleOnline}
            disabled={actionLoading || !isApproved}
            className={`py-2 px-3.5 sm:px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xl backdrop-blur-md transition-all ${
              !isApproved
                ? 'bg-slate-900/90 text-amber-400 border border-amber-500/40 cursor-not-allowed'
                : isOnline
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/80 border border-emerald-400 hover:scale-105'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:scale-105'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-rose-500'}`} />
            <span>
              {!isApproved
                ? driver?.status === 'PENDING_APPROVAL' ? 'Em Análise' : 'Não Aprovado'
                : isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </button>
        </div>

        {/* Right: GPS Status, Audio Test & Menu Hamburger ☰ */}
        <div className="pointer-events-auto flex items-center gap-2">
          {driverGps ? (
            <div
              className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-xl"
              title="GPS Ativo em Alta Precisão"
            >
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">GPS</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestDriverGps}
              className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-amber-950/90 backdrop-blur-md border border-amber-500 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-xl hover:bg-amber-900 transition-colors"
              title="Clique para ativar o GPS do seu dispositivo"
            >
              <Crosshair className="w-4 h-4 text-amber-400 animate-spin" />
              <span className="hidden sm:inline">Ativar GPS</span>
            </button>
          )}

          <button
            type="button"
            onClick={playIncomingRideChime}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-white transition-colors shadow-xl"
            title="Testar som de nova corrida"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* Hamburger Menu ☰ */}
          <button
            type="button"
            onClick={() => {
              setDrawerTab('menu');
              setIsDrawerOpen(true);
            }}
            className="relative p-2 sm:p-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 hover:border-emerald-500 text-white transition-all shadow-xl hover:scale-105"
            title="Abrir Menu do Motorista (☰)"
          >
            <Menu className="w-5 h-5" />
            {(driver?.documentsRequested || pendingPayments.length > 0) && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
            )}
            {(driver?.documentsRequested || pendingPayments.length > 0) && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-slate-900" />
            )}
          </button>
        </div>
      </header>

      {/* Floating System / Notification Banners (Non-intrusive) */}
      <div className="absolute top-16 left-3 right-3 z-30 pointer-events-none flex flex-col items-center gap-2">
        {gpsError && (
          <div className="pointer-events-auto bg-amber-950/90 backdrop-blur-md border border-amber-500 text-amber-200 text-xs px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 max-w-md">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">{gpsError}</span>
            <button
              onClick={requestDriverGps}
              className="ml-auto underline font-bold shrink-0 text-amber-300 hover:text-white"
            >
              Ativar
            </button>
          </div>
        )}

        {driver?.documentsRequested && (
          <div
            onClick={handleOpenProfileModal}
            className="pointer-events-auto cursor-pointer bg-amber-950/90 backdrop-blur-md border border-amber-500 text-amber-200 text-xs px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 max-w-md hover:bg-amber-900 transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="truncate font-semibold">Docs solicitados pela administração. Toque para enviar.</span>
          </div>
        )}

        {error && (
          <div className="pointer-events-auto bg-rose-950/90 backdrop-blur-md border border-rose-500 text-rose-200 text-xs px-3.5 py-2 rounded-2xl shadow-xl flex items-center justify-between gap-2 max-w-md">
            <div className="flex items-center gap-2 truncate">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {paymentApprovalSuccessMessage && (
          <div className="pointer-events-auto bg-emerald-950/90 backdrop-blur-md border border-emerald-500 text-emerald-200 text-xs px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 max-w-md">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{paymentApprovalSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* 3. FLOATING COCKPIT BOTTOM SHEET (DECISION & ACTION CARDS) */}
      <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[410px] z-30 pointer-events-auto">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5">
          {/* A. INCOMING RIDE REQUEST (Offer Decision Card) */}
          {incomingRide ? (
            <div className="space-y-3.5 animate-in slide-in-from-bottom-4 duration-200">
              {/* Progress bar countdown */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  {incomingRide.serviceType === 'delivery' ? 'Nova Entrega' : 'Nova Corrida'}
                </span>
                <span className="font-mono font-black text-white bg-slate-950 px-2 py-0.5 rounded-lg border border-emerald-500/40">
                  {incomingCountdown}s
                </span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-500 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(incomingCountdown / 30) * 100}%` }}
                />
              </div>

              {/* Big Fare Display */}
              <div className="flex items-baseline justify-between pt-0.5">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Valor da Corrida</span>
                  <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                    R$ {incomingRide.fareAmount.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">{incomingRide.paymentMethod}</span>
                  <span className="text-[10px] text-slate-400">Pagamento direto</span>
                </div>
              </div>

              {/* Distance to passenger & Route summary */}
              <div className="bg-slate-950/90 rounded-2xl p-3 border border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-white">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {distToPickupKm !== null ? `${distToPickupKm} km • ~${etaToPickupMin} min` : 'Poucos minutos'} até o passageiro
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 pt-1.5 border-t border-slate-800/80 font-medium">
                  <Navigation className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">
                    {formatRouteSummary(incomingRide.origin.address, incomingRide.destination.address)}
                  </span>
                </div>
              </div>

              {/* Big Action Buttons: [RECUSAR] e [ACEITAR] */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleDeclineRide(incomingRide.id)}
                  disabled={actionLoading}
                  className="py-3.5 px-3 rounded-2xl bg-slate-950 hover:bg-rose-950/70 border border-slate-800 hover:border-rose-600/60 text-slate-400 hover:text-rose-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={() => handleAcceptRide(incomingRide.id)}
                  disabled={actionLoading}
                  className="py-3.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950 transition-all hover:scale-[1.02] animate-pulse"
                >
                  <Check className="w-5 h-5" />
                  {actionLoading ? 'Aceitando...' : 'Aceitar'}
                </button>
              </div>
            </div>
          ) : activeRide?.status === 'DRIVER_ARRIVING' ? (
            /* B. AFTER ACCEPTING (DRIVER_ARRIVING) */
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeRide.passengerPhotoUrl ? (
                    <img
                      src={activeRide.passengerPhotoUrl}
                      alt={activeRide.passengerName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 font-black text-lg border border-slate-700">
                      {activeRide.passengerName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <span className="text-base font-extrabold text-white block">{activeRide.passengerName}</span>
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {distToPickupKm !== null ? `${distToPickupKm} km • ~${etaToPickupMin} min` : 'A caminho do embarque'}
                    </span>
                  </div>
                </div>

                {/* Quick External Navigation */}
                <div className="flex items-center gap-1.5">
                  <a
                    href={`https://waze.com/ul?ll=${activeRide.origin.lat},${activeRide.origin.lng}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white transition-colors shadow"
                    title="Navegar no Waze até o passageiro"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activeRide.origin.lat},${activeRide.origin.lng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white transition-colors shadow"
                    title="Navegar no Google Maps até o passageiro"
                  >
                    <Navigation className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Route Mode Switcher (To passenger vs Full trip preview) */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-[11px] font-bold gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setDriverRouteMode('to_passenger')}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    driverRouteMode === 'to_passenger'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Car className="w-3 h-3" /> Rota até Passageiro
                </button>
                <button
                  type="button"
                  onClick={() => setDriverRouteMode('full_trip')}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    driverRouteMode === 'full_trip'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Navigation className="w-3 h-3" /> Trajeto da Viagem
                </button>
              </div>

              {/* Primary Button: [ CHEGUEI ] */}
              <button
                type="button"
                onClick={handleMarkArrived}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-950 transition-all hover:scale-[1.01]"
              >
                <Car className="w-5 h-5 text-slate-950" />
                Cheguei no Embarque
              </button>

              <button
                type="button"
                onClick={handleDriverCancelPreRide}
                disabled={actionLoading}
                className="w-full py-1 text-center text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
              >
                Cancelar Corrida
              </button>
            </div>
          ) : activeRide?.status === 'ARRIVED' ? (
            /* C. AFTER ARRIVING (ARRIVED - 4 Min Tolerance) */
            <div className="space-y-3 text-center animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-left pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  {activeRide.passengerPhotoUrl ? (
                    <img
                      src={activeRide.passengerPhotoUrl}
                      alt={activeRide.passengerName}
                      className="w-9 h-9 rounded-full object-cover border border-emerald-500"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      {activeRide.passengerName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-white block">{activeRide.passengerName}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">No ponto de embarque</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/40">
                  R$ {activeRide.fareAmount.toFixed(2)}
                </span>
              </div>

              {/* 4-Minute Countdown Clock */}
              <div className="py-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Passageiro Chegando
                </span>
                <span
                  className={`text-4xl sm:text-5xl font-black font-mono tracking-tight my-1 block ${
                    arrivedSecondsRemaining === 0
                      ? 'text-rose-400'
                      : arrivedSecondsRemaining <= 60
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {formattedArrivedTime}
                </span>
                <span className="text-[11px] text-slate-400">
                  {arrivedSecondsRemaining === 0
                    ? '⚠️ Prazo de 4 minutos expirado. Pode cancelar se não comparecer.'
                    : 'Aguarde o passageiro no veículo (tolerância 4 min)'}
                </span>
              </div>

              {/* Primary Button: [ INICIAR CORRIDA ] */}
              <button
                type="button"
                onClick={handleStartRide}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950 transition-all hover:scale-[1.01]"
              >
                <Check className="w-5 h-5 text-white" />
                Iniciar Corrida
              </button>

              <button
                type="button"
                onClick={handleDriverCancelPreRide}
                disabled={actionLoading}
                className="w-full py-1 text-center text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
              >
                Passageiro não compareceu • Cancelar
              </button>
            </div>
          ) : activeRide?.status === 'IN_PROGRESS' ? (
            /* D. TRIP IN PROGRESS (IN_PROGRESS) */
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Valor a Receber</span>
                  <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                    R$ {activeRide.fareAmount.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-white flex items-center justify-end gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    ~{activeRide.durationMinutes || 12} min • {activeRide.distanceKm || 6.4} km
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">💵 {activeRide.paymentMethod} direto</span>
                </div>
              </div>

              {/* Destination & Quick External Nav */}
              <div className="bg-slate-950/90 rounded-2xl p-3 border border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-200 truncate font-medium">
                  <Navigation className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">{activeRide.destination.address}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`https://waze.com/ul?ll=${activeRide.destination.lat},${activeRide.destination.lng}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white transition-colors"
                    title="Navegar no Waze até o destino"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activeRide.destination.lat},${activeRide.destination.lng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white transition-colors"
                    title="Navegar no Google Maps até o destino"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Primary Button: [ FINALIZAR CORRIDA ] */}
              <button
                type="button"
                onClick={() => setShowPaymentCompletionModal(true)}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950 transition-all hover:scale-[1.01]"
              >
                <CheckCircle className="w-5 h-5 text-white" />
                Finalizar Corrida
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowDriverEmergencyModal(true)}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Emergência (Pane / Acidente)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportTarget({
                      rideId: activeRide.id,
                      targetName: activeRide.passengerName,
                      amount: activeRide.fareAmount,
                    });
                    setShowReportModal(true);
                  }}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
                >
                  Reportar
                </button>
              </div>
            </div>
          ) : activeRide?.status === 'COMPLETED' ? (
            /* E. COMPLETED (Payment Approval or Done) */
            <div className="space-y-3 animate-in fade-in duration-150">
              {!activeRide.paymentApprovedByDriver || activeRide.paymentStatus === 'PENDING' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pagamento Pendente</span>
                    <span className="text-xl font-black text-emerald-400">R$ {activeRide.fareAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Confirme o recebimento de <strong>R$ {activeRide.fareAmount.toFixed(2)}</strong> via {activeRide.paymentMethod} de {activeRide.passengerName}.
                  </p>
                  <button
                    onClick={() => handleApprovePayment(activeRide.id)}
                    disabled={actionLoading}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Recebimento (R$ {activeRide.fareAmount.toFixed(2)})
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center py-2 space-y-1">
                    <CheckCircle className="w-9 h-9 text-emerald-400 mx-auto" />
                    <span className="text-sm font-black text-white block">Viagem Finalizada com Sucesso!</span>
                    <span className="text-xs text-emerald-300 font-medium">Pagamento aprovado e recibo emitido.</span>
                  </div>
                  <button
                    onClick={() => setActiveRide(null)}
                    className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider transition-colors"
                  >
                    Voltar ao Cockpit
                  </button>
                </>
              )}
            </div>
          ) : !isOnline ? (
            /* F. OFFLINE STATE */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status do Motorista</span>
                  <span className="text-base sm:text-lg font-black text-rose-400">Você está Offline</span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Power className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fique online para que passageiros em São Sebastião possam ver você no mapa e solicitar corridas.
              </p>
              <button
                type="button"
                onClick={handleToggleOnline}
                disabled={actionLoading || !isApproved}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950 transition-all hover:scale-[1.01]"
              >
                <Power className="w-4 h-4 sm:w-5 sm:h-5" />
                Ficar Online
              </button>
            </div>
          ) : (
            /* G. ONLINE & SEARCHING FOR RIDES */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400 relative">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
                    <Car className="w-5 h-5 z-10" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Cockpit Ativo</span>
                    <span className="text-sm sm:text-base font-extrabold text-white">Procurando passageiros...</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPricingModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Configurar Minhas Tarifas"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Tarifas
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="font-bold text-white">{driver?.rating?.toFixed(1) || '5.0'}</span>
                  <span>• {driver?.vehicle?.brand} {driver?.vehicle?.model}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleOnline}
                  className="text-rose-400 hover:text-rose-300 font-bold transition-colors"
                >
                  Ficar Offline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. SECONDARY DRAWER MENU (☰) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[10000] flex justify-end animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Slide-over Drawer Panel */}
          <div
            className="relative w-full max-w-sm sm:max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header: Driver Identity */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                {driver?.photoUrl ? (
                  <img
                    src={driver.photoUrl}
                    alt={driver.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-emerald-500/60 flex items-center justify-center text-emerald-400 font-black text-lg">
                    {driver?.name ? driver.name.charAt(0) : <User className="w-6 h-6" />}
                  </div>
                )}
                <div>
                  <h3 className="font-extrabold text-white text-sm">{driver?.name || 'Motorista Parceiro'}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {driver?.rating?.toFixed(1) || '5.0'}
                    </span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">
                      {isApproved ? 'Aprovado' : 'Em Análise'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Fechar Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Views */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {drawerTab === 'menu' && (
                <div className="space-y-1">
                  {/* Pending Payments Alert in Drawer if any */}
                  {pendingPayments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDrawerTab('earnings')}
                      className="w-full mb-3 p-3.5 rounded-2xl bg-amber-950/80 border border-amber-500 text-left text-amber-200 flex items-center justify-between gap-3 shadow-lg"
                    >
                      <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
                        <div>
                          <span className="font-bold text-white text-xs block">
                            {pendingPayments.length} Pagamento(s) Pendente(s)
                          </span>
                          <span className="text-[11px] text-amber-300">Toque para confirmar recebimento</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                    </button>
                  )}

                  {/* 1. Meu Perfil */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      handleOpenProfileModal();
                    }}
                    className="w-full p-3.5 rounded-2xl hover:bg-slate-800/80 text-left flex items-center justify-between transition-colors border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Meu Perfil</span>
                        <span className="text-[11px] text-slate-400">Dados cadastrais, telefone, foto</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* 2. Minhas Tarifas */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setShowPricingModal(true);
                    }}
                    className="w-full p-3.5 rounded-2xl hover:bg-slate-800/80 text-left flex items-center justify-between transition-colors border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Minhas Tarifas</span>
                        <span className="text-[11px] text-slate-400">Valor mínimo, por km e rotas fixas</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* 3. Meu Veículo */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      handleOpenProfileModal();
                    }}
                    className="w-full p-3.5 rounded-2xl hover:bg-slate-800/80 text-left flex items-center justify-between transition-colors border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
                        <Car className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Meu Veículo</span>
                        <span className="text-[11px] text-slate-400">
                          {driver?.vehicle ? `${driver.vehicle.brand} ${driver.vehicle.model} (${driver.vehicle.plate})` : 'Cadastrar veículo'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* 4. Documentos */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      handleOpenProfileModal();
                    }}
                    className="w-full p-3.5 rounded-2xl hover:bg-slate-800/80 text-left flex items-center justify-between transition-colors border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 relative">
                        <FileText className="w-4 h-4" />
                        {driver?.documentsRequested && (
                          <span className="w-2.5 h-2.5 bg-rose-500 rounded-full absolute -top-0.5 -right-0.5 animate-ping" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Documentos</span>
                        <span className="text-[11px] text-slate-400">CNH, CRLV, Comprovante e Antecedentes (PDF/Foto)</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* 5. Avaliações */}
                  <button
                    type="button"
                    onClick={() => setDrawerTab('ratings')}
                    className="w-full p-3.5 rounded-2xl hover:bg-slate-800/80 text-left flex items-center justify-between transition-colors border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                        <Star className="w-4 h-4 fill-amber-400" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Avaliações</span>
                        <span className="text-[11px] text-slate-400">Nota média ⭐ {driver?.rating?.toFixed(1) || '5.0'} e feedbacks</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* 6. Ganhos & Planos */}
                  <button
                    type="button"
                    onClick={() => setDrawerTab('earnings')}
                    className="w-full p-3.5 rounded-2xl hover:bg-slate-800/80 text-left flex items-center justify-between transition-colors border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Ganhos & Planos</span>
                        <span className="text-[11px] text-slate-400">
                          {driver?.subscriptionPlan === 'weekly_percent_10' ? '10% Semanal' : 'R$ 100/mês'} • Troca e pagamentos
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* 7. Corridas */}
                  <button
                    type="button"
                    onClick={() => setDrawerTab('history')}
                    className="w-full p-3.5 rounded-2xl hover:bg-slate-800/80 text-left flex items-center justify-between transition-colors border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-400">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Histórico de Corridas</span>
                        <span className="text-[11px] text-slate-400">{rideHistory.length} viagens registradas</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* 8. Configurações */}
                  <button
                    type="button"
                    onClick={() => setDrawerTab('settings')}
                    className="w-full p-3.5 rounded-2xl hover:bg-slate-800/80 text-left flex items-center justify-between transition-colors border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Configurações & GPS</span>
                        <span className="text-[11px] text-slate-400">Calibragem de GPS e áudio</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* 9. Status Online / Offline */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleOnline();
                        setIsDrawerOpen(false);
                      }}
                      disabled={actionLoading || !isApproved}
                      className={`w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                        isOnline
                          ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-rose-300'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                      {isOnline ? 'Ficar Offline' : 'Ficar Online'}
                    </button>
                  </div>

                  {/* 10. Logout */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        navigate('/driver/login');
                      }}
                      className="w-full py-2.5 text-center text-xs font-semibold text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      Sair da Conta (Logout)
                    </button>
                  </div>
                </div>
              )}

              {/* Subview: Avaliações */}
              {drawerTab === 'ratings' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('menu')}
                    className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar ao Menu
                  </button>

                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-center space-y-2">
                    <div className="flex items-center justify-center gap-1 text-3xl font-black text-white">
                      <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
                      <span>{driver?.rating?.toFixed(1) || '5.0'}</span>
                    </div>
                    <span className="text-xs text-slate-400 block">Avaliação Média dos Passageiros</span>
                    <span className="text-[11px] text-emerald-400 font-semibold block">
                      {driver?.completedRidesCount || rideHistory.length} viagens realizadas com sucesso
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sua pontuação reflete a pontualidade, educação e segurança durante as viagens realizadas na plataforma VaiCar em São Sebastião.
                  </p>
                </div>
              )}

              {/* Subview: Ganhos & Planos */}
              {drawerTab === 'earnings' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('menu')}
                    className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar ao Menu
                  </button>

                  {/* Pending Payments Section */}
                  {pendingPayments.length > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500 space-y-3">
                      <span className="font-extrabold text-amber-300 text-xs uppercase tracking-wider block">
                        Aprovar Pagamento Recebido ({pendingPayments.length})
                      </span>
                      {pendingPayments.map((pr) => (
                        <div key={pr.id} className="bg-slate-950 p-3 rounded-xl border border-amber-500/50 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white">{pr.passengerName}</span>
                            <span className="font-black text-emerald-400 text-sm">R$ {pr.fareAmount.toFixed(2)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApprovePayment(pr.id)}
                            disabled={actionLoading}
                            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle className="w-4 h-4" /> Confirmar Recebimento
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Plan Card */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                    <span className="text-slate-400 block font-medium">Plano Atual:</span>
                    <span className="text-base font-black text-emerald-400 block">
                      {driver?.subscriptionPlan === 'weekly_percent_10'
                        ? '10% por Corrida (Semanal)'
                        : 'R$ 100,00 / mês (Mensalidade Fixa)'}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      {isSwitchEligible ? (
                        <span className="text-emerald-400 font-semibold">✓ Troca de plano liberada</span>
                      ) : (
                        <span>Troca disponível em {daysRemaining} dia(s)</span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPlanModal(true)}
                      className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors"
                    >
                      Alterar Plano
                    </button>
                  </div>
                </div>
              )}

              {/* Subview: Histórico de Corridas */}
              {drawerTab === 'history' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('menu')}
                    className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar ao Menu
                  </button>

                  <span className="text-xs font-bold text-white block">
                    Histórico de Corridas ({rideHistory.length})
                  </span>

                  {rideHistory.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-2xl border border-slate-800">
                      Nenhuma corrida registrada ainda.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rideHistory.map((r) => (
                        <div
                          key={r.id}
                          className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white">{r.passengerName}</span>
                            <span className="font-extrabold text-emerald-400">R$ {r.fareAmount.toFixed(2)}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {formatRouteSummary(r.origin.address, r.destination.address)}
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                            <span>{new Date(r.requestedAt).toLocaleDateString('pt-BR')} • {r.paymentMethod}</span>
                            <span className="font-semibold text-slate-400">{r.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Subview: Configurações */}
              {drawerTab === 'settings' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('menu')}
                    className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar ao Menu
                  </button>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
                    <span className="font-bold text-white block">Localização & GPS</span>
                    <p className="text-slate-400 text-[11px]">
                      {driverGps
                        ? `GPS ativo e sincronizado: (${driverGps.lat.toFixed(4)}, ${driverGps.lng.toFixed(4)})`
                        : 'GPS do dispositivo aguardando permissão.'}
                    </p>
                    <button
                      type="button"
                      onClick={requestDriverGps}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700"
                    >
                      <Crosshair className="w-4 h-4" /> Recalibrar GPS
                    </button>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
                    <span className="font-bold text-white block">Áudio de Chamadas</span>
                    <p className="text-slate-400 text-[11px]">
                      O sinal sonoro toca automaticamente quando um passageiro solicita uma nova corrida.
                    </p>
                    <button
                      type="button"
                      onClick={playIncomingRideChime}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700"
                    >
                      <Volume2 className="w-4 h-4 text-emerald-400" /> Testar Som de Corrida
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {receiptToShow && <ReceiptModal receipt={receiptToShow} onClose={() => setReceiptToShow(null)} />}

      {/* REPORT MODAL */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        rideId={reportTarget?.rideId}
        targetRole="passenger"
        targetName={reportTarget?.targetName}
        defaultAmount={reportTarget?.amount}
        onSuccess={() => {
          if (activeRide) {
            setActiveRide(null);
          }
        }}
      />

      {/* PLAN CHANGE MODAL */}
      {showPlanModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200"
            onClick={() => setShowPlanModal(false)}
          >
            <div
              className="bg-slate-900 border border-emerald-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative my-auto animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" /> Alterar Plano de Parceria
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Você pode alternar entre a mensalidade fixa e o percentual semanal.
                A troca é permitida após <strong>1 mês (30 dias)</strong> para planos mensais ou <strong>1 semana (7 dias)</strong> para planos de 10% semanal.
              </p>

              {/* Current plan status notice */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-400 block text-[11px] font-medium">Plano Atual:</span>
                <span className="font-bold text-white block text-sm">
                  {currentPlan === 'weekly_percent_10' ? '10% Semanal (Acerto Semanal)' : 'R$ 100/mês (Mensalidade Fixa)'}
                </span>
                <span className="text-[11px] text-slate-400 block pt-1 border-t border-slate-800/80">
                  {isSwitchEligible ? (
                    <span className="text-emerald-400 font-semibold">
                      ✓ Você já cumpriu o período mínimo e pode trocar de plano agora.
                    </span>
                  ) : (
                    <span>
                      Próxima troca liberada em: <strong>{eligibleDate.toLocaleDateString('pt-BR')}</strong> (faltam {daysRemaining} dia(s)).
                    </span>
                  )}
                </span>
              </div>

              {/* Selection Options */}
              <div className="space-y-2.5">
                <label
                  onClick={() => setSelectedNewPlan('monthly_100')}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    selectedNewPlan === 'monthly_100'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="modalPlan"
                    checked={selectedNewPlan === 'monthly_100'}
                    onChange={() => setSelectedNewPlan('monthly_100')}
                    className="mt-1 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Mensalidade: R$ 100,00 / mês</span>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        Taxa Fixa
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Corridas ilimitadas com taxa fixa. Fidelidade mínima de 1 mês antes da próxima troca.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setSelectedNewPlan('weekly_percent_10')}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    selectedNewPlan === 'weekly_percent_10'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="modalPlan"
                    checked={selectedNewPlan === 'weekly_percent_10'}
                    onChange={() => setSelectedNewPlan('weekly_percent_10')}
                    className="mt-1 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">10% por Corrida (Semanal)</span>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        Semanal
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Pague 10% somente das corridas realizadas, acertado semanalmente. Flexibilidade mínima de 1 semana antes da próxima troca.
                    </p>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleChangePlan}
                  disabled={planChangeLoading || !isSwitchEligible || selectedNewPlan === currentPlan}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5"
                >
                  {planChangeLoading ? 'Salvando...' : 'Confirmar Troca'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* PAYMENT COMPLETION & APPROVAL MODAL */}
      {showPaymentCompletionModal &&
        activeRide &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200"
            onClick={() => setShowPaymentCompletionModal(false)}
          >
            <div
              className="bg-slate-900 border-2 border-emerald-500/70 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative my-auto animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" /> Finalizar Viagem & Pagamento
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPaymentCompletionModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Passenger & Fare Box */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Passageiro:</span>
                    <span className="text-sm font-bold text-white">{activeRide.passengerName}</span>
                    <span className="text-xs text-slate-400 block">{activeRide.passengerPhone}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block font-medium">Valor Total:</span>
                    <span className="text-2xl font-black text-emerald-400">
                      R$ {activeRide.fareAmount.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-400 block">Forma: {activeRide.paymentMethod}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div>De: {activeRide.origin.address}</div>
                  <div>Para: {activeRide.destination.address}</div>
                </div>

                {activeRide.paymentMethod === 'PIX' && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
                    💡 <strong>Atenção ao Pix:</strong> Abra o aplicativo do seu banco e confirme se a transferência de <strong>R$ {activeRide.fareAmount.toFixed(2)}</strong> foi creditada na sua conta antes de aprovar.
                  </div>
                )}
              </div>

              {/* Decision Options */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleCompleteRide(true)}
                  disabled={actionLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all hover:scale-[1.01]"
                >
                  <CheckCircle className="w-5 h-5" />
                  {actionLoading ? 'Processando...' : `Confirmar Pagamento Recebido (R$ ${activeRide.fareAmount.toFixed(2)})`}
                </button>
                <p className="text-[11px] text-slate-400 text-center">
                  ✓ Emite o recibo oficial e libera o passageiro imediatamente para novas corridas.
                </p>

                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleCompleteRide(false)}
                    disabled={actionLoading}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-600/60 text-amber-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Clock className="w-4 h-4 text-amber-400" />
                    Finalizar com Pagamento Pendente
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">
                    ⏱️ Conclui a viagem, mas o passageiro fica <strong>bloqueado</strong> até você aprovar o recebimento.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentCompletionModal(false);
                      setReportTarget({
                        rideId: activeRide.id,
                        targetName: activeRide.passengerName,
                        amount: activeRide.fareAmount,
                      });
                      setShowReportModal(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-600/60 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Passageiro Recusou Pagamento (Relatar Calote)
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* INCOMING RIDE POP-UP ALERT MODAL (ITEM 4) */}
      {incomingRide &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/85 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-in zoom-in-95 duration-200 ring-4 ring-emerald-500/20">
              {/* Header with audio pulse & countdown badge */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400 animate-pulse">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white tracking-tight">
                      {incomingRide.serviceType === 'delivery' ? 'NOVA ENTREGA DISPONÍVEL' : 'NOVA CORRIDA DISPONÍVEL'}
                    </h3>
                    <span className="text-xs text-emerald-400 font-semibold">
                      Toque para aceitar antes que o tempo expire!
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-slate-950 border-2 border-emerald-500 text-emerald-400">
                  <span className="text-lg font-black leading-none">{incomingCountdown}</span>
                  <span className="text-[9px] uppercase font-bold text-slate-400">seg</span>
                </div>
              </div>

              {/* Progress bar countdown */}
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-500 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(incomingCountdown / 30) * 100}%` }}
                />
              </div>

              {/* Passenger & Fare Details */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {incomingRide.passengerPhotoUrl ? (
                    <img
                      src={incomingRide.passengerPhotoUrl}
                      alt={incomingRide.passengerName}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-emerald-400 text-2xl font-bold">
                      <User className="w-7 h-7" />
                    </div>
                  )}
                  <div>
                    <span className="text-base font-extrabold text-white block">
                      {incomingRide.passengerName}
                    </span>
                    <span className="text-xs text-slate-400">
                      ⭐ Passageiro(a) Verificado(a)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-medium">Valor Estimado:</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400 block">
                    R$ {incomingRide.fareAmount.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {incomingRide.paymentMethod} • Direto
                  </span>
                </div>
              </div>

              {/* Route Origin & Destination */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-emerald-400 block uppercase tracking-wider text-[10px]">
                      Embarque / Retirada:
                    </span>
                    <p className="text-slate-100 font-medium text-xs leading-relaxed">
                      {incomingRide.origin.address}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-2 border-t border-slate-800/80">
                  <Navigation className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-rose-400 block uppercase tracking-wider text-[10px]">
                      Destino / Entrega:
                    </span>
                    <p className="text-slate-100 font-medium text-xs leading-relaxed">
                      {incomingRide.destination.address}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Green Accept, Red Reject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleDeclineRide(incomingRide.id)}
                  disabled={actionLoading}
                  className="w-full py-4 px-4 rounded-2xl bg-slate-950 hover:bg-rose-950/70 border-2 border-rose-600/50 hover:border-rose-500 text-rose-300 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                >
                  <X className="w-5 h-5" />
                  Recusar Corrida
                </button>

                <button
                  type="button"
                  onClick={() => handleAcceptRide(incomingRide.id)}
                  disabled={actionLoading}
                  className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950 transition-all hover:scale-[1.02] animate-pulse"
                >
                  <Check className="w-5 h-5" />
                  {actionLoading ? 'Aceitando...' : `Aceitar (${incomingCountdown}s)`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* PASSENGER RATING MODAL (DRIVER RATINGS PASSENGER - ITEM 3) */}
      {showPassengerRatingModal &&
        completedRideToRate &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> Como foi sua viagem com o passageiro?
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowPassengerRatingModal(false);
                    setCompletedRideToRate(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-950 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 overflow-hidden">
                  {completedRideToRate.passengerPhotoUrl ? (
                    <img
                      src={completedRideToRate.passengerPhotoUrl}
                      alt={completedRideToRate.passengerName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8" />
                  )}
                </div>
                <h4 className="text-base font-bold text-white">{completedRideToRate.passengerName}</h4>
                <p className="text-xs text-slate-400">
                  Sua avaliação ajuda a manter a comunidade VaiCar segura e respeitosa.
                </p>
              </div>

              {/* Star Rating Selector */}
              <div className="flex items-center justify-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setPassengerStars(star)}
                    className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`w-9 h-9 transition-colors ${
                        star <= passengerStars
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-700 hover:text-slate-500'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Quick Feedback Tags */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 block">Elogios & Observações:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Pontual no embarque',
                    'Educado(a) e gentil',
                    'Pagamento rápido',
                    'Excelente passageiro',
                    'Demorou para descer',
                    'Ambiente agradável',
                  ].map((tag) => {
                    const isSelected = passengerFeedbackTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setPassengerFeedbackTags((curr) =>
                            isSelected ? curr.filter((t) => t !== tag) : [...curr, tag]
                          );
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Comment */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Comentário Adicional (Opcional):
                </label>
                <textarea
                  value={passengerFeedback}
                  onChange={(e) => setPassengerFeedback(e.target.value)}
                  placeholder="Escreva como foi o comportamento do passageiro..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 h-20 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPassengerRatingModal(false);
                    setCompletedRideToRate(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                >
                  Pular
                </button>
                <button
                  type="button"
                  onClick={handleSubmitPassengerRating}
                  disabled={ratingSubmitting}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 transition-all hover:scale-[1.02]"
                >
                  <CheckCircle className="w-4 h-4" />
                  {ratingSubmitting ? 'Enviando...' : 'Enviar Avaliação'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* DRIVER PROFILE & DOCUMENTS MODAL (ITEM 6 & ITEM 7) */}
      {showProfileModal &&
        driver &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/85 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <User className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h3 className="text-lg font-black text-white">Meu Perfil & Documentação</h3>
                    <span className="text-xs text-slate-400">Atualize seus dados, veículo e anexe documentos (PDF ou Imagem)</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {profileSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2 shadow-lg">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {/* ADMIN DOCUMENTS REQUEST BANNER */}
              {driver.documentsRequested && (
                <div className="p-4 rounded-xl bg-amber-950/80 border-2 border-amber-500 text-amber-200 text-xs space-y-2 shadow-lg">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Atenção: A Administração Solicitou Novos Documentos</span>
                  </div>
                  <p className="bg-slate-950/70 p-2.5 rounded-lg border border-amber-500/30 text-amber-100 font-mono text-[11px]">
                    {driver.documentsRequested}
                  </p>
                  <span className="text-[10px] text-amber-300/80 block">
                    Por favor, faça o upload dos arquivos solicitados abaixo para regularização.
                  </span>
                </div>
              )}

              <form onSubmit={handleSaveProfileAndDocs} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
                {/* 1. FOTO DE PERFIL */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 overflow-hidden shrink-0 relative group">
                      {driver.photoUrl ? (
                        <img src={driver.photoUrl} alt={driver.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">Foto de Perfil</span>
                      <span className="text-[11px] text-slate-400 block">
                        Foto visível para passageiros durante corridas
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="profile-photo-upload"
                      className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
                    >
                      <Camera className="w-4 h-4 text-emerald-400" />
                      {docUploading === 'photo' ? 'Salvando...' : 'Trocar Foto'}
                    </label>
                    <input
                      id="profile-photo-upload"
                      type="file"
                      accept="image/*"
                      disabled={docUploading === 'photo'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDoc(file, 'photo');
                      }}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* 2. DADOS PESSOAIS */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block pb-1 border-b border-slate-800">
                    1. Dados Pessoais
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">WhatsApp / Telefone *</label>
                      <input
                        type="text"
                        required
                        value={editWhatsapp}
                        onChange={(e) => setEditWhatsapp(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Número da CNH / Documento</label>
                      <input
                        type="text"
                        value={editCnhNumber}
                        onChange={(e) => setEditCnhNumber(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. DADOS DO VEÍCULO */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block pb-1 border-b border-slate-800">
                    2. Dados do Veículo
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Marca</label>
                      <input
                        type="text"
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Modelo</label>
                      <input
                        type="text"
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Ano</label>
                      <input
                        type="text"
                        value={editYear}
                        onChange={(e) => setEditYear(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Cor</label>
                      <input
                        type="text"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Placa</label>
                      <input
                        type="text"
                        value={editPlate}
                        onChange={(e) => setEditPlate(e.target.value.toUpperCase())}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white uppercase focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Tipo de Veículo</label>
                      <select
                        value={editVehicleType}
                        onChange={(e) => setEditVehicleType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="car">Carro</option>
                        <option value="motorcycle">Moto</option>
                        <option value="van">Van</option>
                        <option value="bicycle">Bicicleta</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. ZONAS DE ATUAÇÃO */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block pb-1 border-b border-slate-800">
                    3. Regiões de Atuação em São Sebastião
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {zones.map((zone) => {
                      const isChecked = editZones.includes(zone);
                      return (
                        <label
                          key={zone}
                          className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-emerald-950/50 border-emerald-500/60 text-white font-semibold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditZones((curr) => [...curr, zone]);
                              } else {
                                setEditZones((curr) => curr.filter((z) => z !== zone));
                              }
                            }}
                            className="rounded text-emerald-500 focus:ring-emerald-500"
                          />
                          <span>{zone}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 5. ANEXOS DE DOCUMENTOS (SUPORTA PDF E IMAGEM) */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block pb-1 border-b border-slate-800">
                    4. Documentos Oficiais (Aceita PDF ou Imagem)
                  </span>

                  <div className="space-y-3">
                    {/* CNH Card */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">Carteira Nacional de Habilitação (CNH)</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            docCnhUrl ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-rose-950 text-rose-300 border border-rose-700'
                          }`}>
                            {docCnhUrl ? '✓ Anexado' : 'Pendente'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Envie foto nítida ou arquivo PDF da sua CNH física ou digital (CDT).
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {docCnhUrl && (
                          <a
                            href={docCnhUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir ↗
                          </a>
                        )}
                        <label
                          htmlFor="doc-cnh-file"
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {docUploading === 'cnh' ? 'Enviando...' : docCnhUrl ? 'Substituir' : 'Anexar (PDF/Foto)'}
                        </label>
                        <input
                          id="doc-cnh-file"
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={docUploading === 'cnh'}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDoc(file, 'cnh');
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* CRLV Card */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">Licenciamento do Veículo (CRLV)</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            docCrlvUrl ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-rose-950 text-rose-300 border border-rose-700'
                          }`}>
                            {docCrlvUrl ? '✓ Anexado' : 'Pendente'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          CRLV digital do ano vigente emitido pelo Detran (PDF ou Foto).
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {docCrlvUrl && (
                          <a
                            href={docCrlvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir ↗
                          </a>
                        )}
                        <label
                          htmlFor="doc-crlv-file"
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {docUploading === 'crlv' ? 'Enviando...' : docCrlvUrl ? 'Substituir' : 'Anexar (PDF/Foto)'}
                        </label>
                        <input
                          id="doc-crlv-file"
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={docUploading === 'crlv'}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDoc(file, 'crlv');
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Comprovante de Residência */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">Comprovante de Residência</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            docProofAddressUrl ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {docProofAddressUrl ? '✓ Anexado' : 'Opcional'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Conta de luz, água ou fatura recente no Litoral Norte (PDF ou Foto).
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {docProofAddressUrl && (
                          <a
                            href={docProofAddressUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir ↗
                          </a>
                        )}
                        <label
                          htmlFor="doc-residencia-file"
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {docUploading === 'residencia' ? 'Enviando...' : docProofAddressUrl ? 'Substituir' : 'Anexar (PDF/Foto)'}
                        </label>
                        <input
                          id="doc-residencia-file"
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={docUploading === 'residencia'}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDoc(file, 'residencia');
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Antecedentes Criminais */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">Certidão de Antecedentes Criminais</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            docCriminalUrl ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-rose-950 text-rose-300 border border-rose-700'
                          }`}>
                            {docCriminalUrl ? '✓ Anexado' : 'Pendente'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Emitida online pela Polícia Civil de SP (PDF ou Foto).
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {docCriminalUrl && (
                          <a
                            href={docCriminalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir ↗
                          </a>
                        )}
                        <label
                          htmlFor="doc-antecedentes-file"
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {docUploading === 'antecedentes' ? 'Enviando...' : docCriminalUrl ? 'Substituir' : 'Anexar (PDF/Foto)'}
                        </label>
                        <input
                          id="doc-antecedentes-file"
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={docUploading === 'antecedentes'}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDoc(file, 'antecedentes');
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* MODAL ACTIONS */}
                <div className="flex gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 transition-all hover:scale-[1.01]"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {profileSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* DRIVER EMERGENCY CANCELLATION MODAL */}
      {showDriverEmergencyModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200"
            onClick={() => !driverEmergencySubmitting && setShowDriverEmergencyModal(false)}
          >
            <div
              className="bg-slate-900 border-2 border-rose-600 rounded-2xl max-w-lg w-full p-6 space-y-4 relative my-auto animate-in zoom-in-95 duration-150 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start pb-3 border-b border-rose-950">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-950 border border-rose-600 flex items-center justify-center text-rose-400 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Cancelamento Emergencial da Viagem
                    </h3>
                    <span className="text-[10px] font-semibold text-rose-400">
                      Viagem já iniciada • Exclusivo para imprevistos graves
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={driverEmergencySubmitting}
                  onClick={() => setShowDriverEmergencyModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Atenção: A corrida já está em andamento!</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Por segurança mútua e transparência na plataforma VaiCar, viagens em andamento só podem ser canceladas por força maior (pane mecânica do veículo, colisão/acidente, emergência médica ou risco à segurança). O registro é enviado para auditoria da administração.
                </p>
              </div>

              <form onSubmit={handleConfirmDriverEmergencyCancel} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tipo de Emergência
                  </label>
                  <select
                    value={driverEmergencyType}
                    onChange={(e) => setDriverEmergencyType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
                  >
                    <option value="Pane mecânica no veículo">Pane mecânica no veículo (motor/pneu/bateria)</option>
                    <option value="Colisão ou acidente de trânsito">Colisão ou acidente de trânsito</option>
                    <option value="Emergência médica (passageiro ou motorista)">Emergência médica (passageiro ou motorista)</option>
                    <option value="Risco à segurança ou desentendimento grave">Risco à integridade física / desentendimento grave</option>
                    <option value="Outro motivo de força maior">Outro motivo grave de força maior</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Justificativa e Detalhes da Emergência <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={driverEmergencyDetails}
                    onChange={(e) => setDriverEmergencyDetails(e.target.value)}
                    placeholder="Descreva o ocorrido em detalhes (ex: furou o pneu na serra e precisei parar o veículo com segurança)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={driverEmergencySubmitting}
                    onClick={() => setShowDriverEmergencyModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Voltar para a Viagem
                  </button>
                  <button
                    type="submit"
                    disabled={driverEmergencySubmitting || !driverEmergencyDetails.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-bold text-white transition-all shadow-lg flex items-center justify-center gap-1.5"
                  >
                    {driverEmergencySubmitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Driver Pricing Configuration Modal */}
      <DriverPricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        onPricingUpdated={(newPricing) => {
          setDriver((prev) => (prev ? { ...prev, customPricing: newPricing } : prev));
        }}
      />
    </div>
  );
};
