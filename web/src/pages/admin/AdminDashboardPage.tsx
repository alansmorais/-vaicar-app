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
    'metrics' | 'drivers' | 'passengers' | 'rides' | 'pricing' | 'emails' | 'reports'
  >('metrics');

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [passengers, setPassengers] = useState<PassengerProfile[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [pricing, setPricing] = useState<PlatformPricingSettings | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogItem[]>([]);

  // Driver filter
  const [driverFilter, setDriverFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Pricing form
  const [baseFare, setBaseFare] = useState('');
  const [perKmRate, setPerKmRate] = useState('');
  const [perMinuteRate, setPerMinuteRate] = useState('');
  const [minimumFare, setMinimumFare] = useState('');

  // Document Inspection Modals
  const [selectedDocDriver, setSelectedDocDriver] = useState<DriverProfile | null>(null);
  const [selectedDocPassenger, setSelectedDocPassenger] = useState<PassengerProfile | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAllAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, d, p, r, pr, em, rep] = await Promise.all([
        adminApi.getMetrics(),
        adminApi.getDrivers(),
        adminApi.getPassengers(),
        adminApi.getRides(),
        adminApi.getPricing(),
        adminApi.getEmailDiagnostics(),
        adminApi.getReports(),
      ]);

      setMetrics(m);
      setDrivers(d);
      setPassengers(p);
      setRides(r);
      setPricing(pr);
      setEmailLogs(em);
      setReports(rep || []);

      if (pr) {
        setBaseFare(String(pr.baseFare));
        setPerKmRate(String(pr.perKmRate));
        setPerMinuteRate(String(pr.perMinuteRate));
        setMinimumFare(String(pr.minimumFare));
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
      });
      setMessage({ type: 'success', text: 'Tabela de preços atualizada com sucesso!' });
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
    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.cpf.includes(searchTerm) ||
      d.vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Total de Corridas</span>
                <span className="text-2xl font-black text-white mt-1 block">{metrics.totalRides}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Concluídas com Sucesso</span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">{metrics.completedRides}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Motoristas Online</span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">{metrics.activeOnlineDrivers}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Pendentes de Aprovação</span>
                <span className="text-2xl font-black text-amber-400 mt-1 block">{metrics.pendingDriverApprovals}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Passageiros Cadastrados</span>
                <span className="text-2xl font-black text-white mt-1 block">{metrics.totalPassengers}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Volume Bruto Transacionado</span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">
                  R$ {metrics.grossVolumeBRL.toFixed(2)}
                </span>
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                {['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setDriverFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      driverFilter === st
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'Todos'
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

              <div className="relative w-full sm:w-64">
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

            {/* Drivers table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Motorista</th>
                    <th className="p-3">CPF & CNH</th>
                    <th className="p-3">Veículo</th>
                    <th className="p-3">Regiões</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredDrivers.map((d) => (
                    <tr key={d.uid} className="hover:bg-slate-950/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {d.photoUrl ? (
                            <img
                              src={d.photoUrl}
                              alt={d.name}
                              className="w-9 h-9 rounded-full object-cover border border-emerald-500"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                              <User className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-white block">{d.name}</span>
                            <span className="text-[11px] text-slate-400">{d.whatsapp}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-xs text-white">CPF: {d.cpf}</div>
                        <div className="text-[11px] text-slate-400 font-mono">CNH: {d.cnhNumber}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${d.cnhUrl ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            CNH {d.cnhUrl ? '✓' : '—'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${d.crlvUrl ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            CRLV {d.crlvUrl ? '✓' : '—'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${d.criminalRecordUrl ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            Antecedentes {d.criminalRecordUrl ? '✓' : '—'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${d.proofOfAddressUrl ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            Residência {d.proofOfAddressUrl ? '✓' : '—'}
                          </span>
                        </div>
                        {d.documentsRequested && (
                          <div className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-700/50 rounded px-1.5 py-0.5 mt-1 truncate max-w-xs" title={d.documentsRequested}>
                            ⚠️ Pedido: {d.documentsRequested}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-white">
                          {d.vehicle.brand} {d.vehicle.model} ({d.vehicle.year})
                        </div>
                        <div className="font-mono text-emerald-400 text-[11px]">{d.vehicle.plate}</div>
                      </td>
                      <td className="p-3">
                        <div className="max-w-xs truncate text-[11px] text-slate-400">
                          {d.operatingZones?.join(', ') || 'Geral / São Sebastião'}
                        </div>
                      </td>
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
                          {d.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                          <button
                            onClick={() => setSelectedDocDriver(d)}
                            className="px-2 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                            title="Ver fotos e documentos do motorista"
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
                            title="Excluir motorista/entregador permanentemente"
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

        {/* 4. RIDES TAB */}
        {activeTab === 'rides' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Histórico e Gestão de Corridas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">ID / Data</th>
                    <th className="p-3">Passageiro</th>
                    <th className="p-3">Motorista</th>
                    <th className="p-3">Trajeto</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Pagamento</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rides.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-950/40">
                      <td className="p-3 font-mono text-[11px]">
                        <div>{r.id.slice(0, 15)}...</div>
                        <div className="text-slate-500">{new Date(r.requestedAt).toLocaleTimeString('pt-BR')}</div>
                      </td>
                      <td className="p-3 font-semibold text-white">{r.passengerName}</td>
                      <td className="p-3">{r.driverName || '—'}</td>
                      <td className="p-3 max-w-xs truncate text-[11px]">
                        {r.origin.address} → {r.destination.address}
                      </td>
                      <td className="p-3 font-bold text-emerald-400">R$ {r.fareAmount.toFixed(2)}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.paymentStatus === 'PAID'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {r.paymentStatus || 'PENDENTE'}
                        </span>
                      </td>
                      <td className="p-3">
                        {r.status === 'COMPLETED' && r.paymentStatus !== 'PAID' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await ridesApi.approvePayment(r.id);
                                setMessage({ type: 'success', text: `Pagamento da corrida #${r.id.slice(-6)} aprovado pelo administrador!` });
                                loadData();
                              } catch (err: any) {
                                setMessage({ type: 'error', text: err.message || 'Falha ao aprovar pagamento.' });
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors"
                          >
                            Aprovar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. PRICING SETTINGS TAB */}
        {activeTab === 'pricing' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white">Configuração de Tarifas da Cidade</h3>
              <p className="text-xs text-slate-400">
                Valores calculados em tempo real para todas as estimativas e corridas em São Sebastião.
              </p>
            </div>

            <form onSubmit={handleSavePricing} className="space-y-4">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs uppercase text-white shadow-lg"
              >
                Salvar e Aplicar Novas Tarifas
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
                      {selectedDocDriver.professionalCategory || 'Motorista / Entregador'} • {selectedDocDriver.subscriptionPlan === 'weekly' ? 'Plano Semanal (10%)' : 'Plano Mensal (R$ 100)'}
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

                {/* Dados Cadastrais */}
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
                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Veículo</span>
                    <span className="font-semibold text-white">
                      {selectedDocDriver.vehicle.brand} {selectedDocDriver.vehicle.model} ({selectedDocDriver.vehicle.year}) - {selectedDocDriver.vehicle.color}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Placa</span>
                    <span className="font-mono font-bold text-emerald-400">{selectedDocDriver.vehicle.plate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Tipo</span>
                    <span className="font-semibold text-white capitalize">{selectedDocDriver.vehicle.type}</span>
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
    </div>
  );
};
