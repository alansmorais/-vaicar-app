import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GpsSample,
  GPS_LOW_ACCURACY_WARNING_METERS,
  filterGpsSample,
  isValidCoordinate,
} from '../utils/geoNavigation.js';

export type GeolocationStatus =
  | 'idle'
  | 'locating'
  | 'active'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'signal_lost'
  | 'unsupported';

export type GeolocationPermission = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'unknown';

export interface UseGeolocationOptions {
  /** Automatically query or watch geolocation when true */
  enabled?: boolean;
  /** Maintain continuous watchPosition tracking */
  watch?: boolean;
  /** Request high accuracy GPS */
  enableHighAccuracy?: boolean;
  /** Timeout for geolocation calls (ms) */
  timeoutMs?: number;
  /** Consider active watch signal lost after this many ms without an update */
  staleThresholdMs?: number;
  /** Optional callback invoked whenever a validated GPS sample is accepted */
  onPosition?: (sample: GpsSample) => void;
}

export interface UseGeolocationResult {
  position: GpsSample | null;
  status: GeolocationStatus;
  error: string | null;
  permissionState: GeolocationPermission;
  isLocating: boolean;
  isLowAccuracy: boolean;
  isStale: boolean;
  requestLocation: () => Promise<GpsSample | null>;
}

function mapGeolocationError(err: GeolocationPositionError): {
  status: GeolocationStatus;
  message: string;
} {
  if (err.code === 1) {
    return {
      status: 'denied',
      message: 'Permissão de localização negada. Ative o GPS nas configurações do navegador para usar sua posição real.',
    };
  }
  if (err.code === 2) {
    return {
      status: 'unavailable',
      message: 'Sinal de GPS indisponível no dispositivo. Verifique se a localização está ativada.',
    };
  }
  if (err.code === 3) {
    return {
      status: 'timeout',
      message: 'Tempo esgotado ao aguardar sinal de GPS. Tente novamente em área aberta.',
    };
  }
  return {
    status: 'unavailable',
    message: 'Não foi possível obter sua localização GPS no momento.',
  };
}

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationResult {
  const {
    enabled = false,
    watch = false,
    enableHighAccuracy = true,
    timeoutMs = 12_000,
    staleThresholdMs = 45_000,
    onPosition,
  } = options;

  const [position, setPosition] = useState<GpsSample | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'idle' : 'unsupported'
  );
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<GeolocationPermission>('unknown');
  const [isLocating, setIsLocating] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const lastAcceptedRef = useRef<GpsSample | null>(null);
  const lastRawReceiveMsRef = useRef<number>(0);
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  const processPosition = useCallback((pos: GeolocationPosition): GpsSample | null => {
    const { latitude, longitude, accuracy, heading, speed } = pos.coords;
    if (!isValidCoordinate(latitude, longitude)) {
      return null;
    }

    const nowMs = Date.now();
    // Guard against browser returning a very old cached timestamp (> 60s old)
    const fixTimestamp =
      typeof pos.timestamp === 'number' && Number.isFinite(pos.timestamp) && nowMs - pos.timestamp <= 60_000
        ? pos.timestamp
        : nowMs;

    const incoming: GpsSample = {
      lat: latitude,
      lng: longitude,
      accuracy: typeof accuracy === 'number' && Number.isFinite(accuracy) ? Math.round(accuracy) : null,
      heading: typeof heading === 'number' && Number.isFinite(heading) ? heading : null,
      speed: typeof speed === 'number' && Number.isFinite(speed) ? speed : null,
      timestamp: fixTimestamp,
      updatedAt: new Date(fixTimestamp).toISOString(),
    };

    lastRawReceiveMsRef.current = nowMs;
    setIsStale(false);
    setError(null);
    setStatus('active');

    const filtered = filterGpsSample(lastAcceptedRef.current, incoming);
    if (!filtered.accepted || !filtered.sample) {
      // Keep current position active even if micro-jitter was suppressed
      return lastAcceptedRef.current;
    }

    lastAcceptedRef.current = filtered.sample;
    setPosition(filtered.sample);
    onPositionRef.current?.(filtered.sample);
    return filtered.sample;
  }, []);

  const handleGeolocationError = useCallback((err: GeolocationPositionError) => {
    const mapped = mapGeolocationError(err);
    setStatus(mapped.status);
    setError(mapped.message);
    if (err.code === 1) {
      setPermissionState('denied');
    }
  }, []);

  // Monitor browser permission state if Permissions API is available
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setPermissionState('unsupported');
      setStatus('unsupported');
      setError('Seu dispositivo ou navegador não suporta geolocalização.');
      return;
    }

    if (!navigator.permissions?.query) return;

    let cancelled = false;
    let permStatus: PermissionStatus | null = null;

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (cancelled) return;
        permStatus = result;
        setPermissionState(result.state as GeolocationPermission);
        result.onchange = () => {
          if (!cancelled) {
            setPermissionState(result.state as GeolocationPermission);
          }
        };
      })
      .catch(() => {
        // Permissions API unsupported in some WebViews/Safari
      });

    return () => {
      cancelled = true;
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, []);

  // Manual / on-demand high-accuracy location request
  const requestLocation = useCallback((): Promise<GpsSample | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unsupported');
        setError('Seu dispositivo ou navegador não suporta geolocalização.');
        resolve(null);
        return;
      }

      setIsLocating(true);
      setError(null);
      if (!lastAcceptedRef.current) {
        setStatus('locating');
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          setPermissionState('granted');
          const sample = processPosition(pos);
          resolve(sample);
        },
        (err) => {
          setIsLocating(false);
          handleGeolocationError(err);
          resolve(null);
        },
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: 0,
        }
      );
    });
  }, [enableHighAccuracy, timeoutMs, processPosition, handleGeolocationError]);

  // Continuous watchPosition + foreground/network recovery + signal-loss monitor
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      setError('Seu dispositivo ou navegador não suporta geolocalização.');
      return;
    }

    let watchId: number | null = null;
    let disposed = false;

    const triggerFreshFix = () => {
      if (disposed || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (disposed) return;
          setPermissionState('granted');
          processPosition(pos);
        },
        (err) => {
          if (disposed) return;
          handleGeolocationError(err);
        },
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: 3_000,
        }
      );
    };

    if (!lastAcceptedRef.current) {
      setStatus('locating');
    }
    triggerFreshFix();

    if (watch) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (disposed) return;
          setPermissionState('granted');
          processPosition(pos);
        },
        (err) => {
          if (disposed) return;
          handleGeolocationError(err);
        },
        {
          enableHighAccuracy,
          timeout: Math.max(timeoutMs, 15_000),
          maximumAge: 3_000,
        }
      );
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        triggerFreshFix();
      }
    };

    const handleOnline = () => {
      triggerFreshFix();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    const staleMonitor = watch
      ? setInterval(() => {
          if (disposed || !lastRawReceiveMsRef.current) return;
          const age = Date.now() - lastRawReceiveMsRef.current;
          if (age > staleThresholdMs) {
            setIsStale(true);
            setStatus((prev) => (prev === 'denied' ? prev : 'signal_lost'));
            setError('Sinal de GPS sem atualização recente. Tentando reconectar...');
            triggerFreshFix();
          }
        }, 10_000)
      : null;

    return () => {
      disposed = true;
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
      if (staleMonitor) {
        clearInterval(staleMonitor);
      }
    };
  }, [enabled, watch, enableHighAccuracy, timeoutMs, staleThresholdMs, processPosition, handleGeolocationError]);

  const isLowAccuracy = Boolean(
    position?.accuracy != null && position.accuracy > GPS_LOW_ACCURACY_WARNING_METERS
  );

  return {
    position,
    status,
    error,
    permissionState,
    isLocating,
    isLowAccuracy,
    isStale,
    requestLocation,
  };
}
