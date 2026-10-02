import React, { useState } from 'react';
import { ReportCategory, Report } from '../../../shared/src/types.js';
import { reportsApi } from '../api/reports.js';
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId?: string;
  targetRole: 'driver' | 'passenger';
  targetName?: string;
  defaultCategory?: ReportCategory;
  defaultAmount?: number;
  onSuccess?: (report: Report) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  rideId,
  targetRole,
  targetName,
  defaultCategory,
  defaultAmount,
  onSuccess,
}) => {
  const [category, setCategory] = useState<ReportCategory>(
    defaultCategory || (targetRole === 'passenger' ? 'UNPAID_FARE' : 'OVERCHARGING')
  );
  const [description, setDescription] = useState('');
  const [unpaidAmount, setUnpaidAmount] = useState<string>(
    defaultAmount ? defaultAmount.toFixed(2) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim() || description.trim().length < 5) {
      setError('Por favor, detalhe o ocorrido com no mínimo 5 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const parsedAmount = category === 'UNPAID_FARE' && unpaidAmount ? parseFloat(unpaidAmount.replace(',', '.')) : undefined;
      const res = await reportsApi.create({
        rideId,
        category,
        description: description.trim(),
        unpaidAmount: parsedAmount,
      });

      setSuccessMessage(res.message);
      if (onSuccess) {
        onSuccess(res.report);
      }
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err?.message || 'Falha ao registrar ocorrência. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 sm:p-7 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-rose-950/80 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              {targetRole === 'passenger' ? 'Reportar Ocorrência com Passageiro' : 'Reportar Problema com Motorista'}
            </h2>
            <p className="text-xs text-slate-400">
              {targetName ? `Envolvido: ${targetName}` : 'Segurança e conformidade VaiCar'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-600/60 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">Ocorrência Registrada!</h3>
            <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
              {successMessage}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Motivo Principal da Ocorrência
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
              >
                {targetRole === 'passenger' ? (
                  <>
                    <option value="UNPAID_FARE">🚫 Passageiro Não Pagou a Corrida (Calote)</option>
                    <option value="MISCONDUCT">⚠️ Comportamento Agressivo ou Inadequado</option>
                    <option value="NO_SHOW">⌛ Não Compareceu ao Ponto de Embarque</option>
                    <option value="DAMAGE">🚗 Causou Danos ou Sujeira no Veículo</option>
                    <option value="OTHER">📝 Outro Motivo</option>
                  </>
                ) : (
                  <>
                    <option value="OVERCHARGING">💵 Cobrança Indevida / Cobrou a mais que o combinado</option>
                    <option value="DANGEROUS_DRIVING">⚠️ Direção Perigosa / Imprudência no Trânsito</option>
                    <option value="VEHICLE_ISSUE">🚗 Veículo em Más Condições ou Placa Diferente</option>
                    <option value="MISCONDUCT">🗣️ Conduta Grosseira ou Desrespeitosa</option>
                    <option value="OTHER">📝 Outro Motivo</option>
                  </>
                )}
              </select>
            </div>

            {/* If UNPAID_FARE: Show unpaid amount and blocking warning */}
            {category === 'UNPAID_FARE' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Valor Não Pago pelo Passageiro (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={unpaidAmount}
                    onChange={(e) => setUnpaidAmount(e.target.value)}
                    placeholder="Ex: 25.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
                    required
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5 leading-relaxed">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Bloqueio Imediato da Plataforma:</strong>
                    Ao confirmar a denúncia por falta de pagamento, o passageiro será <strong>automaticamente impedido</strong> de solicitar novas corridas no VaiCar até que comprove a quitação junto à administração.
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Detalhes da Ocorrência *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva detalhadamente o ocorrido (o que aconteceu, horário, conversa, etc.)..."
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 font-medium leading-relaxed resize-none"
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-1/3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`w-2/3 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                  category === 'UNPAID_FARE'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                }`}
              >
                {loading ? 'Enviando...' : category === 'UNPAID_FARE' ? 'Confirmar & Bloquear Passageiro' : 'Enviar Denúncia'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
