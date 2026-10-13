import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { driversApi } from '../api/drivers.js';
import {
  DriverCustomPricing,
  DriverDeliveryPricing,
  FixedRoutePricing,
  ServiceType,
} from '../../../shared/src/types.js';
import {
  DollarSign,
  Check,
  X,
  Plus,
  Trash2,
  Tag,
  AlertTriangle,
  Loader2,
  Sparkles,
  MapPin,
  HelpCircle,
  Car,
  Package,
} from 'lucide-react';

interface DriverPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleType?: string;
  onPricingUpdated?: (
    newPricing: DriverCustomPricing,
    newDeliveryPricing?: DriverDeliveryPricing,
    servicesOffered?: ServiceType[]
  ) => void;
}

const POPULAR_ROUTE_PRESETS = [
  { name: 'Centro → Maresias', origin: 'Centro', destination: 'Maresias', price: 80 },
  { name: 'Centro → Boiçucanga', origin: 'Centro', destination: 'Boiçucanga', price: 70 },
  { name: 'Centro → Camburi', origin: 'Centro', destination: 'Cambury', price: 65 },
  { name: 'Centro → Juquehy', origin: 'Centro', destination: 'Juquehy', price: 100 },
  { name: 'Centro → Barequeçaba', origin: 'Centro', destination: 'Barequeçaba', price: 35 },
];

export const DriverPricingModal: React.FC<DriverPricingModalProps> = ({
  isOpen,
  onClose,
  vehicleType,
  onPricingUpdated,
}) => {
  const isBicycle = vehicleType === 'bicycle';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Services offered
  const [servicesOffered, setServicesOffered] = useState<ServiceType[]>(
    isBicycle ? ['delivery'] : ['ride', 'delivery']
  );

  // Platform floor values
  const [platformFloor, setPlatformFloor] = useState({
    minimumFare: 10.0,
    perKmRate: 1.0,
    perMinuteRate: 0.0,
  });

  const [deliveryPlatformFloor, setDeliveryPlatformFloor] = useState({
    minimumDeliveryFee: 10.0,
    perKmRate: 2.0,
    waitingPerMinuteRate: 0.5,
  });

  // Ride custom pricing
  const [minimumFare, setMinimumFare] = useState<number>(20.0);
  const [perKmRate, setPerKmRate] = useState<number>(2.5);
  const [perMinuteRate, setPerMinuteRate] = useState<number>(0.5);
  const [allowFixedRoutes, setAllowFixedRoutes] = useState<boolean>(true);
  const [fixedRoutes, setFixedRoutes] = useState<FixedRoutePricing[]>([]);

  // Delivery custom pricing
  const [minimumDeliveryFee, setMinimumDeliveryFee] = useState<number>(10.0);
  const [deliveryPerKmRate, setDeliveryPerKmRate] = useState<number>(2.0);
  const [deliveryWaitingPerMinuteRate, setDeliveryWaitingPerMinuteRate] = useState<number>(0.5);

  // New fixed route draft
  const [newRouteName, setNewRouteName] = useState('');
  const [newOriginZone, setNewOriginZone] = useState('');
  const [newDestZone, setNewDestZone] = useState('');
  const [newRoutePrice, setNewRoutePrice] = useState<number>(60);
  const [showAddRouteForm, setShowAddRouteForm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    driversApi
      .getPricing()
      .then((res) => {
        if (res.platformFloor) {
          setPlatformFloor(res.platformFloor);
        }
        if (res.deliveryPlatformFloor) {
          setDeliveryPlatformFloor(res.deliveryPlatformFloor);
        }
        if (res.servicesOffered && res.servicesOffered.length > 0) {
          setServicesOffered(isBicycle ? ['delivery'] : res.servicesOffered);
        } else if (isBicycle) {
          setServicesOffered(['delivery']);
        }
        if (res.customPricing) {
          setMinimumFare(res.customPricing.minimumFare || 20.0);
          setPerKmRate(res.customPricing.perKmRate || 2.5);
          setPerMinuteRate(res.customPricing.perMinuteRate ?? 0.5);
          setAllowFixedRoutes(res.customPricing.allowFixedRoutes !== false);
          setFixedRoutes(res.customPricing.fixedRoutes || []);
        }
        if (res.customDeliveryPricing) {
          setMinimumDeliveryFee(res.customDeliveryPricing.minimumDeliveryFee ?? 10.0);
          setDeliveryPerKmRate(res.customDeliveryPricing.perKmRate ?? 2.0);
          setDeliveryWaitingPerMinuteRate(res.customDeliveryPricing.waitingPerMinuteRate ?? 0.5);
        }
      })
      .catch((err) => {
        setError(err.message || 'Erro ao carregar tarifas.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, isBicycle]);

  const toggleService = (service: ServiceType) => {
    if (isBicycle && service === 'ride') {
      return;
    }
    setServicesOffered((prev) => {
      const exists = prev.includes(service);
      if (exists) {
        if (prev.length === 1) {
          setError('Você precisa manter ao menos um serviço ativo (corridas ou entregas).');
          return prev;
        }
        setError(null);
        return prev.filter((s) => s !== service);
      } else {
        setError(null);
        return [...prev, service];
      }
    });
  };

  if (!isOpen) return null;

  const handleAddPresetRoute = (preset: typeof POPULAR_ROUTE_PRESETS[0]) => {
    // Avoid duplicates by name
    if (fixedRoutes.some((r) => r.name.toLowerCase() === preset.name.toLowerCase())) {
      return;
    }
    const newRoute: FixedRoutePricing = {
      id: `fr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: preset.name,
      originZone: preset.origin,
      destinationZone: preset.destination,
      price: preset.price,
    };
    setFixedRoutes((prev) => [...prev, newRoute]);
  };

  const handleCreateCustomRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName.trim()) {
      setError('Informe o nome da rota (ex: Centro → Maresias).');
      return;
    }
    if (newRoutePrice < platformFloor.minimumFare) {
      setError(`O preço da rota deve ser no mínimo R$ ${platformFloor.minimumFare.toFixed(2)}.`);
      return;
    }

    const newRoute: FixedRoutePricing = {
      id: `fr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newRouteName.trim(),
      originZone: newOriginZone.trim() || newRouteName.split(/->|→/)[0]?.trim() || '',
      destinationZone: newDestZone.trim() || newRouteName.split(/->|→/)[1]?.trim() || '',
      price: Math.round(Number(newRoutePrice) * 100) / 100,
    };

    setFixedRoutes((prev) => [...prev, newRoute]);
    setNewRouteName('');
    setNewOriginZone('');
    setNewDestZone('');
    setShowAddRouteForm(false);
    setError(null);
  };

  const handleRemoveRoute = (id: string) => {
    setFixedRoutes((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    setError(null);
    setSuccessMessage(null);

    const activeServices = isBicycle ? (['delivery'] as ServiceType[]) : servicesOffered;
    if (activeServices.length === 0) {
      setError('Selecione ao menos um serviço (corridas ou entregas).');
      return;
    }

    if (activeServices.includes('ride')) {
      if (minimumFare < platformFloor.minimumFare) {
        setError(
          `O valor mínimo da corrida não pode ser menor que o piso da plataforma (R$ ${platformFloor.minimumFare.toFixed(2)}).`
        );
        return;
      }
      if (perKmRate < platformFloor.perKmRate) {
        setError(
          `O valor por KM da corrida não pode ser menor que o piso da plataforma (R$ ${platformFloor.perKmRate.toFixed(2)}/km).`
        );
        return;
      }
      if (perMinuteRate < 0) {
        setError('O valor por minuto da corrida deve ser zero ou maior.');
        return;
      }
    }

    if (activeServices.includes('delivery')) {
      if (minimumDeliveryFee < deliveryPlatformFloor.minimumDeliveryFee) {
        setError(
          `O valor mínimo de entrega não pode ser menor que o piso da plataforma (R$ ${deliveryPlatformFloor.minimumDeliveryFee.toFixed(2)}).`
        );
        return;
      }
      if (deliveryPerKmRate < deliveryPlatformFloor.perKmRate) {
        setError(
          `O valor por KM de entrega não pode ser menor que o piso da plataforma (R$ ${deliveryPlatformFloor.perKmRate.toFixed(2)}/km).`
        );
        return;
      }
      if (deliveryWaitingPerMinuteRate < 0) {
        setError('A taxa de espera da entrega por minuto deve ser zero ou maior.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        minimumFare: Math.round(Number(minimumFare) * 100) / 100,
        perKmRate: Math.round(Number(perKmRate) * 100) / 100,
        perMinuteRate: Math.round(Number(perMinuteRate) * 100) / 100,
        allowFixedRoutes,
        fixedRoutes,
        customDeliveryPricing: {
          minimumDeliveryFee: Math.round(Number(minimumDeliveryFee) * 100) / 100,
          perKmRate: Math.round(Number(deliveryPerKmRate) * 100) / 100,
          waitingPerMinuteRate: Math.round(Number(deliveryWaitingPerMinuteRate) * 100) / 100,
        },
        servicesOffered: activeServices,
      };

      const res = await driversApi.updatePricing(payload);
      setSuccessMessage(res.message || 'Suas tarifas e serviços foram salvos com sucesso!');
      onPricingUpdated?.(res.customPricing, res.customDeliveryPricing, res.servicesOffered);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar tarifas.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                Minhas Tarifas <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400">
                O motorista define quanto quer cobrar pelo seu trabalho.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info card */}
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-1.5 text-white">
            <Tag className="w-3.5 h-3.5 text-emerald-400" /> Liberdade com Piso de Segurança
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Você é livre para definir seus valores. Pisos da plataforma:{' '}
            <strong className="text-emerald-300">R$ {platformFloor.minimumFare.toFixed(2)}</strong> por corrida (R$ {platformFloor.perKmRate.toFixed(2)}/km) e{' '}
            <strong className="text-emerald-300">R$ {deliveryPlatformFloor.minimumDeliveryFee.toFixed(2)}</strong> por entrega (R$ {deliveryPlatformFloor.perKmRate.toFixed(2)}/km).
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2 font-medium animate-pulse">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            Carregando suas tarifas configuradas...
          </div>
        ) : (
          <div className="space-y-5">
            {/* 0. SELEÇÃO DE SERVIÇOS PRESTADOS */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Serviços Prestados
                </span>
                <span className="text-[10px] text-slate-400">Escolha o que deseja atender</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Corridas */}
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                    isBicycle
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                      : servicesOffered.includes('ride')
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={isBicycle}
                    checked={!isBicycle && servicesOffered.includes('ride')}
                    onChange={() => toggleService('ride')}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5 text-white">
                      <Car className="w-3.5 h-3.5 text-emerald-400" /> Corridas
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isBicycle ? 'Indisponível para bicicletas' : 'Transporte de passageiros'}
                    </p>
                  </div>
                </label>

                {/* Entregas */}
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                    servicesOffered.includes('delivery')
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={servicesOffered.includes('delivery')}
                    onChange={() => toggleService('delivery')}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5 text-white">
                      <Package className="w-3.5 h-3.5 text-cyan-400" /> Entregas
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Delivery de encomendas e pacotes
                    </p>
                  </div>
                </label>
              </div>
              {isBicycle && (
                <p className="text-[11px] text-amber-400/90 bg-amber-950/30 p-2 rounded-lg border border-amber-500/30">
                  🚲 Parceiros com bicicleta operam exclusivamente com entregas e encomendas.
                </p>
              )}
            </div>

            {/* TARIFAS DE CORRIDA */}
            {servicesOffered.includes('ride') && !isBicycle && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                  <Car className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Tarifas de Corrida de Passageiros
                  </h4>
                </div>

                {/* 1. Valor Mínimo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>1. Valor Mínimo da Corrida</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Piso: R$ {platformFloor.minimumFare.toFixed(2)}
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.50"
                      min={platformFloor.minimumFare}
                      value={minimumFare}
                      onChange={(e) => setMinimumFare(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="20.00"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Nenhuma corrida aceita por você terá valor inferior a este montante.
                  </p>
                </div>

                {/* 2. Valor por KM */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>2. Valor por Quilômetro (KM)</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Piso: R$ {platformFloor.perKmRate.toFixed(2)}/km
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.10"
                      min={platformFloor.perKmRate}
                      value={perKmRate}
                      onChange={(e) => setPerKmRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="2.50"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Multiplicado pela distância real da rota calculada pelo satélite.
                  </p>
                </div>

                {/* 3. Valor por Minuto */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>3. Valor por Minuto (Opcional)</span>
                    <span className="text-[10px] text-slate-500 font-normal">Padrão: R$ 0,00</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={perMinuteRate}
                      onChange={(e) => setPerMinuteRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="0.50"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Remunera o tempo no trânsito ou paradas durante o percurso.
                  </p>
                </div>

                {/* 4. Preço Fixo por Rota */}
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowFixedRoutes}
                        onChange={(e) => setAllowFixedRoutes(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                      />
                      <span className="text-xs font-bold text-white">
                        Permitir preço fixo por rota / zona
                      </span>
                    </label>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      {fixedRoutes.length} rota(s)
                    </span>
                  </div>

                  {allowFixedRoutes && (
                    <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                      {/* Presets suggestions */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          Sugestões Rápidas de São Sebastião:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {POPULAR_ROUTE_PRESETS.map((p) => {
                            const alreadyAdded = fixedRoutes.some(
                              (r) => r.name.toLowerCase() === p.name.toLowerCase()
                            );
                            return (
                              <button
                                key={p.name}
                                type="button"
                                onClick={() => handleAddPresetRoute(p)}
                                disabled={alreadyAdded}
                                className={`text-[10px] px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                                  alreadyAdded
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200 hover:border-emerald-500'
                                }`}
                              >
                                <Plus className="w-2.5 h-2.5 text-emerald-400" />
                                {p.name} (R$ {p.price})
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* List of configured fixed routes */}
                      {fixedRoutes.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Rotas Fixas Ativas:
                          </span>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {fixedRoutes.map((route) => (
                              <div
                                key={route.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="font-semibold text-white">{route.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-emerald-400">
                                    R$ {route.price.toFixed(2)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRoute(route.id)}
                                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                    title="Remover rota"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add Custom Route Form */}
                      {showAddRouteForm ? (
                        <form
                          onSubmit={handleCreateCustomRoute}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2.5 mt-2"
                        >
                          <span className="text-xs font-bold text-white block">Nova Rota Personalizada</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={newRouteName}
                              onChange={(e) => setNewRouteName(e.target.value)}
                              placeholder="Nome (ex: Centro → Maresias)"
                              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              required
                            />
                            <div className="relative flex items-center">
                              <span className="absolute left-2.5 text-xs font-bold text-slate-400">R$</span>
                              <input
                                type="number"
                                step="1.00"
                                min={platformFloor.minimumFare}
                                value={newRoutePrice}
                                onChange={(e) => setNewRoutePrice(parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white font-bold"
                                placeholder="Preço R$"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowAddRouteForm(false)}
                              className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white text-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow"
                            >
                              <Plus className="w-3 h-3" /> Adicionar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowAddRouteForm(true)}
                          className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-dashed border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          Adicionar Rota Personalizada
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TARIFAS DE ENTREGA */}
            {servicesOffered.includes('delivery') && (
              <div className="space-y-4 pt-1 border-t border-slate-800">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                  <Package className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Tarifas de Entrega de Encomendas
                  </h4>
                </div>

                {/* 1. Valor Mínimo da Entrega */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>Valor Mínimo da Entrega</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Piso: R$ {deliveryPlatformFloor.minimumDeliveryFee.toFixed(2)}
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.50"
                      min={deliveryPlatformFloor.minimumDeliveryFee}
                      value={minimumDeliveryFee}
                      onChange={(e) => setMinimumDeliveryFee(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-cyan-500 transition-colors"
                      placeholder="10.00"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Nenhuma entrega aceita terá valor inferior a este montante.
                  </p>
                </div>

                {/* 2. Valor por KM da Entrega */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>Valor por KM de Entrega</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Piso: R$ {deliveryPlatformFloor.perKmRate.toFixed(2)}/km
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.10"
                      min={deliveryPlatformFloor.perKmRate}
                      value={deliveryPerKmRate}
                      onChange={(e) => setDeliveryPerKmRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-cyan-500 transition-colors"
                      placeholder="2.00"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Multiplicado pela distância da rota até o ponto de entrega.
                  </p>
                </div>

                {/* 3. Taxa de Espera por Minuto */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>Taxa de Espera por Minuto (Opcional)</span>
                    <span className="text-[10px] text-slate-500 font-normal">Padrão: R$ 0,50/min</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={deliveryWaitingPerMinuteRate}
                      onChange={(e) => setDeliveryWaitingPerMinuteRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-cyan-500 transition-colors"
                      placeholder="0.50"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Remunera o tempo de espera no local de coleta ou de entrega.
                  </p>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all hover:scale-[1.01]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Salvando Tarifas...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> SALVAR TARIFAS
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
