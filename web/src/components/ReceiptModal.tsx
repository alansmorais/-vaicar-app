import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Receipt } from '../../../shared/src/types.js';
import { receiptsApi } from '../api/receipts.js';
import { X, Printer, CheckCircle, ExternalLink } from 'lucide-react';

interface ReceiptModalProps {
  receipt: Receipt;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-emerald-500/50 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-100 my-auto animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Recibo da Corrida</h3>
              <p className="text-xs text-slate-400">Nº {receipt.receiptNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fare Highlight */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center mb-6">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Valor Total Pago
          </span>
          <span className="text-4xl font-extrabold text-emerald-400">
            R$ {receipt.fareAmount.toFixed(2)}
          </span>
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-slate-300">
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-medium">
              {receipt.paymentMethod}
            </span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">{receipt.paymentStatus}</span>
          </div>
        </div>

        {receipt.discountApplied && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2.5 text-center text-xs text-emerald-300 font-semibold mb-4">
            🏷️ 5% Desconto Passageiro Verificado aplicado (-R$ {receipt.discountAmount?.toFixed(2)})
          </div>
        )}

        <div className="text-[11px] text-slate-400 text-center mb-4">
          💵 Pagamento realizado diretamente ao motorista via {receipt.paymentMethod}.
        </div>

        {/* Breakdown rows */}
        <div className="space-y-3 text-xs mb-6 divide-y divide-slate-800/80">
          <div className="flex justify-between pt-2">
            <span className="text-slate-400">Data e Hora:</span>
            <span className="font-semibold text-white">{new Date(receipt.dateTime).toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-slate-400">Passageiro:</span>
            <span className="font-semibold text-white">{receipt.passengerName}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-slate-400">Motorista:</span>
            <span className="font-semibold text-white">{receipt.driverName}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-slate-400">Veículo:</span>
            <span className="font-semibold text-white">
              {receipt.vehicleDescription} ({receipt.vehiclePlate})
            </span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-slate-400">Distância / Duração:</span>
            <span className="font-semibold text-white">
              {receipt.distanceKm.toFixed(1)} km • {receipt.durationMinutes} min
            </span>
          </div>
        </div>

        {/* Route Details */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs mb-6">
          <div>
            <span className="text-emerald-400 font-bold block mb-0.5">Partida:</span>
            <p className="text-slate-200">{receipt.originAddress}</p>
          </div>
          <div className="pt-2 border-t border-slate-800/60">
            <span className="text-rose-400 font-bold block mb-0.5">Destino:</span>
            <p className="text-slate-200">{receipt.destinationAddress}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
          <a
            href={receiptsApi.getHtmlUrl(receipt.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors text-center"
          >
            <ExternalLink className="w-4 h-4" /> Visualizar Oficial
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
};
