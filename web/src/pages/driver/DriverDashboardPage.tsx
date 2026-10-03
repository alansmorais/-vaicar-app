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
} from 'lucide-react';
import { ReportModal } from '../../components/ReportModal.js';

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

  // Incoming ride alert popup state
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Driver Header */}
      <header className="bg-slate-900 border-b border-slate-800 py-3.5 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <img src="/vaicar_logo.png" alt="VaiCar" className="h-8 w-auto rounded object-contain" />
          </Link>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              Painel do Motorista • <span className="text-emerald-400">São Sebastião</span>
            </span>
            {driver && (
              <span className="text-[11px] text-slate-400">
                {driver.vehicle.brand} {driver.vehicle.model} ({driver.vehicle.plate})
              </span>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          {/* GPS Status Indicator / Trigger */}
          {driverGps ? (
            <div
              className="px-2.5 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              title={`GPS Exato Ativo: (${driverGps.lat.toFixed(4)}, ${driverGps.lng.toFixed(4)})`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden md:inline">GPS Ativo</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestDriverGps}
              className="px-2.5 py-2 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-300 hover:text-white hover:bg-amber-900/60 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Clique para ativar a localização GPS do seu dispositivo"
            >
              <Crosshair className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden md:inline">Ativar GPS</span>
            </button>
          )}

          {/* Custom Pricing Trigger Button */}
          <button
            type="button"
            onClick={() => setShowPricingModal(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Configurar valor mínimo, valor por km e preços fixos por rota"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Minhas Tarifas</span>
          </button>

          {/* Profile & Documents modal trigger button (Item 6 & 7) */}
          <button
            type="button"
            onClick={handleOpenProfileModal}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors relative"
            title="Atualizar dados cadastrais, veículo e anexar documentos (CNH, CRLV, PDF)"
          >
            {driver?.photoUrl ? (
              <img
                src={driver.photoUrl}
                alt={driver.name}
                className="w-5 h-5 rounded-full object-cover border border-emerald-500"
              />
            ) : (
              <User className="w-4 h-4 text-emerald-400" />
            )}
            <span className="hidden sm:inline">Meu Perfil & Docs</span>
            {driver?.documentsRequested && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
            )}
          </button>

          <button
            onClick={handleToggleOnline}
            disabled={actionLoading || !isApproved}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              !isApproved
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : isOnline
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Power className={`w-4 h-4 ${isOnline ? 'text-white' : 'text-slate-400'}`} />
            {!isApproved
              ? driver?.status === 'PENDING_APPROVAL'
                ? 'Aguardando Aprovação'
                : 'Conta Não Aprovada'
              : isOnline
              ? 'Online (Disponível)'
              : 'Ficar Online'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* GPS Permission / Geolocation Warning */}
        {gpsError && (
          <div className="p-4 rounded-2xl bg-amber-950/80 border-2 border-amber-500 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-white block">Aviso de Localização GPS</span>
                <span>{gpsError}</span>
              </div>
            </div>
            <button
              onClick={requestDriverGps}
              className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition-colors flex items-center gap-1.5"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Ativar / Autorizar GPS
            </button>
          </div>
        )}
        {planSuccessMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{planSuccessMessage}</span>
          </div>
        )}

        {paymentApprovalSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs flex items-start gap-3 shadow-xl">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-white text-sm block">Aprovação Registrada</span>
              <span>{paymentApprovalSuccessMessage}</span>
            </div>
          </div>
        )}

        {/* PENDING PAYMENTS NOTIFICATION BANNER */}
        {rideHistory.filter((r) => r.status === 'COMPLETED' && (r.paymentStatus === 'PENDING' || r.paymentApprovedByDriver === false)).length > 0 && (
          <div className="p-5 rounded-2xl bg-amber-950/80 border-2 border-amber-500 text-amber-200 text-xs space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                <h4 className="font-extrabold text-white text-sm">
                  Pagamento Pendente de Confirmação ({rideHistory.filter((r) => r.status === 'COMPLETED' && (r.paymentStatus === 'PENDING' || r.paymentApprovedByDriver === false)).length})
                </h4>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-900/60 px-2.5 py-1 rounded-full border border-amber-600">
                Ação do Motorista Requerida
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed">
              O passageiro realizou a corrida/entrega e <strong>está bloqueado na plataforma</strong> até que você aprove o recebimento do valor acordado.
              Assim que o Pix cair ou o dinheiro for entregue, clique em <strong>Confirmar Recebimento</strong> para liberar o passageiro.
            </p>

            <div className="space-y-2 pt-1">
              {rideHistory
                .filter((r) => r.status === 'COMPLETED' && (r.paymentStatus === 'PENDING' || r.paymentApprovedByDriver === false))
                .map((pr) => (
                  <div
                    key={pr.id}
                    className="bg-slate-950 p-4 rounded-xl border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{pr.passengerName}</span>
                        <span className="text-xs text-slate-400">({pr.passengerPhone})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-md">
                        {pr.origin.address} ➔ {pr.destination.address}
                      </div>
                      <div className="text-xs text-amber-300 font-semibold flex items-center gap-2">
                        <span>Valor a receber: <strong className="text-emerald-400 text-sm">R$ {pr.fareAmount.toFixed(2)}</strong></span>
                        <span>• Forma: {pr.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprovePayment(pr.id)}
                        disabled={actionLoading}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition-all hover:scale-[1.02]"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Confirmar Recebimento (R$ {pr.fareAmount.toFixed(2)})
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setReportTarget({
                            rideId: pr.id,
                            targetName: pr.passengerName,
                            amount: pr.fareAmount,
                          });
                          setShowReportModal(true);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-600 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Relatar Calote"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        Calote
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/70 text-rose-200 text-xs space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-sm text-white block">
                  {error.includes('Acesso restrito') || error.includes('não encontrado')
                    ? 'Acesso Restrito ao Painel do Motorista'
                    : 'Aviso do Sistema'}
                </span>
                <p className="leading-relaxed text-slate-300">
                  {error.includes('Acesso restrito') || error.includes('não encontrado')
                    ? 'Sua conta conectada ainda não possui um cadastro ativo de Motorista/Entregador vinculado a este e-mail. Se você já cadastrou seus dados, certifique-se de estar conectado com o mesmo e-mail do cadastro ou cadastre seu veículo.'
                    : error}
                </p>
              </div>
            </div>

            {(error.includes('Acesso restrito') || error.includes('não encontrado')) && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-900/60">
                <Link
                  to="/driver/register"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Car className="w-4 h-4" /> Cadastrar como Motorista / Entregador
                </Link>
                <Link
                  to="/passenger"
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
                >
                  Ir para Painel do Passageiro
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/driver/login');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-900/40 hover:bg-rose-900/70 text-rose-200 font-semibold text-xs border border-rose-700/50 transition-colors"
                >
                  Entrar com Conta de Motorista
                </button>
              </div>
            )}
          </div>
        )}

        {/* PENDING DOCUMENTS REQUEST CARD */}
        {driver && driver.documentsRequested && (
          <div className="p-5 rounded-2xl border bg-amber-950/60 border-amber-500 text-amber-200 text-xs space-y-3 shadow-lg">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>Documentação Solicitada pela Administração</span>
            </div>
            <div className="p-3 bg-amber-900/30 rounded-xl border border-amber-600/40 text-amber-100 text-xs space-y-1">
              <span className="font-semibold block">O administrador do VaiCar solicitou os seguintes documentos:</span>
              <p className="whitespace-pre-wrap font-mono text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-amber-500/30 text-amber-200">
                {driver.documentsRequested}
              </p>
            </div>
            <p className="text-[11px] text-amber-300/80">
              Você também recebeu um e-mail com estas orientações. Por favor, regularize os documentos solicitados para liberação da sua conta.
            </p>
          </div>
        )}

        {/* APPROVAL STATUS NOTIFICATION CARD */}
        {driver && !isApproved && (
          <div
            className={`p-5 rounded-2xl border text-xs space-y-2 ${
              driver.status === 'PENDING_APPROVAL'
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>
                {driver.status === 'PENDING_APPROVAL'
                  ? 'Cadastro em Análise Administrativa'
                  : `Cadastro ${driver.status}`}
              </span>
            </div>
            <p className="leading-relaxed text-slate-300">
              {driver.status === 'PENDING_APPROVAL'
                ? 'Seus documentos e veículo estão sendo analisados pela equipe do VaiCar. Assim que sua conta for aprovada no painel administrativo, você receberá um e-mail e o botão ONLINE será habilitado.'
                : driver.rejectionReason || 'Sua solicitação de motorista foi recusada ou suspensa pela administração.'}
            </p>
          </div>
        )}

        {/* TOP STATS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400 block font-medium">Status da Conta</span>
            <span
              className={`text-sm font-extrabold block mt-0.5 ${
                isApproved ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {driver?.status === 'APPROVED'
                ? 'Aprovado'
                : driver?.status === 'PENDING_APPROVAL'
                ? 'Em Análise'
                : driver?.status === 'REJECTED'
                ? 'Recusado'
                : driver?.status === 'SUSPENDED'
                ? 'Suspenso'
                : driver?.status || 'Carregando...'}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400 block font-medium">Avaliação Média</span>
            <span className="text-sm font-extrabold text-white flex items-center gap-1 mt-0.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> {driver?.rating?.toFixed(1) || '5.0'}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400 block font-medium">Corridas Realizadas</span>
            <span className="text-sm font-extrabold text-white mt-0.5 block">
              {driver?.completedRidesCount || rideHistory.length || 0}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 block font-medium">Plano de Parceria</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold">
                  {driver?.subscriptionPlan === 'weekly_percent_10' ? 'Semanal' : 'Mensal'}
                </span>
              </div>
              <span className="text-sm font-extrabold text-emerald-400 mt-0.5 block">
                {driver?.subscriptionPlan === 'weekly_percent_10'
                  ? '10% (Acerto Semanal)'
                  : 'R$ 100/mês (Mensalidade)'}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">
                {isSwitchEligible ? (
                  <span className="text-emerald-400 font-medium">✓ Troca de plano liberada</span>
                ) : (
                  <span>
                    Troca permitida após {isWeekly ? '1 semana' : '1 mês'} ({daysRemaining}d restantes)
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedNewPlan(currentPlan === 'weekly_percent_10' ? 'monthly_100' : 'weekly_percent_10');
                setShowPlanModal(true);
              }}
              className="mt-2.5 w-full py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white transition-colors border border-slate-700 flex items-center justify-center gap-1"
            >
              Trocar de Plano
            </button>
          </div>
        </div>

        {/* ACTIVE RIDE FLOW (WHEN ON A TRIP) */}
        {activeRide && (
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Corrida em Andamento</h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700">
                {activeRide.status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Stage Timer if ARRIVED */}
            {activeRide.status === 'ARRIVED' && activeRide.waitingTimerStartedAt && (
              <WaitingTimer startedAt={activeRide.waitingTimerStartedAt} />
            )}

            {/* Passenger details */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {activeRide.passengerPhotoUrl ? (
                  <img
                    src={activeRide.passengerPhotoUrl}
                    alt={activeRide.passengerName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <span className="text-sm font-bold text-white block">{activeRide.passengerName}</span>
                  <span className="text-xs text-slate-400">{activeRide.passengerPhone}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block">Receber do Passageiro:</span>
                <div className="flex items-center justify-end gap-1.5">
                  {activeRide.discountApplied && activeRide.originalFareAmount && (
                    <span className="text-xs line-through text-slate-400">
                      R$ {activeRide.originalFareAmount.toFixed(2)}
                    </span>
                  )}
                  <span className="text-2xl font-black text-emerald-400">R$ {activeRide.fareAmount.toFixed(2)}</span>
                </div>
                {activeRide.discountApplied && (
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded mt-0.5">
                    5% OFF (Passageiro Verificado)
                  </span>
                )}
                <span className="text-[11px] text-slate-400 block mt-1">💵 Pagamento direto: {activeRide.paymentMethod}</span>
              </div>
            </div>

            {/* Addresses */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-400 block">Buscar em:</span>
                  <p className="text-slate-200">{activeRide.origin.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-2 border-t border-slate-800">
                <Navigation className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-rose-400 block">Levar até:</span>
                  <p className="text-slate-200">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>

            {/* GPS 1-CLICK NAVIGATION TO GOOGLE MAPS & WAZE (ITEM 1) */}
            {(() => {
              const isHeadingToPickup = activeRide.status === 'ACCEPTED' || activeRide.status === 'DRIVER_ARRIVING';
              const targetLoc = isHeadingToPickup ? activeRide.origin : activeRide.destination;
              const targetLabel = isHeadingToPickup ? 'Embarque (Passageiro)' : 'Destino Final';
              const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetLoc.lat},${targetLoc.lng}&travelmode=driving`;
              const wazeUrl = `https://waze.com/ul?ll=${targetLoc.lat},${targetLoc.lng}&navigate=yes`;

              const gmapsPickupUrl = `https://www.google.com/maps/dir/?api=1&destination=${activeRide.origin.lat},${activeRide.origin.lng}&travelmode=driving`;
              const wazePickupUrl = `https://waze.com/ul?ll=${activeRide.origin.lat},${activeRide.origin.lng}&navigate=yes`;
              const gmapsDestUrl = `https://www.google.com/maps/dir/?api=1&destination=${activeRide.destination.lat},${activeRide.destination.lng}&travelmode=driving`;
              const wazeDestUrl = `https://waze.com/ul?ll=${activeRide.destination.lat},${activeRide.destination.lng}&navigate=yes`;

              return (
                <div className="bg-slate-950 p-4 rounded-xl border-2 border-emerald-500/60 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Navegação GPS em Tempo Real
                      </span>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-extrabold uppercase">
                      Rota Atual: {targetLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <a
                      href={gmapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-950 transition-all hover:scale-[1.02]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir no Google Maps ↗
                    </a>

                    <a
                      href={wazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-950 transition-all hover:scale-[1.02]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir no Waze ↗
                    </a>
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-300">Atalhos diretos:</span>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href={gmapsPickupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <MapPin className="w-3 h-3 text-emerald-400" /> Maps Embarque
                      </a>
                      <span>•</span>
                      <a
                        href={wazePickupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        Waze Embarque
                      </a>
                      <span>•</span>
                      <a
                        href={gmapsDestUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-rose-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <Navigation className="w-3 h-3 text-rose-400" /> Maps Destino
                      </a>
                      <span>•</span>
                      <a
                        href={wazeDestUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        Waze Destino
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Route View Switcher Tabs (when arriving to pick up the passenger) */}
            {activeRide.status !== 'IN_PROGRESS' && activeRide.status !== 'COMPLETED' && (
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-bold gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setDriverRouteMode('to_passenger')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    driverRouteMode === 'to_passenger'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Car className="w-3.5 h-3.5 text-white" />
                  <span>Rota até o Passageiro</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40">
                    Ao Vivo
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDriverRouteMode('full_trip')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    driverRouteMode === 'full_trip'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-950'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5 text-white" />
                  <span>Trajeto da Corrida (Destino)</span>
                </button>
              </div>
            )}

            {/* Live Interactive Route Map */}
            {(() => {
              const effectiveDriverLocation = driverGps || (
                driver?.currentLocation?.lat && driver?.currentLocation?.lng
                  ? { lat: driver.currentLocation.lat, lng: driver.currentLocation.lng }
                  : null
              );

              if (activeRide.status === 'IN_PROGRESS') {
                return (
                  <MapDisplay
                    pickup={
                      effectiveDriverLocation
                        ? { lat: effectiveDriverLocation.lat, lng: effectiveDriverLocation.lng, address: 'Sua Localização (Em Trânsito)' }
                        : activeRide.origin
                    }
                    destination={activeRide.destination}
                    mode="driver_to_destination"
                    pickupLabel="Você + Passageiro"
                    destinationLabel="Destino Final"
                    draggable={false}
                    hudTitle="🛣️ Rota até o Destino da Viagem"
                    height="320px"
                  />
                );
              }

              if (driverRouteMode === 'to_passenger') {
                const startPoint = effectiveDriverLocation
                  ? { lat: effectiveDriverLocation.lat, lng: effectiveDriverLocation.lng, address: 'Sua Localização Exata (Motorista)' }
                  : activeRide.origin;

                return (
                  <div className="space-y-2">
                    {!effectiveDriverLocation && (
                      <div className="p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/60 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-lg">
                        <div className="flex items-center gap-2">
                          <Crosshair className="w-4 h-4 text-amber-400 animate-spin" />
                          <span>Obtendo seu GPS preciso para traçar a rota até o passageiro...</span>
                        </div>
                        <button
                          type="button"
                          onClick={requestDriverGps}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase shadow"
                        >
                          Ativar GPS
                        </button>
                      </div>
                    )}
                    <MapDisplay
                      pickup={startPoint}
                      destination={activeRide.origin}
                      mode="driver_to_pickup"
                      pickupLabel="Você (Sua Posição Exata)"
                      destinationLabel={`Passageiro: ${activeRide.passengerName}`}
                      draggable={false}
                      hudTitle="🚗 Rota até o Passageiro • GPS Ao Vivo"
                      height="320px"
                    />
                  </div>
                );
              }

              // Full trip preview
              return (
                <MapDisplay
                  pickup={activeRide.origin}
                  destination={activeRide.destination}
                  mode="planning"
                  pickupLabel={`Embarque: ${activeRide.passengerName}`}
                  destinationLabel="Destino Final"
                  draggable={false}
                  hudTitle="🗺️ Trajeto da Corrida (Origem → Destino)"
                  height="320px"
                />
              );
            })()}

            {/* STAGE MACHINE ACTION BUTTONS */}
            <div className="pt-2">
              {activeRide.status === 'DRIVER_ARRIVING' && (
                <div className="space-y-2">
                  <button
                    onClick={handleMarkArrived}
                    disabled={actionLoading}
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                  >
                    Cheguei no Embarque (ARRIVED) — Iniciar Tolerância 4min
                  </button>
                  <button
                    type="button"
                    onClick={handleDriverCancelPreRide}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/70 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <X className="w-4 h-4 text-rose-400" />
                    Cancelar Corrida (Antes do Embarque)
                  </button>
                </div>
              )}

              {activeRide.status === 'ARRIVED' && (
                <div className="space-y-2">
                  <button
                    onClick={handleStartRide}
                    disabled={actionLoading}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                  >
                    Passageiro Embarcou — Iniciar Viagem (START)
                  </button>
                  <button
                    type="button"
                    onClick={handleDriverCancelPreRide}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/70 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <X className="w-4 h-4 text-rose-400" />
                    Cancelar Corrida (Passageiro Não Compareceu)
                  </button>
                </div>
              )}

              {activeRide.status === 'IN_PROGRESS' && (
                <div className="space-y-2.5">
                  <button
                    onClick={() => setShowPaymentCompletionModal(true)}
                    disabled={actionLoading}
                    className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all hover:scale-[1.01]"
                  >
                    <CheckCircle className="w-5 h-5 text-white" />
                    Finalizar Viagem & Confirmar Pagamento (R$ {activeRide.fareAmount.toFixed(2)})
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCompleteRide(false)}
                      disabled={actionLoading}
                      className="py-2.5 px-3 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 border border-amber-600/50 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      title="Finaliza a corrida mas bloqueia o passageiro até você confirmar o recebimento"
                    >
                      <Clock className="w-4 h-4 text-amber-400" />
                      Finalizar c/ Pagamento Pendente
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
                      className="py-2.5 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-600/50 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      Não Pagou (Calote)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDriverEmergencyModal(true)}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-600/70 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    ⚠️ Cancelar Viagem por Emergência (Pane / Acidente / Saúde)
                  </button>

                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Viagem em andamento. Cancelamentos comuns estão bloqueados pelo sistema por segurança, exceto em emergências.</span>
                  </div>
                </div>
              )}

              {activeRide.status !== 'IN_PROGRESS' && activeRide.status !== 'COMPLETED' && (
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
                  className="w-full mt-2 py-2 rounded-xl bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Reportar Passageiro / Ocorrência
                </button>
              )}

              {activeRide.status === 'COMPLETED' && (
                <div className="space-y-3">
                  {!activeRide.paymentApprovedByDriver || activeRide.paymentStatus === 'PENDING' ? (
                    <div className="p-4 rounded-xl bg-amber-950/80 border-2 border-amber-500 text-xs space-y-3 shadow-lg">
                      <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                        <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                        <span>Viagem Finalizada • Aguardando Sua Aprovação de Pagamento</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        O passageiro <strong>{activeRide.passengerName}</strong> está com novas corridas <strong>bloqueadas</strong> até você confirmar o recebimento de <strong>R$ {activeRide.fareAmount.toFixed(2)}</strong> via {activeRide.paymentMethod}.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          onClick={() => handleApprovePayment(activeRide.id)}
                          disabled={actionLoading}
                          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirmar Pagamento Recebido (R$ {activeRide.fareAmount.toFixed(2)})
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
                          className="py-3 px-4 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-600 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          Relatar Calote
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-950 border border-emerald-500 text-center text-xs text-emerald-300 font-semibold space-y-1">
                      <div className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Viagem Finalizada e Pagamento Aprovado!
                      </div>
                      <div>Cobrança de R$ {activeRide.fareAmount.toFixed(2)} via {activeRide.paymentMethod} confirmada com sucesso.</div>
                    </div>
                  )}

                  <button
                    onClick={() => setActiveRide(null)}
                    className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Concluir e Voltar a Ficar Disponível
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INCOMING RIDE REQUESTS (STREAM) */}
        {!activeRide && isOnline && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400 animate-spin" /> Corridas Disponíveis na Região
              </h3>
              <span className="text-xs text-slate-400">Atualização em tempo real</span>
            </div>

            {availableRides.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 space-y-2">
                <Car className="w-10 h-10 text-emerald-500/50 mx-auto animate-pulse" />
                <p className="font-semibold text-white">Você está ONLINE e visível no mapa!</p>
                <p>Aguardando novas solicitações de passageiros em São Sebastião...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableRides.map((ride) => (
                  <div
                    key={ride.id}
                    className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-xl space-y-4 hover:border-emerald-500 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ride.passengerPhotoUrl ? (
                          <img
                            src={ride.passengerPhotoUrl}
                            alt={ride.passengerName}
                            className="w-10 h-10 rounded-full object-cover border border-emerald-500"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-bold text-white block">{ride.passengerName}</span>
                          <span className="text-[11px] text-slate-400">Solicitada agora</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ride.discountApplied && ride.originalFareAmount && (
                            <span className="text-[11px] line-through text-slate-400">
                              R$ {ride.originalFareAmount.toFixed(2)}
                            </span>
                          )}
                          <span className="text-xl font-black text-emerald-400">
                            R$ {ride.fareAmount.toFixed(2)}
                          </span>
                        </div>
                        {ride.discountApplied && (
                          <span className="text-[10px] text-emerald-300 font-bold block">
                            5% OFF Verificado
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 block">{ride.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-slate-300 truncate">{ride.origin.address}</span>
                      </div>
                      <div className="flex items-start gap-1.5 pt-1.5 border-t border-slate-800">
                        <Navigation className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span className="text-slate-300 truncate">{ride.destination.address}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAcceptRide(ride.id)}
                      disabled={actionLoading}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                    >
                      Aceitar Corrida
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RIDE HISTORY LIST */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" /> Histórico Recente de Viagens
            </h3>
            <span className="text-xs text-slate-400">{rideHistory.length} registros</span>
          </div>

          {rideHistory.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Nenhuma corrida registrada ainda.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {rideHistory.map((r) => (
                <div
                  key={r.id}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-white block">{r.passengerName}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(r.requestedAt).toLocaleDateString('pt-BR')} • {r.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400 block">R$ {r.fareAmount.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500">{r.paymentMethod}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

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
