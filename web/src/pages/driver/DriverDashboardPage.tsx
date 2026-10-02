import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { WaitingTimer } from '../../components/WaitingTimer.js';
import { ReceiptModal } from '../../components/ReceiptModal.js';
import { driversApi } from '../../api/drivers.js';
import { ridesApi } from '../../api/rides.js';
import { DriverProfile, Ride, Receipt } from '../../../../shared/src/types.js';
import {
  Car,
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
} from 'lucide-react';

export const DriverDashboardPage: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [receiptToShow, setReceiptToShow] = useState<Receipt | null>(null);

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

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    setActionLoading(true);
    try {
      const res = await ridesApi.complete(activeRide.id);
      setActiveRide(res.ride);
      setReceiptToShow(res.receipt);
      // Reload history and profile
      loadDriverProfile();
      driversApi.getRides().then(setRideHistory).catch(console.error);
    } catch (err: any) {
      setError(err.message || 'Falha ao finalizar viagem.');
    } finally {
      setActionLoading(false);
    }
  };

  const isApproved = driver?.status === 'APPROVED';

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
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/60 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
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

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400 block font-medium">Taxa Cobrada</span>
            <span className="text-sm font-extrabold text-emerald-400 mt-0.5 block">
              0% (Taxa Zero)
            </span>
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
                <span className="text-2xl font-black text-emerald-400">R$ {activeRide.fareAmount.toFixed(2)}</span>
                <span className="text-[11px] text-slate-400 block">Forma: {activeRide.paymentMethod}</span>
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
                <button
                  onClick={handleCompleteRide}
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                >
                  Finalizar Viagem (COMPLETE) & Gerar Recibo
                </button>
              )}

              {activeRide.status === 'COMPLETED' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-emerald-950 border border-emerald-500 text-center text-xs text-emerald-300 font-semibold">
                    Viagem finalizada com sucesso! Cobrança de R$ {activeRide.fareAmount.toFixed(2)} via {activeRide.paymentMethod}.
                  </div>
                  <button
                    onClick={() => setActiveRide(null)}
                    className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase"
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
                        <span className="text-xl font-black text-emerald-400">
                          R$ {ride.fareAmount.toFixed(2)}
                        </span>
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
    </div>
  );
};
