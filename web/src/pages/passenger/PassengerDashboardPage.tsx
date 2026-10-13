import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Ride, PaymentMethod, Receipt, ServiceType, PassengerReferralSummary } from '../../../../shared/src/types.js';
import {
  MapPin,
  Navigation,
  CreditCard,
  Banknote,
  QrCode,
  Car,
  Clock,
  Shield,
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
  ExternalLink,
  Package,
  Gift,
  Copy,
  Check,
  Share2,
} from 'lucide-react';
import { ReportModal } from '../../components/ReportModal.js';

export const PassengerDashboardPage: React.FC = () => {
  const { user, profile, passenger, logout } = useAuth();
  const navigate = useNavigate();

  // Locations state: clean initial state with zero preset/hardcoded coordinates
  const [pickup, setPickup] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [pickupInput, setPickupInput] = useState('');
  const [destination, setDestination] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [destinationInput, setDestinationInput] = useState('');
  const [popularPlaces, setPopularPlaces] = useState<KnownLocation[]>([]);

  // State-change notification tracking (prevents duplicate notifications across polling cycles)
  const lastNotifiedStatusRef = useRef<string | null>(null);

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

  // Drivers and estimate
  const [onlineDrivers, setOnlineDrivers] = useState<PublicDriverMarker[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateRideResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');

  // Service mode state ('ride' by default, preserving existing passenger flow)
  const [serviceType, setServiceType] = useState<ServiceType>('ride');

  // Delivery details state
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [packageNotes, setPackageNotes] = useState('');

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
  // Emergency cancellation state
  const [showEmergencyCancelModal, setShowEmergencyCancelModal] = useState(false);
  const [emergencyReasonType, setEmergencyReasonType] = useState('Pane mecânica no veículo');
  const [emergencyDetails, setEmergencyDetails] = useState('');
  const [emergencySubmitting, setEmergencySubmitting] = useState(false);

  // Referral system state
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralSummary, setReferralSummary] = useState<PassengerReferralSummary | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [useReferralCredit, setUseReferralCredit] = useState(false);

  const loadReferralSummary = useCallback(async () => {
    try {
      setReferralLoading(true);
      const res = await passengersApi.getReferralSummary();
      setReferralSummary(res);
    } catch (err) {
      console.error('Falha ao carregar dados de indicação:', err);
    } finally {
      setReferralLoading(false);
    }
  }, []);

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

  // Sync profile details & referral summary
  useEffect(() => {
    if (passenger) {
      setEditName(passenger.name);
      setEditWhatsapp(passenger.whatsapp);
      setEditPhotoUrl(passenger.photoUrl || '');
      loadReferralSummary();
    } else if (profile) {
      setEditName(profile.displayName);
      setEditWhatsapp(profile.whatsapp || '');
      setEditPhotoUrl(profile.photoUrl || '');
      loadReferralSummary();
    }
  }, [passenger, profile, loadReferralSummary]);

  // Check active ride on load and sync map points only if an authentic active ride exists
  const refreshActiveRide = useCallback(async () => {
    // Purge any stale client-side storage keys
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('vaicar_active_ride');
        localStorage.removeItem('active_ride_id');
        sessionStorage.removeItem('vaicar_active_ride');
        sessionStorage.removeItem('active_ride_id');
      }
    } catch {
      // Ignored
    }

    if (!user) {
      setActiveRide(null);
      setPickup(null);
      setPickupInput('');
      setDestination(null);
      setDestinationInput('');
      setEstimate(null);
      return;
    }

    try {
      const active = await passengersApi.getActiveRide();

      // STRICT ACTIVE STATUSES ONLY:
      // Only these active states may restore the active ride UI per production rules:
      const genuineActiveStatuses: RideStatus[] = [
        'REQUESTED',
        'OFFERED',
        'ACCEPTED',
        'DRIVER_ARRIVING',
        'ARRIVED',
        'IN_PROGRESS',
      ];

      if (active && genuineActiveStatuses.includes(active.status)) {
        setActiveRide(active);
        if (active.origin) {
          setPickup({ address: active.origin.address, lat: active.origin.lat, lng: active.origin.lng });
          setPickupInput(active.origin.address);
        }
        if (active.destination) {
          setDestination({ address: active.destination.address, lat: active.destination.lat, lng: active.destination.lng });
          setDestinationInput(active.destination.address);
        }
        lastNotifiedStatusRef.current = active.status;
      } else {
        // If null or terminal state (COMPLETED, CANCELLED_*, etc.), ensure completely empty UI
        setActiveRide(null);
        setPickup(null);
        setPickupInput('');
        setDestination(null);
        setDestinationInput('');
        setEstimate(null);
        lastNotifiedStatusRef.current = null;
      }
    } catch {
      setActiveRide(null);
      setPickup(null);
      setPickupInput('');
      setDestination(null);
      setDestinationInput('');
      setEstimate(null);
      lastNotifiedStatusRef.current = null;
    }
  }, [user]);

  useEffect(() => {
    refreshActiveRide();
  }, [refreshActiveRide]);

  // Browser state-change notification helper (only called upon status change)
  const notifyRideStatusChange = useCallback((ride: Ride) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    let title = 'VaiCar';
    let body = '';

    switch (ride.status) {
      case 'ACCEPTED':
        title = ride.serviceType === 'delivery' ? 'Entregador a caminho!' : 'Motorista a caminho!';
        body = `${ride.driverName || 'O condutor parceiro'} aceitou seu pedido e está a caminho do ponto de embarque.`;
        break;
      case 'DRIVER_ARRIVING':
        title = 'Condutor se aproximando!';
        body = `${ride.driverName || 'O condutor'} está chegando ao local de embarque/coleta.`;
        break;
      case 'ARRIVED':
        title = ride.serviceType === 'delivery' ? 'Entregador no local de coleta!' : 'Motorista no local de embarque!';
        body = `${ride.driverName || 'O condutor'} chegou ao ponto de partida.`;
        break;
      case 'IN_PROGRESS':
        title = ride.serviceType === 'delivery' ? 'Entrega em andamento' : 'Viagem iniciada';
        body = 'Tenha uma excelente viagem!';
        break;
      case 'COMPLETED':
        title = ride.serviceType === 'delivery' ? 'Entrega concluída!' : 'Viagem concluída!';
        body = `Viagem finalizada no valor de R$ ${ride.fareAmount.toFixed(2)}.`;
        break;
      case 'CANCELLED_BY_DRIVER':
        title = 'Motorista cancelou a corrida';
        body = 'Buscando outro motorista parceiro disponível nas proximidades...';
        break;
      case 'CANCELLED_BY_ADMIN':
        title = 'Corrida cancelada pela administração';
        body = ride.cancelReason ? `Motivo: ${ride.cancelReason}` : 'A corrida foi cancelada pela central VaiCar.';
        break;
      case 'CANCELLED_BY_SYSTEM':
        title = 'Nenhum condutor disponível';
        body = 'Não encontramos motoristas disponíveis no momento. Tente novamente em alguns minutos.';
        break;
      default:
        return;
    }

    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
      });
    } catch {
      // Ignored
    }
  }, []);

  // Polling active ride and driver GPS when ride is active (refreshes every 2.5s)
  useEffect(() => {
    if (!activeRide) return;

    // Terminal statuses where polling should immediately halt
    const terminalStatuses = ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_SYSTEM', 'CANCELLED_BY_ADMIN'];
    if (terminalStatuses.includes(activeRide.status)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const [updated, drivers] = await Promise.all([
          ridesApi.getById(activeRide.id),
          driversApi.getOnlineDrivers(),
        ]);

        setActiveRide(updated);
        setOnlineDrivers(drivers);

        // State-change notification trigger (fires once per state change, never duplicates on poll)
        if (lastNotifiedStatusRef.current !== updated.status) {
          lastNotifiedStatusRef.current = updated.status;
          notifyRideStatusChange(updated);
        }

        // Terminal cancellation stops polling
        if (terminalStatuses.includes(updated.status)) {
          clearInterval(interval);
          return;
        }

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
        console.error('Ride/driver poll error:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status, activeRide?.paymentStatus, activeRide?.paymentApprovedByDriver, notifyRideStatusChange]);

  // Real-time SSE event listener for immediate ride status updates & instant cancellation broadcast
  useEffect(() => {
    if (typeof window === 'undefined' || !activeRide) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const sseUrl = `/api/v1/live/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    let es: EventSource | null = null;
    try {
      es = new EventSource(sseUrl);

      const handleRideEvent = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          const rideData = payload.data || payload;
          if (rideData && rideData.id === activeRide.id) {
            setActiveRide(rideData);
            if (lastNotifiedStatusRef.current !== rideData.status) {
              lastNotifiedStatusRef.current = rideData.status;
              notifyRideStatusChange(rideData);
            }
          }
        } catch (err) {
          console.debug('[SSE] Failed to parse ride event:', err);
        }
      };

      es.addEventListener('RIDE_UPDATED', handleRideEvent);
      es.addEventListener('RIDE_CANCELLED', handleRideEvent);
      es.addEventListener('message', handleRideEvent);
    } catch (err) {
      console.warn('[SSE] EventSource init failed:', err);
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [activeRide?.id, notifyRideStatusChange]);

  // Assigned driver resolution and real-time GPS telemetry validation
  const assignedDriver = useMemo(() => {
    if (!activeRide?.driverId) return null;
    return onlineDrivers.find((d) => d.uid === activeRide.driverId) || null;
  }, [activeRide?.driverId, onlineDrivers]);

  // Evaluates driver telemetry freshness: fresh if updatedAt is within the last 60 seconds
  const isDriverGpsFresh = useMemo(() => {
    if (!assignedDriver?.currentLocation?.updatedAt) return false;
    const updatedTime = new Date(assignedDriver.currentLocation.updatedAt).getTime();
    if (isNaN(updatedTime)) return false;
    return (Date.now() - updatedTime) <= 60000;
  }, [assignedDriver?.currentLocation?.updatedAt]);

  // Live driver position: only supplied when fresh (never shows stale/frozen coordinates as live)
  const liveDriverLocation = useMemo(() => {
    if (!assignedDriver?.currentLocation) return null;
    if (!isDriverGpsFresh) return null;
    return assignedDriver.currentLocation;
  }, [assignedDriver?.currentLocation, isDriverGpsFresh]);

  // Dynamic tooltip for assigned driver marker based on real ride status (only approaching states show "a caminho")
  const assignedTooltip = useMemo(() => {
    if (!activeRide?.driverId) return undefined;
    if (activeRide.status === 'DRIVER_ARRIVING') return 'Seu motorista está se aproximando!';
    if (activeRide.status === 'ACCEPTED') return 'Seu motorista está a caminho!';
    if (activeRide.status === 'ARRIVED') return 'Motorista no local de embarque!';
    if (activeRide.status === 'IN_PROGRESS') return 'Viagem em andamento';
    return undefined;
  }, [activeRide?.driverId, activeRide?.status]);

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

  // Recalculate estimate only when both pickup and destination coordinates exist
  useEffect(() => {
    if (pickup?.lat && pickup?.lng && destination?.lat && destination?.lng) {
      ridesApi
        .estimate({
          origin: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
          destination: { address: destination.address, lat: destination.lat, lng: destination.lng },
          serviceType,
          applyReferralCredit: useReferralCredit && (referralSummary?.referralCreditBalance ?? 0) >= 5,
        })
        .then(setEstimate)
        .catch(console.error);
    } else {
      setEstimate(null);
    }
  }, [pickup, destination, serviceType, useReferralCredit, referralSummary?.referralCreditBalance]);

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
    if (!pickup) {
      setError(
        serviceType === 'delivery'
          ? 'Selecione o local de retirada (coleta) da encomenda.'
          : 'Selecione seu local de partida (embarque).'
      );
      return;
    }
    if (!destination) {
      setError(
        serviceType === 'delivery'
          ? 'Selecione o endereço de entrega da encomenda.'
          : 'Selecione um destino para a corrida.'
      );
      return;
    }
    if (!user) {
      navigate('/passenger/login');
      return;
    }

    if (serviceType === 'delivery') {
      if (!recipientName.trim()) {
        setError('Informe o nome de quem receberá a entrega.');
        return;
      }
      if (!recipientPhone.trim()) {
        setError('Informe o telefone ou WhatsApp de quem receberá a entrega.');
        return;
      }
    }

    if (onlineDrivers.length === 0 && !selectedDriverId) {
      const partnerText = serviceType === 'delivery' ? 'entregadores ou motoristas' : 'motoristas';
      const proceed = window.confirm(
        `Atenção: Não há ${partnerText} online no aplicativo neste momento em São Sebastião.\n\nClique em OK para registrar o pedido no sistema e aguardar um profissional conectar, ou Cancelar para acionar o grupo no WhatsApp.`
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
        serviceType,
        applyReferralCredit: useReferralCredit && (referralSummary?.referralCreditBalance ?? 0) >= 5,
        deliveryDetails:
          serviceType === 'delivery'
            ? {
                recipientName: recipientName.trim(),
                recipientPhone: recipientPhone.trim(),
                packageNotes: packageNotes.trim() || undefined,
              }
            : undefined,
      });
      setActiveRide(ride);
      setUseReferralCredit(false);
      loadReferralSummary();
      lastNotifiedStatusRef.current = ride.status;
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || (serviceType === 'delivery' ? 'Falha ao solicitar entrega.' : 'Falha ao solicitar corrida.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;

    if (activeRide.status === 'IN_PROGRESS') {
      setShowEmergencyCancelModal(true);
      return;
    }

    if (!window.confirm('Tem certeza que deseja cancelar esta corrida?')) return;

    try {
      await ridesApi.cancel(activeRide.id, 'Cancelado pelo passageiro');
      setActiveRide(null);
      setPickup(null);
      setPickupInput('');
      setDestination(null);
      setDestinationInput('');
      setEstimate(null);
      lastNotifiedStatusRef.current = null;
    } catch (err: any) {
      setError(err.message || 'Falha ao cancelar corrida.');
    }
  };

  const handleConfirmEmergencyCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRide) return;
    if (!emergencyDetails.trim()) {
      setError('Informe o detalhamento da ocorrência emergencial.');
      return;
    }

    setEmergencySubmitting(true);
    setError(null);
    try {
      const fullReason = `${emergencyReasonType}: ${emergencyDetails.trim()}`;
      await ridesApi.cancel(activeRide.id, fullReason, true);
      setShowEmergencyCancelModal(false);
      setEmergencyDetails('');
      setActiveRide(null);
      setPickup(null);
      setPickupInput('');
      setDestination(null);
      setDestinationInput('');
      setEstimate(null);
      lastNotifiedStatusRef.current = null;
      alert('Cancelamento emergencial registrado com sucesso. A equipe do VaiCar foi notificada da ocorrência.');
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar cancelamento emergencial.');
    } finally {
      setEmergencySubmitting(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!activeRide) return;
    try {
      await ridesApi.rate(activeRide.id, ratingStars, ratingFeedback);
      setShowRatingModal(false);
      setActiveRide(null);
      setPickup(null);
      setPickupInput('');
      setDestination(null);
      setDestinationInput('');
      setEstimate(null);
      lastNotifiedStatusRef.current = null;
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

  // Filter for valid GPS and strict telemetry freshness (<= 60 seconds)
  const freshOnlineDrivers = useMemo(() => {
    const now = Date.now();
    return onlineDrivers.filter((d) => {
      if (!d.currentLocation?.lat || !d.currentLocation?.lng || !d.currentLocation?.updatedAt) return false;
      if (typeof d.currentLocation.lat !== 'number' || typeof d.currentLocation.lng !== 'number') return false;
      if (isNaN(d.currentLocation.lat) || isNaN(d.currentLocation.lng)) return false;
      if (d.currentLocation.lat === 0 && d.currentLocation.lng === 0) return false;
      const t = new Date(d.currentLocation.updatedAt).getTime();
      if (isNaN(t)) return false;
      const age = now - t;
      // Authoritative backend enforces 60s; client allows up to 75s for clock skew / poll interval
      return age >= -10000 && age <= 75000;
    });
  }, [onlineDrivers]);

  const displayOnlineDrivers = useMemo(() => {
    return freshOnlineDrivers.filter((d) =>
      d.servicesOffered ? d.servicesOffered.includes(serviceType) : true
    );
  }, [freshOnlineDrivers, serviceType]);

  const displayDriversCount = estimate?.availableDrivers?.length ?? displayOnlineDrivers.length;

  const selectedDriver = estimate?.availableDrivers?.find((d) => d.driverId === selectedDriverId);
  const activeFareAmount = selectedDriver ? selectedDriver.fareAmount : (estimate?.fareAmount ?? 0);
  const activeOriginalFare = selectedDriver ? (selectedDriver.originalFareAmount ?? selectedDriver.fareAmount) : (estimate?.originalFareAmount ?? 0);
  const activeDiscountApplied = selectedDriver ? (selectedDriver.discountApplied ?? false) : (estimate?.discountApplied ?? false);
  const activeDriverEntitlement = selectedDriver ? (selectedDriver.driverTotalEntitlement ?? selectedDriver.originalFareAmount ?? selectedDriver.fareAmount) : (estimate?.driverTotalEntitlement ?? estimate?.originalFareAmount ?? estimate?.fareAmount ?? 0);
  const activePlatformSubsidy = selectedDriver ? (selectedDriver.platformSubsidyAmount ?? 0) : (estimate?.platformSubsidyAmount ?? 0);

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
          {user && (
            <button
              onClick={() => {
                setShowReferralModal(true);
                loadReferralSummary();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900 text-xs font-semibold text-emerald-300 transition-colors shadow-sm"
              title="Indique e Ganhe R$ 5,00 por amigo"
            >
              <Gift className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Indique e Ganhe</span>
              <span className="sm:hidden">Ganhe R$ 5</span>
            </button>
          )}

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
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {activeRide.serviceType === 'delivery' ? 'Aguardando Entregador' : 'Aguardando Motorista'}
                    </span>
                  </div>
                  <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-700">
                    Pagamento Pendente
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-600/60 text-xs text-amber-200 space-y-2">
                  <div className="font-extrabold text-sm text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      {activeRide.serviceType === 'delivery'
                        ? 'Entrega Concluída • Confirmação de Pagamento'
                        : 'Viagem Concluída • Confirmação de Pagamento'}
                    </span>
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    O {activeRide.serviceType === 'delivery' ? 'entregador parceiro' : 'motorista parceiro'} precisa <strong>aprovar o recebimento do pagamento</strong> no aplicativo dele para que novas {activeRide.serviceType === 'delivery' ? 'entregas' : 'corridas'} possam ser solicitadas.
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
                          {activeRide.vehicle?.type === 'bicycle'
                            ? '🚲 Bicicleta'
                            : activeRide.vehicle?.type === 'motorcycle'
                            ? `🛵 Moto • ${activeRide.vehicle?.brand || ''} ${activeRide.vehicle?.model || ''}`
                            : `🚗 ${activeRide.vehicle?.brand || ''} ${activeRide.vehicle?.model || ''} (${activeRide.vehicle?.plate || ''})`}
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
                      💡 <strong>Pagamento via Pix:</strong> Efetue a transferência diretamente para a chave Pix informada pelo {activeRide.serviceType === 'delivery' ? 'entregador' : 'motorista'} e peça para ele clicar em <strong>"Confirmar Pagamento Recebido"</strong> no celular dele.
                    </div>
                  )}
                </div>

                {/* Verification in real time */}
                <div className="space-y-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    <span>Verificando confirmação do {activeRide.serviceType === 'delivery' ? 'entregador' : 'motorista'} automaticamente em tempo real...</span>
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
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {activeRide.serviceType === 'delivery' ? 'Status da Entrega' : 'Status da Viagem'}
                  </span>
                  <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700">
                    {activeRide.serviceType === 'delivery'
                      ? activeRide.status === 'REQUESTED'
                        ? 'Aguardando entregador...'
                        : activeRide.status === 'DRIVER_ARRIVING' || activeRide.status === 'ACCEPTED'
                        ? 'Entregador a caminho do ponto de coleta'
                        : activeRide.status === 'ARRIVED'
                        ? 'Entregador no local de coleta'
                        : activeRide.status === 'IN_PROGRESS'
                        ? 'Encomenda em trânsito'
                        : activeRide.status === 'COMPLETED'
                        ? 'Encomenda entregue'
                        : activeRide.status.replace(/_/g, ' ')
                      : activeRide.status.replace(/_/g, ' ')}
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
                        {activeRide.vehicle?.type === 'bicycle'
                          ? '🚲 Bicicleta'
                          : activeRide.vehicle?.type === 'motorcycle'
                          ? `🛵 Moto • ${activeRide.vehicle?.brand || ''} ${activeRide.vehicle?.model || ''}`
                          : `🚗 ${activeRide.vehicle?.brand || ''} ${activeRide.vehicle?.model || ''} • ${activeRide.vehicle?.color || ''}`}
                      </span>
                      {activeRide.vehicle?.plate && (
                        <span className="text-emerald-400 font-mono font-bold block mt-0.5">
                          Placa: {activeRide.vehicle.plate}
                        </span>
                      )}
                      {!isDriverGpsFresh && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mt-1 font-semibold">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>Aguardando sinal de GPS recente do condutor...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center text-xs text-slate-400 space-y-1">
                    <div className="flex justify-center">
                      {activeRide.serviceType === 'delivery' ? (
                        <Package className="w-8 h-8 text-emerald-400 animate-bounce" />
                      ) : (
                        <Car className="w-8 h-8 text-emerald-400 animate-bounce" />
                      )}
                    </div>
                    <p className="font-semibold text-white">
                      {activeRide.serviceType === 'delivery'
                        ? 'Buscando entregadores parceiros próximos...'
                        : 'Buscando motoristas parceiros próximos...'}
                    </p>
                    <p className="text-[11px]">
                      {activeRide.serviceType === 'delivery'
                        ? 'Sua encomenda está sendo enviada aos entregadores na região.'
                        : 'Sua corrida está sendo enviada aos veículos na região.'}
                    </p>

                    {activeRide.lastDriverCancelledAt && (
                      <div className="p-3 mt-2 bg-amber-950/70 border border-amber-500/60 rounded-xl text-amber-300 text-xs text-left space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-400">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Motorista cancelou a corrida</span>
                        </div>
                        <p className="text-[11px] text-amber-200/80">
                          Procurando outro motorista disponível nas proximidades...
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Route Summary */}
                <div className="space-y-2 text-xs bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300">
                      {activeRide.serviceType === 'delivery' ? <strong className="text-emerald-400">Coleta: </strong> : null}
                      {activeRide.origin.address}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-800/80">
                    <Navigation className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300">
                      {activeRide.serviceType === 'delivery' ? <strong className="text-rose-400">Entrega: </strong> : null}
                      {activeRide.destination.address}
                    </span>
                  </div>

                  {activeRide.deliveryDetails && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Destinatário:</span>
                        <span className="font-semibold text-white">{activeRide.deliveryDetails.recipientName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">WhatsApp / Tel:</span>
                        <span className="font-mono text-emerald-400">{activeRide.deliveryDetails.recipientPhone}</span>
                      </div>
                      {activeRide.deliveryDetails.packageNotes && (
                        <div className="text-[10px] text-slate-400">
                          <span className="text-slate-500">Pacote / Obs:</span> {activeRide.deliveryDetails.packageNotes}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between pt-2 border-t border-slate-800 text-emerald-400 font-bold">
                    <span>Valor: R$ {activeRide.fareAmount.toFixed(2)}</span>
                    <span>Forma: {activeRide.paymentMethod}</span>
                  </div>
                  {activeRide.discountApplied && (
                    <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <span>{activeRide.referralDiscountApplied ? '🎁' : '🏷️'}</span>
                      <span>
                        {activeRide.referralDiscountApplied
                          ? 'R$ 5,00 de Desconto por Indicação incluso'
                          : '5% de Desconto de Passageiro Verificado incluso'}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-amber-300/90 pt-1.5 border-t border-slate-800/80">
                    💵 <strong>Pagamento Direto:</strong> Pague diretamente ao {activeRide.serviceType === 'delivery' ? 'entregador' : 'motorista'} via Pix, cartão ou dinheiro.
                  </div>
                </div>

                {/* Real-time External GPS Navigation (Google Maps & Waze) */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-emerald-400" /> Acompanhar no GPS Externo:
                    </span>
                    <span className="text-[10px] text-slate-500">1 toque</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${activeRide.destination.lat},${activeRide.destination.lng}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Google Maps
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${activeRide.destination.lat},${activeRide.destination.lng}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Waze
                    </a>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {activeRide.status !== 'COMPLETED' && !activeRide.status.startsWith('CANCELLED') && (
                      activeRide.status === 'IN_PROGRESS' ? (
                        <button
                          type="button"
                          onClick={() => setShowEmergencyCancelModal(true)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600 text-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          Cancelar por Emergência
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCancelRide}
                          className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                        >
                          {activeRide.serviceType === 'delivery' ? 'Cancelar Entrega' : 'Cancelar Corrida'}
                        </button>
                      )
                    )}
                    {(activeRide.status === 'COMPLETED' || activeRide.status.startsWith('CANCELLED')) && (
                      <button
                        onClick={() => {
                          setActiveRide(null);
                          setPickup(null);
                          setPickupInput('');
                          setDestination(null);
                          setDestinationInput('');
                          setEstimate(null);
                          lastNotifiedStatusRef.current = null;
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                      >
                        {activeRide.serviceType === 'delivery' ? 'Pedir Nova Entrega' : 'Pedir Nova Corrida'}
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

                  {activeRide.status === 'IN_PROGRESS' && (
                    <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        {activeRide.serviceType === 'delivery'
                          ? 'Entrega em andamento. Cancelamento normal bloqueado pelo sistema por segurança, exceto em emergência.'
                          : 'Viagem em andamento. Cancelamento normal bloqueado pelo sistema por segurança, exceto em emergência.'}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setReportTarget({ rideId: activeRide.id, targetName: activeRide.driverName });
                      setShowReportModal(true);
                    }}
                    className="w-full py-2 rounded-xl bg-slate-950 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-800 text-slate-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    {activeRide.serviceType === 'delivery' ? 'Reportar Problema com o Entregador' : 'Reportar Problema com o Motorista'}
                  </button>
                </div>
              </div>
            )
          ) : (
            /* RIDE / DELIVERY REQUEST FORM */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {serviceType === 'delivery' ? (
                    <>
                      <Package className="w-4 h-4 text-emerald-400" /> Nova Entrega em São Sebastião
                    </>
                  ) : (
                    <>
                      <Car className="w-4 h-4 text-emerald-400" /> Nova Corrida em São Sebastião
                    </>
                  )}
                </h3>
                <span className={`text-[11px] font-semibold ${displayDriversCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {displayDriversCount > 0
                    ? `${displayDriversCount} ${serviceType === 'delivery' ? 'entregadores/veículos' : 'veículos'} online`
                    : '0 online no momento'}
                </span>
              </div>

              {/* Service Mode Selector: Corrida vs Entrega */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setServiceType('ride');
                    setSelectedDriverId(null);
                  }}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    serviceType === 'ride'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Car className="w-4 h-4" />
                  <span>🚗 CORRIDA</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setServiceType('delivery');
                    setSelectedDriverId(null);
                  }}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    serviceType === 'delivery'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>📦 ENTREGA</span>
                </button>
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
                label={serviceType === 'delivery' ? 'De onde você vai enviar a encomenda?' : 'De onde você vai?'}
                placeholder="Digite seu local de partida, rua ou ponto de referência..."
                value={pickupInput}
                onChange={setPickupInput}
                onSelectPlace={handleSelectPickup}
                onUseCurrentLocation={requestPassengerGps}
                isLocating={gpsLoading}
                icon="pickup"
                helperText={
                  hasUserGps
                    ? '📍 Localização exata obtida via GPS do dispositivo.'
                    : 'Digite o endereço ou use o GPS do dispositivo.'
                }
              />
              {!pickupInput.trim() && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={requestPassengerGps}
                    disabled={gpsLoading}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900 text-emerald-300 font-semibold transition-colors flex items-center gap-1"
                  >
                    🎯 Usar Meu GPS
                  </button>
                </div>
              )}

              {/* Destination PlaceAutocompleteInput */}
              <PlaceAutocompleteInput
                label={serviceType === 'delivery' ? 'Para onde você quer entregar?' : 'Para onde você vai?'}
                placeholder="Digite seu destino, endereço, praia ou bairro..."
                value={destinationInput}
                onChange={setDestinationInput}
                onSelectPlace={handleSelectDestination}
                icon="destination"
                helperText={
                  serviceType === 'delivery'
                    ? 'Onde a encomenda deve ser entregue. Você também pode arrastar o pino vermelho ou clicar no mapa.'
                    : 'Busca aberta para qualquer cidade ou região. Você também pode arrastar o pino vermelho ou clicar no mapa.'
                }
              />

              {/* Delivery Recipient Details (Only when serviceType === 'delivery') */}
              {serviceType === 'delivery' && (
                <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 pb-1 border-b border-slate-800">
                    <Package className="w-4 h-4" />
                    <span>Informações de Entrega & Destinatário</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Nome de Quem Recebe <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Silva"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      WhatsApp / Telefone de Quem Recebe <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="Ex: (12) 99123-4567"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      O que será transportado? (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Documentos em envelope, caixa pequena, chaves..."
                      value={packageNotes}
                      onChange={(e) => setPackageNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Dica: Ajuda o entregador a saber o tamanho do pacote antes de aceitar.
                    </span>
                  </div>
                </div>
              )}

              {/* Quick Popular Destinos (Shortcuts) */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Destinos Populares (Litoral Norte):
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
                    {serviceType === 'delivery'
                      ? 'Escolha o Entregador por Tarifa e Proximidade:'
                      : 'Escolha o Motorista por Preço e Proximidade:'}
                  </label>
                  <span className={`text-[11px] font-semibold ${displayDriversCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {displayDriversCount > 0
                      ? `${displayDriversCount} disponíveis na cidade`
                      : '0 online no momento'}
                  </span>
                </div>

                {displayDriversCount === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>
                        {serviceType === 'delivery'
                          ? 'Não há entregadores disponíveis no momento.'
                          : 'Não há motoristas disponíveis no momento.'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {serviceType === 'delivery'
                        ? 'Nenhum entregador parceiro credenciado disponível nesta área de atendimento no momento. O mapa exibe apenas parceiros reais credenciados e com sinal de GPS atualizado na região. Você pode acionar o grupo oficial no WhatsApp:'
                        : 'Nenhum motorista parceiro credenciado disponível nesta área de atendimento no momento. O mapa exibe apenas motoristas reais credenciados e com sinal de GPS atualizado na região. Você pode acionar o grupo oficial no WhatsApp:'}
                    </p>
                    <a
                      href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-lg"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Pedir no Grupo WhatsApp dos Parceiros
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
                            <span className="text-xs font-bold block">
                              {serviceType === 'delivery' ? 'Mais Rápido / Melhor Tarifa de Entrega' : 'Mais Rápido / Melhor Tarifa'}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 font-bold uppercase">
                              Automático
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {serviceType === 'delivery'
                              ? 'Chama o primeiro entregador disponível mais próximo'
                              : 'Chama o primeiro motorista disponível mais próximo'}
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
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium">
                                    {isBike ? '🚲 Bicicleta' : isMoto ? '🛵 Moto' : '🚗 Carro'}
                                  </span>
                                  {d.isFixedRoute && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                                      🏷️ Rota Fixa
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                                  {isBike
                                    ? 'Entrega de Bicicleta'
                                    : `${d.vehicle?.brand || ''} ${d.vehicle?.model || ''} (${d.vehicle?.color || ''})${d.vehicle?.plate ? ` • ${d.vehicle.plate}` : ''}`}
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
                      /* When no destination selected yet, list online drivers matching service */
                      displayOnlineDrivers.map((d) => {
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
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium">
                                    {isBike ? '🚲 Bicicleta' : isMoto ? '🛵 Moto' : '🚗 Carro'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block truncate max-w-[200px]">
                                  {isBike ? 'Entrega de Bicicleta' : `${d.vehicle.brand} ${d.vehicle.model} (${d.vehicle.color})`}
                                  {d.vehicle.plate ? ` • ${d.vehicle.plate}` : ''}
                                </span>
                                <span className="text-[9px] text-slate-500 block">
                                  Digite o destino para ver a tarifa deste profissional
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
                  {serviceType === 'delivery'
                    ? 'Forma de Pagamento (Direto ao Entregador)'
                    : 'Forma de Pagamento (Direto no Carro)'}
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

              {/* Referral Credit Redemption Box if user has balance */}
              {referralSummary && referralSummary.referralCreditBalance >= 5 && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={useReferralCredit}
                      onChange={(e) => setUseReferralCredit(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-white block">Resgatar R$ 5,00 em créditos de indicação</span>
                      <span className="text-[10px] text-emerald-300 block">
                        Saldo disponível: R$ {referralSummary.referralCreditBalance.toFixed(2)} • O motorista recebe o valor integral!
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {/* Fare Estimate Box */}
              {estimate && (
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        {selectedDriver
                          ? `Tarifa de ${selectedDriver.name}:`
                          : serviceType === 'delivery'
                          ? 'Tarifa de Entrega (A partir de):'
                          : 'Tarifa Estimada (A partir de):'}
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
                      <span className="block font-semibold">
                        ~{estimate.durationMinutes} min {serviceType === 'delivery' ? 'de percurso' : 'de viagem'}
                      </span>
                      <span className="block text-[11px] text-slate-500">{estimate.distanceKm.toFixed(1)} km</span>
                    </div>
                  </div>

                  {estimate?.referralCreditApplied && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 flex items-center justify-between font-semibold">
                      <span>🎟️ R$ 5,00 Crédito de Indicação resgatado!</span>
                      <span>-R$ 5,00</span>
                    </div>
                  )}

                  {activeDiscountApplied && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 flex items-center justify-between font-semibold">
                      <span>
                        {estimate?.referralDiscountApplied
                          ? '🎁 R$ 5,00 Desconto por Indicação incluso!'
                          : '🏷️ 5% Desconto Passageiro Verificado incluso!'}
                      </span>
                      <span>-R$ {(activeOriginalFare - activeFareAmount).toFixed(2)}</span>
                    </div>
                  )}

                  {activePlatformSubsidy > 0 && (
                    <div className="text-[10px] text-slate-400 flex items-center justify-between bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-500/20">
                      <span>Repasse integral ao motorista:</span>
                      <span className="text-emerald-300 font-medium">
                        R$ {activeDriverEntitlement.toFixed(2)} (R$ {activeFareAmount.toFixed(2)} pago por você + R$ {activePlatformSubsidy.toFixed(2)} financiado pela VaiCar)
                      </span>
                    </div>
                  )}

                  {!activeDiscountApplied && !estimate?.referralCreditApplied && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>💡 Ganhe R$ 5 em créditos indicando amigos</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowReferralModal(true);
                          loadReferralSummary();
                        }}
                        className="text-emerald-400 font-semibold hover:underline"
                      >
                        Indique e Ganhe
                      </button>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Base de cálculo:</span>
                    {selectedDriver ? (
                      selectedDriver.isFixedRoute ? (
                        <span className="font-semibold text-emerald-400">
                          Preço Fixo da Rota ({selectedDriver.fixedRouteName})
                        </span>
                      ) : serviceType === 'delivery' && selectedDriver.customDeliveryPricing ? (
                        <span className="font-mono text-emerald-400 font-semibold">
                          Mínimo R$ {selectedDriver.customDeliveryPricing.minimumDeliveryFee.toFixed(2)} + R$ {selectedDriver.customDeliveryPricing.perKmRate.toFixed(2)}/km
                        </span>
                      ) : (
                        <span className="font-mono text-emerald-400 font-semibold">
                          Mínimo R$ {selectedDriver.customPricing?.minimumFare.toFixed(2)} + R$ {selectedDriver.customPricing?.perKmRate.toFixed(2)}/km
                          {selectedDriver.customPricing?.perMinuteRate ? ` + R$ ${selectedDriver.customPricing.perMinuteRate.toFixed(2)}/min` : ''}
                        </span>
                      )
                    ) : serviceType === 'delivery' ? (
                      <span className="font-mono text-emerald-400 font-semibold">
                        Piso Entrega: R$ 8,00 mín + R$ 1,20/km (cada entregador define sua tarifa)
                      </span>
                    ) : (
                      <span className="font-mono text-emerald-400 font-semibold">
                        Piso VaiCar: R$ 10,00 mín + R$ 1,00/km (cada motorista define sua tarifa)
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300/90 flex items-center gap-1.5">
                    <span>💵</span>
                    <span>
                      {serviceType === 'delivery'
                        ? 'Pagamento direto ao entregador (Pix, cartão ou dinheiro).'
                        : 'Pagamento direto ao motorista (Pix, cartão ou dinheiro) no veículo.'}
                    </span>
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
                  ? serviceType === 'delivery'
                    ? `Confirmar e Pedir Entrega • R$ ${estimate.fareAmount.toFixed(2)}`
                    : `Confirmar e Pedir VaiCar • R$ ${estimate.fareAmount.toFixed(2)}`
                  : serviceType === 'delivery'
                  ? 'Confirmar e Pedir Entrega'
                  : 'Confirmar e Pedir VaiCar'}
              </button>
            </div>
          )}
        </div>

        {/* Right Map View */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <MapDisplay
            pickup={pickup}
            destination={destination}
            onPickupChange={handlePickupMarkerChange}
            onDestinationChange={handleDestinationMarkerChange}
            drivers={activeRide ? [] : displayOnlineDrivers}
            selectedDriverId={selectedDriverId}
            onDriverSelect={(d) => setSelectedDriverId(d.uid)}
            pickupLabel={serviceType === 'delivery' ? 'Coleta' : 'Embarque'}
            destinationLabel={serviceType === 'delivery' ? 'Entrega' : 'Destino'}
            driverLocation={activeRide?.driverId ? liveDriverLocation : null}
            assignedDriverTooltip={assignedTooltip}
            height="560px"
            hudTitle={
              activeRide?.driverId && !isDriverGpsFresh
                ? 'Aguardando atualização de GPS do condutor...'
                : undefined
            }
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
            <h3 className="text-lg font-bold text-white">
              {activeRide?.serviceType === 'delivery' ? 'Entrega Concluída!' : 'Viagem Concluída!'}
            </h3>
            <p className="text-xs text-slate-400">
              {activeRide?.serviceType === 'delivery'
                ? 'Como foi sua experiência com o entregador?'
                : 'Como foi sua experiência com o motorista?'}
            </p>

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
              placeholder={
                activeRide?.serviceType === 'delivery'
                  ? 'Comentário opcional sobre a entrega...'
                  : 'Comentário opcional sobre a corrida...'
              }
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

      {/* EMERGENCY CANCELLATION MODAL */}
      {showEmergencyCancelModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200"
            onClick={() => !emergencySubmitting && setShowEmergencyCancelModal(false)}
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
                      Cancelamento Emergencial
                    </h3>
                    <span className="text-[10px] font-semibold text-rose-400">
                      {activeRide?.serviceType === 'delivery' ? 'Entrega já iniciada • Exclusivo para emergências' : 'Viagem já iniciada • Exclusivo para emergências'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={emergencySubmitting}
                  onClick={() => setShowEmergencyCancelModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{activeRide?.serviceType === 'delivery' ? 'Atenção: A entrega já está em andamento!' : 'Atenção: A corrida já está em andamento!'}</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Para segurança mútua do cliente e do parceiro, cancelamentos com o percurso em curso são estritamente restritos a motivos de força maior ou emergência física/mecânica. Esta ocorrência será registrada e auditada pela administração do VaiCar.
                </p>
              </div>

              <form onSubmit={handleConfirmEmergencyCancel} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tipo de Emergência
                  </label>
                  <select
                    value={emergencyReasonType}
                    onChange={(e) => setEmergencyReasonType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
                  >
                    <option value="Pane mecânica no veículo">Pane mecânica ou falha do veículo</option>
                    <option value="Colisão ou acidente de trânsito">Colisão ou acidente de trânsito</option>
                    <option value="Emergência médica / mal-estar súbito">Emergência médica / mal-estar súbito</option>
                    <option value="Risco à segurança ou ameaça à integridade">Risco à segurança / ameaça à integridade</option>
                    <option value="Outro motivo grave de força maior">Outro motivo grave de força maior</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Justificativa e Detalhes da Emergência <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={emergencyDetails}
                    onChange={(e) => setEmergencyDetails(e.target.value)}
                    placeholder="Descreva o que ocorreu (ex: o carro teve pane no motor / pneu estourou e não é possível prosseguir)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={emergencySubmitting}
                    onClick={() => setShowEmergencyCancelModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    {activeRide?.serviceType === 'delivery' ? 'Voltar para a Entrega' : 'Voltar para a Viagem'}
                  </button>
                  <button
                    type="submit"
                    disabled={emergencySubmitting || !emergencyDetails.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-bold text-white transition-all shadow-lg flex items-center justify-center gap-1.5"
                  >
                    {emergencySubmitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* REFERRAL / INDIQUE E GANHE MODAL */}
      {showReferralModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-lg rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-none">Indique e Ganhe</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Programa de Indicação VaiCar São Sebastião</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReferralModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {referralLoading ? (
                <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                  Carregando informações de indicação...
                </div>
              ) : (
                <>
                  {/* Hero Banner */}
                  <div className="bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-950 p-4 rounded-xl border border-emerald-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                        🎉 Ganhe R$ 5,00 por indicação
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Ativo
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Seu amigo ganha <strong>R$ 5,00 de desconto</strong> na primeira corrida, e você recebe <strong>R$ 5,00 em créditos</strong> assim que ele concluir a primeira viagem!
                    </p>
                  </div>

                  {/* Balance & Stats Cards */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">Disponível</span>
                      <span className="text-xs sm:text-sm font-extrabold text-emerald-400 block mt-0.5">
                        R$ {(referralSummary?.referralCreditBalance || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">Resgatado</span>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-300 block mt-0.5">
                        R$ {(referralSummary?.referralCreditRedeemed || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">Indicados</span>
                      <span className="text-xs sm:text-sm font-extrabold text-white block mt-0.5">
                        {referralSummary?.totalReferrals || 0}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">Concluídas</span>
                      <span className="text-xs sm:text-sm font-extrabold text-emerald-400 block mt-0.5">
                        {referralSummary?.completedReferrals || 0}
                      </span>
                    </div>
                  </div>

                  {/* Referral Code Box */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Seu Código de Indicação Exclusivo:
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-center font-mono text-sm font-extrabold text-emerald-400 tracking-wider">
                        {referralSummary?.referralCode || '...'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (referralSummary?.referralCode) {
                            navigator.clipboard.writeText(referralSummary.referralCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }
                        }}
                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors flex items-center gap-1.5"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>

                    {/* Share Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const url = referralSummary?.shareUrl || `https://vaicar.app/passenger/register?ref=${referralSummary?.referralCode || ''}`;
                          navigator.clipboard.writeText(url);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                      </button>

                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `Olá! Use meu código ${referralSummary?.referralCode} no VaiCar São Sebastião e ganhe R$ 5,00 de desconto na sua primeira corrida: ${referralSummary?.shareUrl || `https://vaicar.app/passenger/register?ref=${referralSummary?.referralCode || ''}`}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>

                  {/* List of Referred Friends */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">
                      Histórico de Amigos Indicados ({referralSummary?.referrals?.length || 0})
                    </span>
                    {!referralSummary?.referrals || referralSummary.referrals.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400 space-y-1">
                        <p>Nenhum amigo utilizou seu código ainda.</p>
                        <p className="text-[10px] text-slate-500">
                          Compartilhe seu link pelo WhatsApp para começar a acumular créditos!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {referralSummary.referrals.map((ref) => (
                          <div
                            key={ref.id}
                            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-white block">
                                {ref.referredName || 'Amigo Indicado'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(ref.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div>
                              {ref.status === 'REWARDED' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                  ✓ R$ {ref.rewardAmount.toFixed(2)} Recebido
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/30">
                                  ⏳ Aguardando 1ª Corrida
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
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
