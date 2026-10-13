import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { adminApi, EmailLogItem } from '../../api/admin.js';
import { ridesApi } from '../../api/rides.js';
import {
  AdminMetrics,
  DriverProfile,
  PassengerProfile,
  Ride,
  PlatformPricingSettings,
  ApkDownloadAnalyticsResponse,
  DeliveryWaitlistEntry,
} from '../../../../shared/src/types.js';
import {
  Shield,
  Users,
  Car,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Mail,
  Sliders,
  RefreshCw,
  Search,
  ExternalLink,
  Lock,
  User,
  ShieldAlert,
  Trash2,
  FileText,
  Eye,
  X,
  Package,
  Bike,
  Navigation,
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  Check,
  Filter,
  Download,
  TrendingUp,
  BarChart3,
  Calendar,
} from 'lucide-react';


const DocumentPreviewCard: React.FC<{ url: string; label: string }> = ({ url, label }) => {
  const isPdf = url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf');

  return (
    <div className="space-y-2 pt-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
      >
        <ExternalLink className="w-3.5 h-3.5" /> Abrir {label} ({isPdf ? 'PDF' : 'Completo'}) ↗
      </a>
      {isPdf ? (
        <div className="w-full h-44 rounded-lg border border-slate-800 bg-slate-900 overflow-hidden relative">
          <iframe
            src={url}
            title={label}
            className="w-full h-full border-0"
          />
        </div>
      ) : (
        <img
          src={url}
          alt={label}
          className="w-full max-h-40 object-contain bg-black/60 rounded-lg border border-slate-800"
        />
      )}
    </div>
  );
};

export const AdminDashboardPage: React.FC = () => {
  const { user, isAdmin, role } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    'metrics' | 'drivers' | 'passengers' | 'rides' | 'pricing' | 'emails' | 'reports' | 'analytics'
  >('metrics');

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [passengers, setPassengers] = useState<PassengerProfile[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [pricing, setPricing] = useState<PlatformPricingSettings | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogItem[]>([]);
  const [apkAnalytics, setApkAnalytics] = useState<ApkDownloadAnalyticsResponse | null>(null);
  const [deliveryWaitlist, setDeliveryWaitlist] = useState<DeliveryWaitlistEntry[]>([]);
  const [analyticsDaysRange, setAnalyticsDaysRange] = useState<'7' | '30'>('7');


  // Driver filters
  const [driverFilter, setDriverFilter] = useState<string>('ALL');
  const [driverServiceFilter, setDriverServiceFilter] = useState<'ALL' | 'ride' | 'delivery' | 'both'>('ALL');
  const [driverVehicleFilter, setDriverVehicleFilter] = useState<'ALL' | 'car' | 'motorcycle' | 'bicycle'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Ride filters
  const [rideServiceFilter, setRideServiceFilter] = useState<'ALL' | 'ride' | 'delivery'>('ALL');

  // Pricing form (Ride + Delivery Floors)
  const [baseFare, setBaseFare] = useState('');
  const [perKmRate, setPerKmRate] = useState('');
  const [perMinuteRate, setPerMinuteRate] = useState('');
  const [minimumFare, setMinimumFare] = useState('');
  const [deliveryMinimumFee, setDeliveryMinimumFee] = useState('');
  const [deliveryPerKmRate, setDeliveryPerKmRate] = useState('');
  const [deliveryWaitingPerMinuteRate, setDeliveryWaitingPerMinuteRate] = useState('');

  // Inspection Modals
  const [selectedDocDriver, setSelectedDocDriver] = useState<DriverProfile | null>(null);
  const [selectedDocPassenger, setSelectedDocPassenger] = useState<PassengerProfile | null>(null);
  const [selectedRideDetail, setSelectedRideDetail] = useState<Ride | null>(null);

  // Ride Cancellation state
  const [rideToCancel, setRideToCancel] = useState<Ride | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAdminCancelRide = async () => {
    if (!rideToCancel) return;
    if (!cancelReasonInput.trim()) {
      setMessage({ type: 'error', text: 'Informe o motivo do cancelamento da corrida.' });
      return;
    }
    setCancelLoading(true);
    try {
      await adminApi.cancelRide(rideToCancel.id, cancelReasonInput.trim());
      setMessage({
        type: 'success',
        text: `Corrida #${rideToCancel.id.slice(-6)} cancelada com sucesso pelo administrador!`,
      });
      setRideToCancel(null);
      setCancelReasonInput('');
      if (selectedRideDetail?.id === rideToCancel.id) {
        setSelectedRideDetail(null);
      }
      loadAllAdminData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Falha ao cancelar corrida.',
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const loadAllAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, d, p, r, pr, em, rep, apk, waitlist] = await Promise.all([
        adminApi.getMetrics(),
        adminApi.getDrivers(),
        adminApi.getPassengers(),
        adminApi.getRides(),
        adminApi.getPricing(),
        adminApi.getEmailDiagnostics(),
        adminApi.getReports(),
        adminApi.getApkAnalytics().catch(() => null),
        adminApi.getDeliveryWaitlist().catch(() => []),
      ]);

      setMetrics(m);
      setDrivers(d);
      setPassengers(p);
      setRides(r);
      setPricing(pr);
      setEmailLogs(em);
      setReports(rep || []);
      if (apk) setApkAnalytics(apk);
      if (waitlist) setDeliveryWaitlist(waitlist);


      if (pr) {
        setBaseFare(String(pr.baseFare));
        setPerKmRate(String(pr.perKmRate));
        setPerMinuteRate(String(pr.perMinuteRate));
        setMinimumFare(String(pr.minimumFare));
        setDeliveryMinimumFee(String(pr.deliveryMinimumFee ?? 10.0));
        setDeliveryPerKmRate(String(pr.deliveryPerKmRate ?? 2.0));
        setDeliveryWaitingPerMinuteRate(String(pr.deliveryWaitingPerMinuteRate ?? 0.5));
      }
    } catch (err: any) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin || role === 'admin') {
      loadAllAdminData();
    }
  }, [isAdmin, role, loadAllAdminData]);

  const handleApproveDriver = async (driverId: string) => {
    try {
      setDrivers(prev => prev.map(d => d.uid === driverId ? { ...d, status: 'APPROVED' as const } : d));
      await adminApi.approveDriver(driverId);
      setMessage({ type: 'success', text: 'Motorista aprovado com sucesso! E-mail de confirmação enviado.' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao aprovar motorista.' });
      loadAllAdminData();
    }
  };

  const handleRejectDriver = async (driverId: string) => {
    const reason = window.prompt('Informe o motivo da recusa do motorista:');
    if (!reason) return;
    try {
      setDrivers(prev => prev.map(d => d.uid === driverId ? { ...d, status: 'REJECTED' as const } : d));
      await adminApi.rejectDriver(driverId, reason);
      setMessage({ type: 'success', text: 'Motorista reprovado. Notificação enviada por e-mail.' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao rejeitar motorista.' });
      loadAllAdminData();
    }
  };

  const handleSuspendDriver = async (driverId: string) => {
    const reason = window.prompt('Informe o motivo da suspensão da conta:');
    if (!reason) return;
    try {
      setDrivers(prev => prev.map(d => d.uid === driverId ? { ...d, status: 'SUSPENDED' as const } : d));
      await adminApi.suspendDriver(driverId, reason);
      setMessage({ type: 'success', text: 'Conta do motorista suspensa.' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao suspender motorista.' });
      loadAllAdminData();
    }
  };

  const handleBlockPassenger = async (passengerId: string) => {
    const reason = window.prompt('Informe o motivo do bloqueio do passageiro:');
    if (!reason) return;
    try {
      await adminApi.blockPassenger(passengerId, reason);
      setMessage({ type: 'success', text: 'Passageiro bloqueado com sucesso.' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao bloquear passageiro.' });
    }
  };

  const handleUnblockPassenger = async (passengerId: string) => {
    try {
      await adminApi.unblockPassenger(passengerId);
      setMessage({ type: 'success', text: 'Passageiro desbloqueado com sucesso!' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao desbloquear passageiro.' });
    }
  };

  const handleDeletePassenger = async (passengerId: string, name: string) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja EXCLUIR permanentemente o passageiro "${name}"?\nEsta ação removerá o cadastro e não poderá ser desfeita.`
    );
    if (!confirmed) return;
    try {
      await adminApi.deletePassenger(passengerId);
      setMessage({ type: 'success', text: `Passageiro "${name}" excluído com sucesso!` });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao excluir passageiro.' });
    }
  };

  const handleDeleteDriver = async (driverId: string, name: string) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja EXCLUIR permanentemente o motorista/entregador "${name}"?\nEsta ação removerá o perfil profissional e o acesso ao aplicativo.`
    );
    if (!confirmed) return;
    try {
      await adminApi.deleteDriver(driverId);
      setMessage({ type: 'success', text: `Motorista/Entregador "${name}" excluído com sucesso!` });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao excluir motorista.' });
    }
  };

  const handleRequestDriverDocs = async (driverId: string, currentDocs?: string) => {
    const requested = window.prompt(
      'Informe as documentações solicitadas ao condutor:\n(Ex: Foto legível da CNH com EAR, CRLV 2026 do veículo, Comprovante de Residência)',
      currentDocs || 'Foto legível da CNH aberta com EAR e CRLV do veículo'
    );
    if (!requested || !requested.trim()) return;
    try {
      await adminApi.requestDriverDocs(driverId, requested.trim());
      setMessage({ type: 'success', text: 'Documentações solicitadas ao motorista! E-mail de notificação enviado.' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao solicitar documentações.' });
    }
  };

  const handleRequestPassengerDocs = async (passengerId: string, currentDocs?: string) => {
    const requested = window.prompt(
      'Informe as documentações solicitadas ao passageiro:\n(Ex: Foto legível do Documento Oficial de Identidade RG/CNH ou Antecedentes Criminais)',
      currentDocs || 'Foto legível do Documento Oficial de Identidade (RG ou CNH)'
    );
    if (!requested || !requested.trim()) return;
    try {
      await adminApi.requestPassengerDocs(passengerId, requested.trim());
      setMessage({ type: 'success', text: 'Documentações solicitadas ao passageiro! Notificação enviada.' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao solicitar documentações.' });
    }
  };

  const handleResolveReport = async (reportId: string) => {
    const note = window.prompt('Nota de resolução da administração (opcional):') || undefined;
    try {
      await adminApi.resolveReport(reportId, note, 'RESOLVED');
      setMessage({ type: 'success', text: 'Ocorrência resolvida com sucesso!' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao resolver ocorrência.' });
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.updatePricing({
        baseFare: parseFloat(baseFare),
        perKmRate: parseFloat(perKmRate),
        perMinuteRate: parseFloat(perMinuteRate),
        minimumFare: parseFloat(minimumFare),
        deliveryMinimumFee: parseFloat(deliveryMinimumFee),
        deliveryPerKmRate: parseFloat(deliveryPerKmRate),
        deliveryWaitingPerMinuteRate: parseFloat(deliveryWaitingPerMinuteRate),
      });
      setMessage({ type: 'success', text: 'Tabela de preços e pisos de entrega da plataforma atualizados com sucesso!' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao atualizar tarifas.' });
    }
  };

  const handleResendEmail = async (logId: string) => {
    try {
      await adminApi.resendEmail(logId);
      setMessage({ type: 'success', text: 'E-mail reenviado com sucesso!' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao reenviar e-mail.' });
    }
  };

  const filteredDrivers = drivers.filter((d) => {
    const matchesFilter = driverFilter === 'ALL' || d.status === driverFilter;

    // Service filter
    const services = d.servicesOffered || (d.isCourier || d.vehicle?.type === 'bicycle' ? ['delivery'] : ['ride']);
    let matchesService = true;
    if (driverServiceFilter === 'ride') {
      matchesService = services.includes('ride') && d.vehicle?.type !== 'bicycle';
    } else if (driverServiceFilter === 'delivery') {
      matchesService = services.includes('delivery');
    } else if (driverServiceFilter === 'both') {
      matchesService = services.includes('ride') && services.includes('delivery') && d.vehicle?.type !== 'bicycle';
    }

    // Vehicle filter
    let matchesVehicle = true;
    if (driverVehicleFilter !== 'ALL') {
      const vType = d.vehicle?.type || 'car';
      matchesVehicle = vType === driverVehicleFilter;
    }

    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.cpf.includes(searchTerm) ||
      (d.vehicle?.plate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.whatsapp || '').includes(searchTerm);

    return matchesFilter && matchesService && matchesVehicle && matchesSearch;
  });

  const filteredRides = rides.filter((r) => {
    if (rideServiceFilter === 'ALL') return true;
    const sType = r.serviceType || 'ride';
    return sType === rideServiceFilter;
  });

  // Access check fallback
  if (!isAdmin && role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <Lock className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Acesso Restrito ao Administrador</h2>
          <p className="text-xs text-slate-400">
            Você precisa estar logado com credenciais de administrador para acessar este painel.
          </p>
          <div className="pt-2">
            <Link
              to="/admin/login"
              className="block w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs uppercase text-white"
            >
              Fazer Login como Administrador
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 py-3.5 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <img src="/vaicar_logo.png" alt="VaiCar" className="h-8 w-auto rounded object-contain" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">
              Painel de Controle Central • <span className="text-emerald-400">São Sebastião</span>
            </span>
          </div>
        </div>

        <button
          onClick={loadAllAdminData}
          disabled={loading}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Recarregar Dados"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Nav Tabs */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto py-2.5 text-xs font-semibold">
          {[
            { id: 'metrics', label: 'Métricas Gerais', icon: DollarSign },
            { id: 'drivers', label: `Motoristas (${drivers.length})`, icon: Car },
            { id: 'passengers', label: `Passageiros (${passengers.length})`, icon: Users },
            { id: 'reports', label: `Denúncias (${reports.filter((r) => r.status === 'PENDING').length})`, icon: ShieldAlert },
            { id: 'rides', label: `Corridas (${rides.length})`, icon: RefreshCw },
            { id: 'pricing', label: 'Tabela de Tarifas', icon: Sliders },
            { id: 'emails', label: `E-mails (${emailLogs.length})`, icon: Mail },
            { id: 'analytics', label: `Downloads & Entregas (${apkAnalytics?.summary.totalDownloads ?? 0})`, icon: Download },
          ].map((tab) => {

            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setMessage(null);
                }}
                className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {message && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
              message.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                : 'bg-rose-950/60 border-rose-600/60 text-rose-300'
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* 1. METRICS TAB */}
        {activeTab === 'metrics' && metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">

                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Total de Solicitações</span>
                  <span className="text-2xl font-black text-white mt-1 block">{metrics.totalRides}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex flex-wrap gap-1">
                  <span className="text-emerald-400 font-bold">🚗 {metrics.totalPassengerRides ?? 0}</span>
                  <span>corridas •</span>
                  <span className="text-cyan-400 font-bold">📦 {metrics.totalDeliveries ?? 0}</span>
                  <span>entregas</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Concluídas com Sucesso</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">{metrics.completedRides}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex flex-wrap gap-1">
                  <span className="text-emerald-400 font-bold">🚗 {metrics.completedPassengerRides ?? 0}</span>
                  <span>corridas •</span>
                  <span className="text-cyan-400 font-bold">📦 {metrics.completedDeliveries ?? 0}</span>
                  <span>entregas</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Condutores Online</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">{metrics.activeOnlineDrivers}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex flex-wrap gap-1">
                  <span className="text-emerald-400 font-bold">🚗 {metrics.activeOnlineRideDrivers ?? 0}</span>
                  <span>motoristas •</span>
                  <span className="text-cyan-400 font-bold">📦 {metrics.activeOnlineDeliveryPartners ?? 0}</span>
                  <span>entregadores</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Pendentes de Aprovação</span>
                  <span className="text-2xl font-black text-amber-400 mt-1 block">{metrics.pendingDriverApprovals}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-amber-300">
                  <span>Aguardando moderação</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Clientes / Passageiros</span>
                  <span className="text-2xl font-black text-white mt-1 block">{metrics.totalPassengers}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                  <span>Cadastrados no app</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Volume Bruto Transacionado</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">
                    R$ {metrics.grossVolumeBRL.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex flex-wrap gap-1">
                  <span className="text-emerald-400 font-bold">🚗 R$ {(metrics.grossVolumeRidesBRL ?? 0).toFixed(2)}</span>
                  <span>•</span>
                  <span className="text-cyan-400 font-bold">📦 R$ {(metrics.grossVolumeDeliveriesBRL ?? 0).toFixed(2)}</span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('analytics')}
                className="bg-slate-900 border border-emerald-500/30 hover:border-emerald-500 p-4 rounded-xl flex flex-col justify-between cursor-pointer transition-all group shadow-sm"
                title="Ver estatísticas detalhadas de downloads e lista de espera"
              >
                <div>
                  <span className="text-[11px] text-emerald-400 font-bold block flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Downloads APK
                  </span>
                  <span className="text-2xl font-black text-white mt-1 block">
                    {apkAnalytics?.summary.totalDownloads ?? 0}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex flex-wrap gap-1 justify-between items-center">
                  <span>📱 {apkAnalytics?.summary.totalPassengerDownloads ?? 0} pass.</span>
                  <span>•</span>
                  <span>🚘 {apkAnalytics?.summary.totalDriverDownloads ?? 0} mot.</span>
                  <span className="text-emerald-400 font-bold group-hover:underline">Ver →</span>
                </div>
              </div>
            </div>


            {/* Direct Payment & Business Model Banner */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-start sm:items-center justify-between gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-600/50 flex items-center justify-center text-emerald-400 shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-white block">Modelo Fase 1: 100% Pagamento Direto ao Parceiro</span>
                  <span className="text-slate-400 text-[11px]">
                    Clientes pagam os condutores via Pix, Dinheiro ou Maquininha sem retenção de comissão. Planos de assinatura do motorista: <strong>R$ 100/mês (Veículo Próprio)</strong> ou <strong>10% por corrida (Semanal)</strong>.
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-white">Ações Rápidas de Operação</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab('drivers')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2"
                >
                  <Car className="w-4 h-4" /> Analisar Cadastros Pendentes ({metrics.pendingDriverApprovals})
                </button>
                <button
                  onClick={() => setActiveTab('pricing')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-2"
                >
                  <Sliders className="w-4 h-4" /> Ajustar Tarifas do Município
                </button>
                <button
                  onClick={() => setActiveTab('emails')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" /> Ver Logs de E-mails Enviados
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. DRIVERS MANAGEMENT TAB */}
        {activeTab === 'drivers' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            {/* Filter and search toolbar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Status filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                {['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setDriverFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      driverFilter === st
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'Todos os Status'
                      : st === 'PENDING_APPROVAL'
                      ? 'Pendentes'
                      : st === 'APPROVED'
                      ? 'Aprovados'
                      : st === 'REJECTED'
                      ? 'Reprovados'
                      : 'Suspensos'}
                  </button>
                ))}
              </div>

              {/* Service & Vehicle Select Filters */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <select
                  value={driverServiceFilter}
                  onChange={(e) => setDriverServiceFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="ALL">Todos os Serviços</option>
                  <option value="ride">🚗 Apenas Corridas</option>
                  <option value="delivery">📦 Apenas Entregas</option>
                  <option value="both">🚗 + 📦 Ambos (Corrida & Entrega)</option>
                </select>

                <select
                  value={driverVehicleFilter}
                  onChange={(e) => setDriverVehicleFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="ALL">Todos os Veículos</option>
                  <option value="car">🚗 Carro</option>
                  <option value="motorcycle">🏍️ Motocicleta</option>
                  <option value="bicycle">🚲 Bicicleta (Entrega)</option>
                </select>

                <div className="relative flex-1 sm:w-56">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar nome, CPF, placa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Drivers table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Condutor / Parceiro</th>
                    <th className="p-3">Serviços Oferecidos</th>
                    <th className="p-3">Veículo</th>
                    <th className="p-3">Plano de Parceria</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredDrivers.map((d) => {
                    const services = d.servicesOffered || (d.isCourier || d.vehicle?.type === 'bicycle' ? ['delivery'] : ['ride']);
                    const isBike = d.vehicle?.type === 'bicycle';
                    const offersRide = services.includes('ride') && !isBike;
                    const offersDelivery = services.includes('delivery') || isBike;

                    return (
                      <tr key={d.uid} className="hover:bg-slate-950/40 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            {d.photoUrl ? (
                              <img
                                src={d.photoUrl}
                                alt={d.name}
                                className="w-10 h-10 rounded-full object-cover border border-emerald-500 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                                <User className="w-5 h-5" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white block">{d.name}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                    d.isOnline
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                                  }`}
                                >
                                  {d.isOnline ? '🟢 Online' : '⚪ Offline'}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">{d.whatsapp}</span>
                              <div className="font-mono text-[10px] text-slate-500 mt-0.5">CPF: {d.cpf}</div>
                            </div>
                          </div>
                        </td>

                        {/* Services Offered Column */}
                        <td className="p-3">
                          <div className="flex flex-col gap-1 items-start">
                            {offersRide && offersDelivery ? (
                              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 flex items-center gap-1">
                                🚗 + 📦 Corridas e Entregas
                              </span>
                            ) : offersDelivery ? (
                              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 flex items-center gap-1">
                                📦 Entregas & Encomendas
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                                🚗 Corridas de Passageiros
                              </span>
                            )}
                            {isBike && (
                              <span className="text-[9px] text-amber-300 font-semibold">
                                ⚠️ Bicicleta: Exclusivo entregas
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Vehicle Column */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">
                              {d.vehicle?.type === 'bicycle' ? '🚲' : d.vehicle?.type === 'motorcycle' ? '🏍️' : '🚗'}
                            </span>
                            <div>
                              <div className="font-semibold text-white">
                                {d.vehicle?.brand} {d.vehicle?.model} ({d.vehicle?.year})
                              </div>
                              <div className="font-mono text-emerald-400 text-[11px]">
                                {d.vehicle?.type === 'bicycle' ? 'Bicicleta (Isento)' : d.vehicle?.plate || '—'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Subscription Plan Column */}
                        <td className="p-3">
                          <div>
                            <span className="font-bold text-white block text-[11px]">
                              {d.subscriptionPlan === 'weekly_percent_10'
                                ? 'Semanal (10%)'
                                : 'R$ 100/mês'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Status: <strong className="text-emerald-400">{d.status === 'APPROVED' ? 'ATIVO' : 'PENDENTE'}</strong>
                            </span>
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                              d.status === 'APPROVED'
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                : d.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-950 text-amber-400 border-amber-800'
                                : 'bg-rose-950 text-rose-400 border-rose-800'
                            }`}
                          >
                            {d.status === 'APPROVED'
                              ? 'Aprovado'
                              : d.status === 'PENDING_APPROVAL'
                              ? 'Pendente'
                              : d.status === 'SUSPENDED'
                              ? 'Suspenso'
                              : 'Reprovado'}
                          </span>
                        </td>

                        {/* Actions Column */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                            <button
                              onClick={() => setSelectedDocDriver(d)}
                              className="px-2 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                              title="Ver fotos e documentos do condutor"
                            >
                              <FileText className="w-3 h-3 text-sky-400" /> Docs
                            </button>
                            {d.status !== 'APPROVED' && (
                              <button
                                onClick={() => handleApproveDriver(d.uid)}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors"
                              >
                                Aprovar
                              </button>
                            )}
                            <button
                              onClick={() => handleRequestDriverDocs(d.uid, d.documentsRequested)}
                              className="px-2 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-200 font-semibold text-[11px] transition-colors"
                              title="Pedir documentações adicionais ou correções"
                            >
                              Pedir Docs
                            </button>
                            {d.status === 'PENDING_APPROVAL' && (
                              <button
                                onClick={() => handleRejectDriver(d.uid)}
                                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] transition-colors"
                              >
                                Rejeitar
                              </button>
                            )}
                            {d.status === 'APPROVED' && (
                              <button
                                onClick={() => handleSuspendDriver(d.uid)}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 font-semibold text-[11px] transition-colors"
                              >
                                Suspender
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDriver(d.uid, d.name)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Excluir condutor permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. PASSENGERS TAB */}
        {activeTab === 'passengers' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Passageiros Registrados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">WhatsApp</th>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Total de Viagens</th>
                    <th className="p-3">Cadastrado em</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {passengers.map((p) => (
                    <tr key={p.uid} className="hover:bg-slate-950/40">
                      <td className="p-3 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.hasUnpaidDebt && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                              Débito R$ {(p.unpaidAmount || 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">{p.whatsapp}</td>
                      <td className="p-3 text-slate-400">{p.email}</td>
                      <td className="p-3 font-bold text-emerald-400">{p.totalRides || 0}</td>
                      <td className="p-3 text-slate-500">
                        {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {p.isBlocked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950 text-rose-400 border border-rose-800">
                              Bloqueado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Ativo
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${p.idDocumentUrl ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            RG/CNH {p.idDocumentUrl ? '✓' : '—'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${p.criminalRecordUrl ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            Antecedentes {p.criminalRecordUrl ? '✓' : '—'}
                          </span>
                        </div>
                        {p.documentsRequested && (
                          <div className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-700/50 rounded px-1.5 py-0.5 mt-1 truncate max-w-xs" title={p.documentsRequested}>
                            ⚠️ Pedido: {p.documentsRequested}
                          </div>
                        )}
                        {p.blockedReason && (
                          <div className="text-[10px] text-rose-400 mt-0.5 truncate max-w-xs" title={p.blockedReason}>
                            {p.blockedReason}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                          <button
                            onClick={() => setSelectedDocPassenger(p)}
                            className="px-2 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                            title="Ver documentos do passageiro"
                          >
                            <FileText className="w-3 h-3 text-sky-400" /> Docs
                          </button>
                          <button
                            onClick={() => handleRequestPassengerDocs(p.uid, p.documentsRequested)}
                            className="px-2 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-200 font-semibold text-[11px] transition-colors"
                            title="Pedir documentações adicionais ou correções"
                          >
                            Pedir Docs
                          </button>
                          {p.isBlocked ? (
                            <button
                              onClick={() => handleUnblockPassenger(p.uid)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors"
                            >
                              Desbloquear
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBlockPassenger(p.uid)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 font-semibold text-[11px] transition-colors"
                            >
                              Bloquear
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePassenger(p.uid, p.name)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Excluir passageiro permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Denúncias & Relatos de Ocorrências</h3>
                <p className="text-xs text-slate-400">
                  Relatos de calote/não pagamento, conduta inadequada, direção perigosa e outros incidentes.
                </p>
              </div>
              <span className="text-xs text-slate-400">
                Total: <strong className="text-white">{reports.length}</strong> | Pendentes:{' '}
                <strong className="text-rose-400">{reports.filter((r) => r.status === 'PENDING').length}</strong>
              </span>
            </div>

            {reports.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Nenhuma denúncia registrada até o momento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Data / ID</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Autor (Quem relatou)</th>
                      <th className="p-3">Alvo da Denúncia</th>
                      <th className="p-3">Detalhes / Descrição</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {reports.map((rep) => (
                      <tr key={rep.id} className="hover:bg-slate-950/40">
                        <td className="p-3 font-mono text-[11px]">
                          <div>{rep.id.slice(0, 10)}...</div>
                          <div className="text-slate-500">{new Date(rep.createdAt).toLocaleString('pt-BR')}</div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rep.category === 'UNPAID_FARE'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {rep.category === 'UNPAID_FARE' ? 'NÃO PAGAMENTO / CALOTE' : rep.category}
                          </span>
                          {rep.unpaidAmount && (
                            <div className="text-[11px] font-bold text-rose-400 mt-1">
                              R$ {rep.unpaidAmount.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-white">
                            {rep.reporterRole === 'driver' ? '🚗 Motorista' : '👤 Passageiro'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{rep.reporterId}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-white">
                            {rep.targetRole === 'passenger' ? '👤 Passageiro' : '🚗 Motorista'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{rep.targetId}</div>
                        </td>
                        <td className="p-3 max-w-xs">
                          <div className="text-slate-200 line-clamp-2 text-xs">{rep.description}</div>
                          {rep.rideId && (
                            <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                              Corrida: {rep.rideId.slice(0, 15)}...
                            </div>
                          )}
                          {rep.adminNotes && (
                            <div className="text-[10px] text-slate-400 mt-1 italic">
                              Obs Admin: {rep.adminNotes}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              rep.status === 'RESOLVED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : rep.status === 'PENDING'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {rep.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {rep.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleResolveReport(rep.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px]"
                              >
                                Resolver
                              </button>
                            )}
                            {rep.targetRole === 'passenger' && (
                              <button
                                onClick={() => handleUnblockPassenger(rep.targetId)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px]"
                                title="Desbloquear este passageiro se o débito for pago"
                              >
                                Desbloquear
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. RIDES & DELIVERIES TAB */}
        {activeTab === 'rides' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Histórico e Gestão de Corridas e Entregas</h3>
                <p className="text-xs text-slate-400">
                  Acompanhe e inspecione todas as solicitações de passageiros e entregas em tempo real.
                </p>
              </div>

              {/* Service filter pills */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRideServiceFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    rideServiceFilter === 'ALL'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Todas ({rides.length})
                </button>
                <button
                  onClick={() => setRideServiceFilter('ride')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                    rideServiceFilter === 'ride'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  🚗 Corridas ({rides.filter((r) => (r.serviceType || 'ride') === 'ride').length})
                </button>
                <button
                  onClick={() => setRideServiceFilter('delivery')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                    rideServiceFilter === 'delivery'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  📦 Entregas ({rides.filter((r) => r.serviceType === 'delivery').length})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Serviço</th>
                    <th className="p-3">ID / Data</th>
                    <th className="p-3">Solicitante</th>
                    <th className="p-3">Condutor Parceiro</th>
                    <th className="p-3">Trajeto</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Pagamento</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredRides.map((r) => {
                    const isDeliv = r.serviceType === 'delivery';

                    return (
                      <tr key={r.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 w-max ${
                              isDeliv
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {isDeliv ? (
                              <>
                                <Package className="w-3 h-3 text-cyan-400" /> Entrega
                              </>
                            ) : (
                              <>
                                <Car className="w-3 h-3 text-emerald-400" /> Corrida
                              </>
                            )}
                          </span>
                        </td>

                        <td className="p-3 font-mono text-[11px]">
                          <div>{r.id.slice(0, 15)}...</div>
                          <div className="text-slate-500">
                            {new Date(r.requestedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </td>

                        <td className="p-3">
                          <span className="font-semibold text-white block">{r.passengerName}</span>
                          <span className="text-[10px] text-slate-400">{r.passengerPhone || '—'}</span>
                        </td>

                        <td className="p-3">
                          <span className="font-semibold text-white block">{r.driverName || '—'}</span>
                          {r.vehicle && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {r.vehicle.brand} {r.vehicle.model} ({r.vehicle.plate || 'Bike'})
                            </span>
                          )}
                        </td>

                        <td className="p-3 max-w-xs">
                          <div className="truncate text-[11px] text-slate-200" title={`${r.origin.address} → ${r.destination.address}`}>
                            {isDeliv ? '📦 Coleta:' : '📍 De:'} {r.origin.address.split(',')[0]} → {isDeliv ? 'Entrega:' : 'Para:'} {r.destination.address.split(',')[0]}
                          </div>
                          {isDeliv && r.deliveryDetails?.recipientName && (
                            <div className="text-[10px] text-cyan-300 truncate mt-0.5">
                              Destinatário: <strong>{r.deliveryDetails.recipientName}</strong>
                            </div>
                          )}
                        </td>

                        <td className="p-3 font-bold text-emerald-400 whitespace-nowrap">
                          R$ {r.fareAmount.toFixed(2)}
                        </td>

                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                            {r.status}
                          </span>
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase block w-max ${
                              r.paymentStatus === 'PAID'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-amber-950 text-amber-400 border border-amber-800'
                            }`}
                          >
                            {r.paymentStatus === 'PAID' ? 'Pago' : 'Pendente'}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{r.paymentMethod}</span>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedRideDetail(r)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                              title="Inspecionar todos os detalhes"
                            >
                              <Eye className="w-3 h-3 text-emerald-400" /> Detalhes
                            </button>
                            {r.status !== 'COMPLETED' && !r.status.startsWith('CANCELLED') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRideToCancel(r);
                                  setCancelReasonInput('Cancelado via Painel Administrativo');
                                }}
                                className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold text-[11px] transition-colors"
                                title="Cancelar corrida"
                              >
                                Cancelar
                              </button>
                            )}
                            {r.status === 'COMPLETED' && r.paymentStatus !== 'PAID' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await ridesApi.approvePayment(r.id);
                                    setMessage({
                                      type: 'success',
                                      text: `Pagamento da solicitação #${r.id.slice(-6)} aprovado pelo administrador!`,
                                    });
                                    loadAllAdminData();
                                  } catch (err: any) {
                                    setMessage({ type: 'error', text: err.message || 'Falha ao aprovar pagamento.' });
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors"
                              >
                                Aprovar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. PRICING SETTINGS TAB (RIDES + DELIVERY FLOORS) */}
        {activeTab === 'pricing' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" /> Configuração de Tarifas e Pisos da Plataforma
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure as tarifas municipais de corridas e os pisos mínimos obrigatórios de entregas de encomendas em São Sebastião.
              </p>
            </div>

            <form onSubmit={handleSavePricing} className="space-y-6">
              {/* SECTION 1: RIDE PLATFORM PRICING */}
              <div className="space-y-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <Car className="w-4 h-4" /> 1. Tarifas de Corridas de Passageiros
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Bandeirada / Tarifa Base (R$)
                    </label>
                    <input
                      type="number"
                      step="0.10"
                      required
                      value={baseFare}
                      onChange={(e) => setBaseFare(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Valor por Quilômetro Rodado (R$/km)
                    </label>
                    <input
                      type="number"
                      step="0.10"
                      required
                      value={perKmRate}
                      onChange={(e) => setPerKmRate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Valor por Minuto de Viagem (R$/min)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      required
                      value={perMinuteRate}
                      onChange={(e) => setPerMinuteRate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Tarifa Mínima da Corrida (R$)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      required
                      value={minimumFare}
                      onChange={(e) => setMinimumFare(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: DELIVERY PLATFORM PRICING FLOORS */}
              <div className="space-y-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="pb-2 border-b border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Package className="w-4 h-4" /> 2. Pisos da Plataforma para Entregas de Encomendas
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pisos mínimos obrigatórios. Os parceiros podem configurar valores maiores, porém o sistema rejeita tarifas abaixo desses valores.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Piso Mínimo da Entrega (R$)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      required
                      value={deliveryMinimumFee}
                      onChange={(e) => setDeliveryMinimumFee(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Padrão: R$ 10,00</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Piso por KM da Entrega (R$/km)
                    </label>
                    <input
                      type="number"
                      step="0.10"
                      required
                      value={deliveryPerKmRate}
                      onChange={(e) => setDeliveryPerKmRate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Padrão: R$ 2,00/km</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Piso de Espera (R$/min)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      required
                      value={deliveryWaitingPerMinuteRate}
                      onChange={(e) => setDeliveryWaitingPerMinuteRate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Padrão: R$ 0,50/min</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs uppercase text-white shadow-lg shadow-emerald-950/60 transition-all hover:scale-[1.01]"
              >
                Salvar e Aplicar Novas Tarifas & Pisos
              </button>
            </form>
          </div>
        )}

        {/* 6. EMAIL DIAGNOSTICS TAB */}
        {activeTab === 'emails' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">Diagnóstico e Histórico de E-mails Transacionais</h3>
              <p className="text-xs text-slate-400">
                Auditoria de entrega de confirmações de cadastro, aprovações, PINs e recibos.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Destinatário</th>
                    <th className="p-3">Assunto</th>
                    <th className="p-3">Tipo / Template</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Data / Hora</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-950/40">
                      <td className="p-3 font-semibold text-white">{log.to}</td>
                      <td className="p-3 text-slate-300">{log.subject}</td>
                      <td className="p-3 font-mono text-[10px] text-emerald-400">{log.template}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'SENT'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {new Date(log.sentAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {log.previewUrl && (
                            <a
                              href={log.previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                            >
                              Ver Preview <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            onClick={() => handleResendEmail(log.id)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                          >
                            Reenviar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. APK DOWNLOAD ANALYTICS & DELIVERY WAITLIST TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Header & Notice */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-emerald-400" /> Estatísticas Auditadas de Downloads de APK
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Métricas confiáveis geradas exclusivamente por transferências completas via HTTP GET aos pacotes Android.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-xs font-semibold shrink-0">
                  <Shield className="w-3.5 h-3.5" /> Servidor Auditado • Sem Fakes
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>
                    Rastreamento iniciado em: <strong className="text-white">09/10/2026 às 14:00 UTC</strong>
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {apkAnalytics?.notice ||
                    'Requisições HEAD, robôs de busca, spiders e pré-visualizações de links são descartados. Downloads anteriores à data de início não possuem contagem disponível.'}
                </p>
              </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Passenger APK Card */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">APK Passageiro</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      16.8 MB
                    </span>
                  </div>
                  <span className="text-3xl font-black text-white block">
                    {apkAnalytics?.summary.totalPassengerDownloads ?? 0}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Último download:</span>
                    <span className="font-semibold text-slate-200">
                      {apkAnalytics?.summary.lastPassengerDownloadAt
                        ? new Date(apkAnalytics.summary.lastPassengerDownloadAt).toLocaleString('pt-BR')
                        : 'Nenhum recente'}
                    </span>
                  </div>
                  <a
                    href="/downloads/vaicar-passenger.apk"
                    download="vaicar-passenger.apk"
                    className="text-emerald-400 hover:underline block pt-1 font-semibold"
                  >
                    Baixar arquivo direto →
                  </a>
                </div>
              </div>

              {/* Driver APK Card */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">APK Motorista</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      18.2 MB
                    </span>
                  </div>
                  <span className="text-3xl font-black text-white block">
                    {apkAnalytics?.summary.totalDriverDownloads ?? 0}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Último download:</span>
                    <span className="font-semibold text-slate-200">
                      {apkAnalytics?.summary.lastDriverDownloadAt
                        ? new Date(apkAnalytics.summary.lastDriverDownloadAt).toLocaleString('pt-BR')
                        : 'Nenhum recente'}
                    </span>
                  </div>
                  <a
                    href="/downloads/vaicar-driver.apk"
                    download="vaicar-driver.apk"
                    className="text-emerald-400 hover:underline block pt-1 font-semibold"
                  >
                    Baixar arquivo direto →
                  </a>
                </div>
              </div>

              {/* Total Downloads Card */}
              <div className="bg-slate-900 border border-emerald-500/40 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400 font-bold">Total Geral (Auditado)</span>
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-3xl font-black text-emerald-400 block">
                    {apkAnalytics?.summary.totalDownloads ?? 0}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Download mais recente:</span>
                    <span className="font-semibold text-slate-200">
                      {apkAnalytics?.summary.lastDownloadAt
                        ? new Date(apkAnalytics.summary.lastDownloadAt).toLocaleString('pt-BR')
                        : 'Nenhum recente'}
                    </span>
                  </div>
                  <span className="text-slate-500 block pt-1">
                    Passageiro: {apkAnalytics?.summary.totalPassengerDownloads ?? 0} | Motorista: {apkAnalytics?.summary.totalDriverDownloads ?? 0}
                  </span>
                </div>
              </div>

              {/* Delivery Waitlist Card */}
              <div className="bg-slate-900 border border-amber-500/40 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-400 font-bold">Lista de Espera Entregas</span>
                    <Package className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-3xl font-black text-amber-400 block">
                    {deliveryWaitlist.length}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>🏍️ Motos: <strong className="text-slate-200">{deliveryWaitlist.filter((w) => w.role === 'courier_motorcycle').length}</strong></span>
                    <span>🚲 Bikes: <strong className="text-slate-200">{deliveryWaitlist.filter((w) => w.role === 'courier_bicycle').length}</strong></span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span>🏪 Comércios: <strong className="text-slate-200">{deliveryWaitlist.filter((w) => w.role === 'merchant').length}</strong></span>
                    <span>📦 Clientes: <strong className="text-slate-200">{deliveryWaitlist.filter((w) => w.role === 'consumer').length}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily History Table (Last 7 / 30 Days) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" /> Histórico Diário de Downloads
                  </h3>
                  <p className="text-xs text-slate-400">
                    Contagem consolidada por data para os últimos 7 e 30 dias.
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setAnalyticsDaysRange('7')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      analyticsDaysRange === '7'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Últimos 7 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyticsDaysRange('30')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      analyticsDaysRange === '30'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Últimos 30 Dias
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">APK Passageiro</th>
                      <th className="p-3">APK Motorista</th>
                      <th className="p-3">Total do Dia</th>
                      <th className="p-3">Distribuição Visual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {((analyticsDaysRange === '7' ? apkAnalytics?.last7Days : apkAnalytics?.last30Days) || []).map((row) => {
                      const dailyArray = (analyticsDaysRange === '7' ? apkAnalytics?.last7Days : apkAnalytics?.last30Days) || [];
                      const maxDaily = Math.max(...dailyArray.map((r) => r.total), 1);
                      const widthPercent = Math.round((row.total / maxDaily) * 100);
                      const isToday = row.date === new Date().toISOString().split('T')[0];

                      return (
                        <tr key={row.date} className={`hover:bg-slate-800/40 ${isToday ? 'bg-emerald-950/20' : ''}`}>
                          <td className="p-3 text-slate-200 font-sans font-semibold">
                            {row.date.split('-').reverse().join('/')} {isToday && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800 ml-1 font-mono">HOJE</span>}
                          </td>
                          <td className="p-3 text-slate-300">{row.passenger}</td>
                          <td className="p-3 text-slate-300">{row.driver}</td>
                          <td className="p-3 font-bold text-white">{row.total}</td>
                          <td className="p-3 w-48 font-sans">
                            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all"
                                style={{ width: `${Math.max(widthPercent, row.total > 0 ? 5 : 0)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delivery Waitlist Submissions Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" /> Cadastros na Lista de Espera — VaiCar Entregas
                  </h3>
                  <p className="text-xs text-slate-400">
                    Interessados que preencheram o formulário no site para o lançamento de entregas (moto e bike).
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  Total de Inscritos: <strong className="text-amber-400 font-bold">{deliveryWaitlist.length}</strong>
                </span>
              </div>

              {deliveryWaitlist.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800/80">
                  Nenhum cadastro na lista de espera recebido até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-3">Data / Hora</th>
                        <th className="p-3">Nome / Estabelecimento</th>
                        <th className="p-3">WhatsApp / Telefone</th>
                        <th className="p-3">Perfil</th>
                        <th className="p-3">Bairro</th>
                        <th className="p-3">Observações / Veículo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {deliveryWaitlist.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40">
                          <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleString('pt-BR')}
                          </td>
                          <td className="p-3 font-semibold text-white">{item.name}</td>
                          <td className="p-3 font-mono text-emerald-400">{item.phone}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                item.role === 'courier_motorcycle'
                                  ? 'bg-amber-950 text-amber-400 border-amber-800'
                                  : item.role === 'courier_bicycle'
                                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                  : item.role === 'merchant'
                                  ? 'bg-blue-950 text-blue-400 border-blue-800'
                                  : 'bg-purple-950 text-purple-400 border-purple-800'
                              }`}
                            >
                              {item.role === 'courier_motorcycle'
                                ? '🏍️ Moto'
                                : item.role === 'courier_bicycle'
                                ? '🚲 Bike'
                                : item.role === 'merchant'
                                ? '🏪 Comércio'
                                : '📦 Consumidor'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300">{item.neighborhood || 'São Sebastião'}</td>
                          <td className="p-3 text-[11px] text-slate-400 max-w-xs truncate">
                            {item.vehicleDetails || item.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>


      {/* MODAL: VERIFICAÇÃO DE DOCUMENTOS DO MOTORISTA / ENTREGADOR */}
      {selectedDocDriver &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-3">
                  {selectedDocDriver.photoUrl ? (
                    <img
                      src={selectedDocDriver.photoUrl}
                      alt={selectedDocDriver.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      {selectedDocDriver.name}
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                          selectedDocDriver.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : selectedDocDriver.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-950 text-amber-400 border-amber-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        {selectedDocDriver.status}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedDocDriver.professionalCategory || 'Condutor Parceiro'} •{' '}
                      <span className="text-emerald-400 font-semibold">
                        {selectedDocDriver.subscriptionPlan === 'weekly_percent_10'
                          ? 'Plano Semanal (10%)'
                          : 'Plano Mensal (R$ 100/mês)'}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDocDriver(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
                {/* Status da Solicitação de Documentos se houver */}
                {selectedDocDriver.documentsRequested && (
                  <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-600/60 text-amber-200 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-amber-300">
                      <AlertTriangle className="w-4 h-4" /> Documentos Solicitados ao Condutor:
                    </span>
                    <p className="font-mono text-[11px] bg-slate-950/70 p-2 rounded border border-amber-500/30">
                      {selectedDocDriver.documentsRequested}
                    </p>
                  </div>
                )}

                {/* Dados Cadastrais e Operacionais */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">CPF</span>
                    <span className="font-mono font-semibold text-white">{selectedDocDriver.cpf}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">CNH</span>
                    <span className="font-mono font-semibold text-white">{selectedDocDriver.cnhNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">WhatsApp</span>
                    <span className="font-semibold text-white">{selectedDocDriver.whatsapp}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">E-mail</span>
                    <span className="font-semibold text-white truncate block">{selectedDocDriver.email}</span>
                  </div>

                  {/* Serviços Oferecidos */}
                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Serviços Prestados</span>
                    <div className="mt-0.5">
                      {selectedDocDriver.vehicle?.type === 'bicycle' ? (
                        <span className="font-bold text-cyan-300">📦 Apenas Entregas (Bicicleta)</span>
                      ) : (selectedDocDriver.servicesOffered || []).includes('ride') && (selectedDocDriver.servicesOffered || []).includes('delivery') ? (
                        <span className="font-bold text-indigo-300">🚗 + 📦 Ambos (Corridas & Entregas)</span>
                      ) : (selectedDocDriver.servicesOffered || []).includes('delivery') ? (
                        <span className="font-bold text-cyan-300">📦 Apenas Entregas de Encomendas</span>
                      ) : (
                        <span className="font-bold text-emerald-300">🚗 Apenas Corridas de Passageiros</span>
                      )}
                    </div>
                  </div>

                  {/* Veículo */}
                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Veículo Cadastrado</span>
                    <span className="font-semibold text-white">
                      {selectedDocDriver.vehicle.brand} {selectedDocDriver.vehicle.model} ({selectedDocDriver.vehicle.year}) - {selectedDocDriver.vehicle.color}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Placa</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {selectedDocDriver.vehicle?.type === 'bicycle' ? 'Isento (Bicicleta)' : selectedDocDriver.vehicle.plate || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Tipo de Veículo</span>
                    <span className="font-semibold text-white capitalize">
                      {selectedDocDriver.vehicle?.type === 'bicycle'
                        ? '🚲 Bicicleta'
                        : selectedDocDriver.vehicle?.type === 'motorcycle'
                        ? '🏍️ Motocicleta'
                        : '🚗 Carro'}
                    </span>
                  </div>

                  {/* Tarifas Personalizadas */}
                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Tarifas de Corrida</span>
                    <span className="text-slate-300">
                      {selectedDocDriver.customPricing
                        ? `Mín: R$ ${selectedDocDriver.customPricing.minimumFare.toFixed(2)} • R$ ${selectedDocDriver.customPricing.perKmRate.toFixed(2)}/km`
                        : 'Tarifas padrão da plataforma'}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Tarifas de Entrega</span>
                    <span className="text-slate-300">
                      {selectedDocDriver.customDeliveryPricing
                        ? `Mín: R$ ${selectedDocDriver.customDeliveryPricing.minimumDeliveryFee.toFixed(2)} • R$ ${selectedDocDriver.customDeliveryPricing.perKmRate.toFixed(2)}/km`
                        : 'Pisos padrão da plataforma'}
                    </span>
                  </div>
                </div>

                {/* Grade de Documentos */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Documentação Obrigatória para Aprovação
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Foto CNH */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">Carteira de Habilitação (CNH)</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            selectedDocDriver.cnhUrl
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {selectedDocDriver.cnhUrl ? '✓ Enviado' : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Foto da CNH física aberta ou documento do CDT com EAR.</p>
                      {selectedDocDriver.cnhUrl ? (
                        <DocumentPreviewCard url={selectedDocDriver.cnhUrl} label="CNH" />
                      ) : (
                        <div className="p-2 rounded bg-slate-900 text-slate-500 text-center text-[11px]">
                          Nenhum anexo de CNH disponível.
                        </div>
                      )}
                    </div>

                    {/* 2. CRLV */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">Licenciamento do Veículo (CRLV)</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            selectedDocDriver.crlvUrl
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : selectedDocDriver.vehicle.type === 'bicycle'
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {selectedDocDriver.crlvUrl
                            ? '✓ Enviado'
                            : selectedDocDriver.vehicle.type === 'bicycle'
                            ? 'Isento (Bike)'
                            : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">CRLV digital do ano vigente emitido pelo Detran.</p>
                      {selectedDocDriver.crlvUrl ? (
                        <DocumentPreviewCard url={selectedDocDriver.crlvUrl} label="CRLV" />
                      ) : (
                        <div className="p-2 rounded bg-slate-900 text-slate-500 text-center text-[11px]">
                          {selectedDocDriver.vehicle.type === 'bicycle'
                            ? 'Bicicletas não necessitam de CRLV.'
                            : 'Nenhum anexo de CRLV disponível.'}
                        </div>
                      )}
                    </div>

                    {/* 3. Atestado de Antecedentes */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">Antecedentes Criminais</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            selectedDocDriver.criminalRecordUrl
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {selectedDocDriver.criminalRecordUrl ? '✓ Enviado' : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Certidão estadual ou federal expedida recentemente.</p>
                      {selectedDocDriver.criminalRecordUrl ? (
                        <DocumentPreviewCard url={selectedDocDriver.criminalRecordUrl} label="Antecedentes" />
                      ) : (
                        <div className="p-2 rounded bg-slate-900 text-slate-500 text-center text-[11px]">
                          Nenhum anexo de antecedentes criminais.
                        </div>
                      )}
                    </div>

                    {/* 4. Comprovante de Residência */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">Comprovante de Residência</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            selectedDocDriver.proofOfAddressUrl
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {selectedDocDriver.proofOfAddressUrl ? '✓ Enviado' : 'Opcional'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Comprovante recente no Litoral Norte de SP.</p>
                      {selectedDocDriver.proofOfAddressUrl ? (
                        <DocumentPreviewCard url={selectedDocDriver.proofOfAddressUrl} label="Comprovante de Residência" />
                      ) : (
                        <div className="p-2 rounded bg-slate-900 text-slate-500 text-center text-[11px]">
                          Comprovante de residência não enviado.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleDeleteDriver(selectedDocDriver.uid, selectedDocDriver.name);
                      setSelectedDocDriver(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" /> Excluir Motorista
                  </button>
                  <button
                    onClick={() => {
                      handleRequestDriverDocs(selectedDocDriver.uid, selectedDocDriver.documentsRequested);
                      setSelectedDocDriver(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Pedir Documentações
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {selectedDocDriver.status !== 'APPROVED' ? (
                    <button
                      onClick={() => {
                        handleApproveDriver(selectedDocDriver.uid);
                        setSelectedDocDriver(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/60 transition-all"
                    >
                      ✓ Aprovar Cadastro
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleSuspendDriver(selectedDocDriver.uid);
                        setSelectedDocDriver(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-900/60 hover:bg-rose-900 text-rose-200 font-bold text-xs transition-colors"
                    >
                      Suspender Conta
                    </button>
                  )}
                  {selectedDocDriver.status === 'PENDING_APPROVAL' && (
                    <button
                      onClick={() => {
                        handleRejectDriver(selectedDocDriver.uid);
                        setSelectedDocDriver(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
                    >
                      Rejeitar
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedDocDriver(null)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL: VERIFICAÇÃO DE DOCUMENTOS DO PASSAGEIRO */}
      {selectedDocPassenger &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-3">
                  {selectedDocPassenger.photoUrl ? (
                    <img
                      src={selectedDocPassenger.photoUrl}
                      alt={selectedDocPassenger.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      {selectedDocPassenger.name}
                      {selectedDocPassenger.isBlocked ? (
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] uppercase bg-rose-950 text-rose-400 border border-rose-800">
                          Bloqueado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Ativo
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Passageiro • {selectedDocPassenger.totalRides || 0} corridas realizadas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDocPassenger(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
                {selectedDocPassenger.documentsRequested && (
                  <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-600/60 text-amber-200 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-amber-300">
                      <AlertTriangle className="w-4 h-4" /> Documentos Solicitados ao Passageiro:
                    </span>
                    <p className="font-mono text-[11px] bg-slate-950/70 p-2 rounded border border-amber-500/30">
                      {selectedDocPassenger.documentsRequested}
                    </p>
                  </div>
                )}

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">WhatsApp</span>
                    <span className="font-semibold text-white">{selectedDocPassenger.whatsapp}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">E-mail</span>
                    <span className="font-semibold text-white truncate block">{selectedDocPassenger.email}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Cadastrado em</span>
                    <span className="font-semibold text-white">
                      {new Date(selectedDocPassenger.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Débito Pendente</span>
                    <span className={`font-semibold ${selectedDocPassenger.hasUnpaidDebt ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {selectedDocPassenger.hasUnpaidDebt ? `R$ ${(selectedDocPassenger.unpaidAmount || 0).toFixed(2)}` : 'Nenhum'}
                    </span>
                  </div>
                </div>

                {/* Documentos */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Documentos e Certidões de Segurança
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Documento de Identidade */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">Documento Oficial (RG ou CNH)</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            selectedDocPassenger.idDocumentUrl
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {selectedDocPassenger.idDocumentUrl ? '✓ Enviado' : 'Não enviado'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Verificação oficial de identidade do passageiro.</p>
                      {selectedDocPassenger.idDocumentUrl ? (
                        <DocumentPreviewCard url={selectedDocPassenger.idDocumentUrl} label="Documento de Identidade" />
                      ) : (
                        <div className="p-2 rounded bg-slate-900 text-slate-500 text-center text-[11px]">
                          Documento não enviado pelo passageiro.
                        </div>
                      )}
                    </div>

                    {/* Antecedentes Criminais */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">Antecedentes Criminais (+5% OFF)</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            selectedDocPassenger.criminalRecordUrl
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {selectedDocPassenger.criminalRecordUrl ? '✓ Enviado' : 'Opcional'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Certidão da Polícia Civil para benefício VIP 5% OFF.</p>
                      {selectedDocPassenger.criminalRecordUrl ? (
                        <DocumentPreviewCard url={selectedDocPassenger.criminalRecordUrl} label="Antecedentes Criminais" />
                      ) : (
                        <div className="p-2 rounded bg-slate-900 text-slate-500 text-center text-[11px]">
                          Passageiro optou por não enviar certidão de antecedentes.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => {
                    handleDeletePassenger(selectedDocPassenger.uid, selectedDocPassenger.name);
                    setSelectedDocPassenger(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" /> Excluir Passageiro
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleRequestPassengerDocs(selectedDocPassenger.uid, selectedDocPassenger.documentsRequested);
                      setSelectedDocPassenger(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Pedir Documentações
                  </button>
                  {selectedDocPassenger.isBlocked ? (
                    <button
                      onClick={() => {
                        handleUnblockPassenger(selectedDocPassenger.uid);
                        setSelectedDocPassenger(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Desbloquear
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleBlockPassenger(selectedDocPassenger.uid);
                        setSelectedDocPassenger(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 font-bold text-xs"
                    >
                      Bloquear
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedDocPassenger(null)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL: INSPEÇÃO COMPLETA DE CORRIDA OU ENTREGA */}
      {selectedRideDetail &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      selectedRideDetail.serviceType === 'delivery'
                        ? 'bg-cyan-950/80 border border-cyan-800/80 text-cyan-400'
                        : 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-400'
                    }`}
                  >
                    {selectedRideDetail.serviceType === 'delivery' ? (
                      <Package className="w-5 h-5" />
                    ) : (
                      <Car className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">
                        {selectedRideDetail.serviceType === 'delivery'
                          ? 'Inspeção de Entrega'
                          : 'Inspeção de Corrida'}
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          selectedRideDetail.serviceType === 'delivery'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {selectedRideDetail.serviceType === 'delivery' ? '📦 Entrega' : '🚗 Corrida'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {selectedRideDetail.status}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-400">ID: {selectedRideDetail.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRideDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto space-y-4">
                {/* Financial & Direct Payment Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Valor Total da Solicitação
                    </span>
                    <div className="text-2xl font-black text-emerald-400">
                      R$ {selectedRideDetail.fareAmount.toFixed(2)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Modelo Fase 1: 100% recebido direto pelo condutor • 0% taxa de intermediação
                    </p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Método:</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold text-xs">
                        {selectedRideDetail.paymentMethod === 'CARD_MACHINE'
                          ? '💳 Maquininha'
                          : selectedRideDetail.paymentMethod === 'PIX'
                          ? '⚡ Pix Direto'
                          : '💵 Dinheiro'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Status:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                          selectedRideDetail.paymentStatus === 'PAID'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {selectedRideDetail.paymentStatus === 'PAID' ? '✓ Pago / Confirmado' : '⏳ Pendente'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery Specific Recipient Card */}
                {selectedRideDetail.serviceType === 'delivery' && selectedRideDetail.deliveryDetails && (
                  <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                          Dados do Destinatário & Pacote
                        </h4>
                      </div>
                      {selectedRideDetail.deliveryDetails.recipientPhone && (
                        <a
                          href={`https://wa.me/55${selectedRideDetail.deliveryDetails.recipientPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <MessageSquare className="w-3 h-3" /> WhatsApp Destinatário ↗
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Destinatário</span>
                        <span className="font-bold text-white text-sm">
                          {selectedRideDetail.deliveryDetails.recipientName || 'Não informado'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Telefone de Contato</span>
                        <span className="font-bold text-cyan-300 font-mono text-sm">
                          {selectedRideDetail.deliveryDetails.recipientPhone || 'Não informado'}
                        </span>
                      </div>
                    </div>

                    {selectedRideDetail.deliveryDetails.packageNotes && (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">
                          Instruções / Conteúdo da Encomenda
                        </span>
                        <p className="text-slate-200 italic">
                          "{selectedRideDetail.deliveryDetails.packageNotes}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Customer and Driver Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Customer */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <User className="w-3.5 h-3.5 text-emerald-400" /> Solicitante / Cliente
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{selectedRideDetail.passengerName}</div>
                      <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" /> {selectedRideDetail.passengerPhone || 'Não cadastrado'}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 mt-1">UID: {selectedRideDetail.passengerId}</div>
                    </div>
                  </div>

                  {/* Driver */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      {selectedRideDetail.vehicle?.type === 'bicycle' ? (
                        <Bike className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Car className="w-3.5 h-3.5 text-emerald-400" />
                      )}{' '}
                      Condutor Parceiro
                    </div>
                    {selectedRideDetail.driverName ? (
                      <div>
                        <div className="font-bold text-white text-sm">{selectedRideDetail.driverName}</div>
                        {selectedRideDetail.driverPhone && (
                          <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500" /> {selectedRideDetail.driverPhone}
                          </div>
                        )}
                        {selectedRideDetail.vehicle && (
                          <div className="mt-1.5 p-2 rounded bg-slate-900 border border-slate-800/80 text-[11px]">
                            <span className="font-semibold text-slate-200">
                              {selectedRideDetail.vehicle.brand} {selectedRideDetail.vehicle.model}
                            </span>
                            <span className="text-slate-400 block font-mono text-[10px]">
                              {selectedRideDetail.vehicle.type === 'bicycle'
                                ? '🚲 Bicicleta • Sem placa'
                                : `Placa: ${selectedRideDetail.vehicle.plate || '—'} • Cor: ${selectedRideDetail.vehicle.color || '—'}`}
                            </span>
                          </div>
                        )}
                        <div className="font-mono text-[10px] text-slate-500 mt-1">UID: {selectedRideDetail.driverId}</div>
                      </div>
                    ) : (
                      <div className="text-slate-500 italic py-2">
                        Nenhum condutor aceitou ou solicitação ainda pendente.
                      </div>
                    )}
                  </div>
                </div>

                {/* Route Card */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Itinerário & Trajeto
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {selectedRideDetail.distanceKm.toFixed(1)} km • ~{Math.round(selectedRideDetail.durationMinutes)} min
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                          {selectedRideDetail.serviceType === 'delivery' ? 'Ponto de Coleta' : 'Origem / Embarque'}
                        </span>
                        <span className="text-slate-200">{selectedRideDetail.origin.address}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-rose-400 block">
                          {selectedRideDetail.serviceType === 'delivery' ? 'Ponto de Entrega' : 'Destino / Desembarque'}
                        </span>
                        <span className="text-slate-200">{selectedRideDetail.destination.address}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timestamps Card */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Linha do Tempo
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Solicitado</span>
                      <span className="text-slate-300">
                        {new Date(selectedRideDetail.requestedAt).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    {selectedRideDetail.acceptedAt && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Aceito</span>
                        <span className="text-slate-300">
                          {new Date(selectedRideDetail.acceptedAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {selectedRideDetail.startedAt && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Iniciado</span>
                        <span className="text-slate-300">
                          {new Date(selectedRideDetail.startedAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {selectedRideDetail.completedAt && (
                      <div>
                        <span className="text-emerald-400 block text-[10px]">Concluído</span>
                        <span className="text-emerald-300 font-bold">
                          {new Date(selectedRideDetail.completedAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {selectedRideDetail.cancelledAt && (
                      <div className="col-span-2">
                        <span className="text-rose-400 block text-[10px]">Cancelado ({selectedRideDetail.cancelledBy})</span>
                        <span className="text-rose-300">
                          {new Date(selectedRideDetail.cancelledAt).toLocaleTimeString('pt-BR')}{' '}
                          {selectedRideDetail.cancelReason && `— Motivo: ${selectedRideDetail.cancelReason}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {selectedRideDetail.status !== 'COMPLETED' && !selectedRideDetail.status.startsWith('CANCELLED') && (
                    <button
                      type="button"
                      onClick={() => {
                        setRideToCancel(selectedRideDetail);
                        setCancelReasonInput('Cancelado via Painel Administrativo');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-rose-950/50"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-400" /> Cancelar Corrida
                    </button>
                  )}
                  {selectedRideDetail.status === 'COMPLETED' && selectedRideDetail.paymentStatus !== 'PAID' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await ridesApi.approvePayment(selectedRideDetail.id);
                          setMessage({
                            type: 'success',
                            text: `Pagamento da solicitação #${selectedRideDetail.id.slice(-6)} aprovado com sucesso!`,
                          });
                          setSelectedRideDetail(null);
                          loadAllAdminData();
                        } catch (err: any) {
                          setMessage({ type: 'error', text: err.message || 'Falha ao aprovar pagamento.' });
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/60"
                    >
                      <Check className="w-4 h-4" /> Aprovar Pagamento Manualmente
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRideDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Admin Ride Cancellation Confirmation Modal */}
      {rideToCancel &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  <span>Cancelar Corrida (Admin)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRideToCancel(null);
                    setCancelReasonInput('');
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <p>
                  Tem certeza de que deseja cancelar a solicitação{' '}
                  <span className="font-mono font-bold text-white">#{rideToCancel.id.slice(-6)}</span>?
                </p>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
                  <div>
                    <span className="text-slate-400">Passageiro: </span>
                    <span className="text-slate-200 font-semibold">{rideToCancel.passengerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Motorista: </span>
                    <span className="text-slate-200 font-semibold">
                      {rideToCancel.driverName || 'Nenhum motorista alocado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status Atual: </span>
                    <span className="text-amber-400 font-bold">{rideToCancel.status}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Motivo do cancelamento <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Ex: Cancelamento solicitado pelo usuário / teste administrativo"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={cancelLoading}
                  onClick={() => {
                    setRideToCancel(null);
                    setCancelReasonInput('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={cancelLoading || !cancelReasonInput.trim()}
                  onClick={handleAdminCancelRide}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-950/50"
                >
                  {cancelLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
