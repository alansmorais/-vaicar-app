import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { WaitingTimer } from '../../components/WaitingTimer.js';
import { ReceiptModal } from '../../components/ReceiptModal.js';
import { MapDisplay } from '../../components/MapDisplay.js';
import { driversApi } from '../../api/drivers.js';
import { ridesApi } from '../../api/rides.js';
import { DriverProfile, Ride, Receipt } from '../../../../shared/src/types.js';
import {
  Car,
  Bike,
  Power,
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
} from 'lucide-react';
import { ReportModal } from '../../components/ReportModal.js';

export const DriverDashboardPage: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [receiptToShow, setReceiptToShow] = useState<Receipt | null>(null);

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

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch driver profile
  const loadDriverProfile = useCallback(async () => {
    try {
      const data = await driversApi.getMe();
      setDriver(data);
      setIsOnline(data.isOnline);
    } catch (err: any) {
      console.warn('Driver profile fetch notice:', err);
      // Construct fallback profile from user if freshly registered
      if (user) {
        setDriver({
          uid: user.uid,
          name: profile?.displayName || 'Motorista Parceiro',
          cpf: '123.456.789-00',
          birthDate: '1990-01-01',
          email: user.email || '',
          whatsapp: '(12) 99123-4567',
          photoUrl: profile?.photoUrl || '',
          professionalCategory: 'EAR',
          cnhNumber: '12345678901',
          vehicle: { brand: 'Chevrolet', model: 'Onix', year: 2022, color: 'Prata', plate: 'BRA2E19' },
          operatingZones: ['Centro & Porto Grande'],
          status: 'APPROVED',
          isOnline: false,
          rating: 5.0,
          completedRidesCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

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

  // Stream available rides when online and not in active ride
  useEffect(() => {
    if (!isOnline || activeRide) {
      setAvailableRides([]);
      return;
    }

    const fetchAvailable = async () => {
      try {
        const rides = await driversApi.getAvailableRides();
        setAvailableRides(rides);
      } catch (err) {
        console.error('Available rides error:', err);
      }
    };

    fetchAvailable();
    const interval = setInterval(fetchAvailable, 3000);
    return () => clearInterval(interval);
  }, [isOnline, activeRide]);

  // Simulate or watch real driver GPS coordinates while online
  useEffect(() => {
    if (!isOnline) return;

    // Report location to backend every 10s
    let lat = -23.8055 + (Math.random() - 0.5) * 0.01;
    let lng = -45.4011 + (Math.random() - 0.5) * 0.01;

    driversApi.updateLocation(lat, lng, 45).catch(console.error);

    const interval = setInterval(() => {
      lat += (Math.random() - 0.5) * 0.002;
      lng += (Math.random() - 0.5) * 0.002;
      driversApi.updateLocation(lat, lng, Math.floor(Math.random() * 360)).catch(console.error);
    }, 10000);

    return () => clearInterval(interval);
  }, [isOnline]);

  const handleToggleOnline = async () => {
    if (!driver) return;
    if (driver.status !== 'APPROVED') {
      setError(`Sua conta está com status: ${driver.status}. Aguarde a aprovação do administrador.`);
      return;
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
    } catch (err: any) {
      setError(err.message || 'Não foi possível aceitar a corrida.');
    } finally {
      setActionLoading(false);
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

        {/* Online / Offline status toggle */}
        <div className="flex items-center gap-3">
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
            {isOnline ? 'Online (Disponível)' : 'Ficar Online'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
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
                  {error.includes('Acesso restrito')
                    ? 'Acesso Restrito ao Painel do Motorista'
                    : 'Aviso do Sistema'}
                </span>
                <p className="leading-relaxed text-slate-300">
                  {error.includes('Acesso restrito')
                    ? 'Sua conta conectada está configurada como Passageiro ou ainda não possui cadastro aprovado de Motorista/Entregador. Para aceitar corridas e ficar online, cadastre seu veículo ou faça login com sua conta de condutor.'
                    : error}
                </p>
              </div>
            </div>

            {error.includes('Acesso restrito') && (
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
              {driver?.status || 'Carregando...'}
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

            {/* Live Interactive Route Map */}
            <MapDisplay
              pickup={activeRide.origin}
              destination={activeRide.destination}
              height="280px"
            />

            {/* STAGE MACHINE ACTION BUTTONS */}
            <div className="pt-2">
              {activeRide.status === 'DRIVER_ARRIVING' && (
                <button
                  onClick={handleMarkArrived}
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                >
                  Cheguei no Embarque (ARRIVED) — Iniciar Tolerância 4min
                </button>
              )}

              {activeRide.status === 'ARRIVED' && (
                <button
                  onClick={handleStartRide}
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                >
                  Passageiro Embarcou — Iniciar Viagem (START)
                </button>
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
    </div>
  );
};
