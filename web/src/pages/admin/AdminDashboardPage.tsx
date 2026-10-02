import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { adminApi, EmailLogItem } from '../../api/admin.js';
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
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user, isAdmin, role, devLogin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    'metrics' | 'drivers' | 'passengers' | 'rides' | 'pricing' | 'emails'
  >('metrics');

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [passengers, setPassengers] = useState<PassengerProfile[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
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

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAllAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, d, p, r, pr, em] = await Promise.all([
        adminApi.getMetrics(),
        adminApi.getDrivers(),
        adminApi.getPassengers(),
        adminApi.getRides(),
        adminApi.getPricing(),
        adminApi.getEmailDiagnostics(),
      ]);

      setMetrics(m);
      setDrivers(d);
      setPassengers(p);
      setRides(r);
      setPricing(pr);
      setEmailLogs(em);

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
      await adminApi.approveDriver(driverId);
      setMessage({ type: 'success', text: 'Motorista aprovado com sucesso! E-mail de confirmação enviado.' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao aprovar motorista.' });
    }
  };

  const handleRejectDriver = async (driverId: string) => {
    const reason = window.prompt('Informe o motivo da recusa do motorista:');
    if (!reason) return;
    try {
      await adminApi.rejectDriver(driverId, reason);
      setMessage({ type: 'success', text: 'Motorista reprovado. Notificação enviada por e-mail.' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao rejeitar motorista.' });
    }
  };

  const handleSuspendDriver = async (driverId: string) => {
    const reason = window.prompt('Informe o motivo da suspensão da conta:');
    if (!reason) return;
    try {
      await adminApi.suspendDriver(driverId, reason);
      setMessage({ type: 'success', text: 'Conta do motorista suspensa.' });
      loadAllAdminData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao suspender motorista.' });
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
          <div className="space-y-2 pt-2">
            <Link
              to="/admin/login"
              className="block w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs uppercase text-white"
            >
              Fazer Login como Administrador
            </Link>
            <button
              onClick={() => devLogin('test-admin-01', 'admin@vaicar.app', 'admin', 'Administrador Chefe')}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
            >
              Usar Sessão de Teste (Admin)
            </button>
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
                      <td className="p-3 font-mono">
                        <div>CPF: {d.cpf}</div>
                        <div className="text-[11px] text-slate-500">CNH: {d.cnhNumber}</div>
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
                        <div className="flex items-center justify-end gap-1.5">
                          {d.status !== 'APPROVED' && (
                            <button
                              onClick={() => handleApproveDriver(d.uid)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px]"
                            >
                              Aprovar
                            </button>
                          )}
                          {d.status === 'PENDING_APPROVAL' && (
                            <button
                              onClick={() => handleRejectDriver(d.uid)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px]"
                            >
                              Rejeitar
                            </button>
                          )}
                          {d.status === 'APPROVED' && (
                            <button
                              onClick={() => handleSuspendDriver(d.uid)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 font-semibold text-[11px]"
                            >
                              Suspender
                            </button>
                          )}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {passengers.map((p) => (
                    <tr key={p.uid} className="hover:bg-slate-950/40">
                      <td className="p-3 font-semibold text-white">{p.name}</td>
                      <td className="p-3">{p.whatsapp}</td>
                      <td className="p-3 text-slate-400">{p.email}</td>
                      <td className="p-3 font-bold text-emerald-400">{p.totalRides || 0}</td>
                      <td className="p-3 text-slate-500">
                        {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. RIDES TAB */}
        {activeTab === 'rides' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Monitoramento de Corridas</h3>
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
    </div>
  );
};
