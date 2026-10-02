import React, { useState, useEffect } from 'react';
import { Timer, AlertTriangle, CheckCircle } from 'lucide-react';

interface WaitingTimerProps {
  startedAt: string;
  totalDurationSeconds?: number;
  onExpire?: () => void;
}

export const WaitingTimer: React.FC<WaitingTimerProps> = ({
  startedAt,
  totalDurationSeconds = 240, // 4 minutes
  onExpire,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(totalDurationSeconds);

  useEffect(() => {
    const calculateRemaining = () => {
      const startMs = new Date(startedAt).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startMs) / 1000);
      const remaining = Math.max(0, totalDurationSeconds - elapsedSeconds);
      setSecondsRemaining(remaining);
      if (remaining === 0 && onExpire) {
        onExpire();
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [startedAt, totalDurationSeconds, onExpire]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const percentRemaining = (secondsRemaining / totalDurationSeconds) * 100;

  const isExpired = secondsRemaining === 0;
  const isUrgent = secondsRemaining > 0 && secondsRemaining <= 60;

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isExpired
          ? 'bg-rose-950/40 border-rose-600/60 text-rose-300'
          : isUrgent
          ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
          : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isExpired ? (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          ) : (
            <Timer className="w-5 h-5 text-emerald-400 animate-pulse" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider">
            {isExpired ? 'Tempo de Tolerância Esgotado' : 'Tempo de Espera no Embarque'}
          </span>
        </div>
        <span className="font-mono text-2xl font-black tracking-tight">{formattedTime}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-1000 ${
            isExpired ? 'bg-rose-500' : isUrgent ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{ width: `${percentRemaining}%` }}
        />
      </div>

      <p className="text-[11px] text-slate-300 leading-tight">
        {isExpired
          ? 'O prazo regulamentar de 4 minutos encerrou. Você pode iniciar a viagem se o passageiro embarcou ou prosseguir conforme a política local.'
          : 'Aguarde o passageiro no ponto combinado. Tolerância de cortesia de 4 minutos para embarque.'}
      </p>
    </div>
  );
};
