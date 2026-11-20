import React, { useState, useEffect, useRef, useCallback } from 'react';
import { mapsApi, PlacePrediction } from '../api/maps.js';
import {
  SAO_SEBASTIAO_BOUNDS,
  isValidCoordinate,
  validateOperationalPoint,
} from '../utils/geoNavigation.js';
import {
  MapPin,
  Navigation,
  Search,
  X,
  Loader2,
  Crosshair,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export interface PlaceAutocompleteInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onSelectPlace: (place: { address: string; lat: number; lng: number }) => void;
  onClear?: () => void;
  icon?: 'pickup' | 'destination';
  helperText?: string;
  className?: string;
  onUseCurrentLocation?: () => void;
  isLocating?: boolean;
  confirmed?: boolean;
  enforceOperationalArea?: boolean;
  compact?: boolean;
  externalError?: string | null;
}

export const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  onSelectPlace,
  onClear,
  icon = 'pickup',
  helperText,
  className = '',
  onUseCurrentLocation,
  isLocating = false,
  confirmed = false,
  enforceOperationalArea = true,
  compact = false,
  externalError = null,
}) => {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const autocompleteSeqRef = useRef<number>(0);
  const geocodeSeqRef = useRef<number>(0);
  const lastSelectedAddressRef = useRef<string>('');

  // Keep lastSelectedAddressRef aligned if parent confirms an address externally (e.g., GPS or map pin drag)
  useEffect(() => {
    if (confirmed && value.trim()) {
      lastSelectedAddressRef.current = value.trim();
      setGeocodeError(null);
    }
  }, [confirmed, value]);

  // Cleanup all timers and in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      autocompleteAbortRef.current?.abort();
      geocodeAbortRef.current?.abort();
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const validateAndCommitPlace = useCallback(
    (place: { address: string; lat: number; lng: number }): boolean => {
      if (!isValidCoordinate(place.lat, place.lng)) {
        setGeocodeError('Não foi possível obter coordenadas válidas para este endereço.');
        return false;
      }

      if (enforceOperationalArea) {
        const pointLabel = icon === 'pickup' ? 'O ponto de embarque' : 'O destino informado';
        const validation = validateOperationalPoint(place.lat, place.lng, pointLabel);
        if (!validation.valid) {
          setGeocodeError(
            validation.message ||
              'Este endereço está fora da área de atendimento do VaiCar (São Sebastião - SP).'
          );
          return false;
        }
      }

      lastSelectedAddressRef.current = place.address.trim();
      setGeocodeError(null);
      onChange(place.address);
      onSelectPlace(place);
      return true;
    },
    [enforceOperationalArea, icon, onChange, onSelectPlace]
  );

  const fetchBackendPredictions = useCallback(async (query: string, seq: number) => {
    autocompleteAbortRef.current?.abort();
    const controller = new AbortController();
    autocompleteAbortRef.current = controller;

    try {
      const results = await mapsApi.autocomplete(query, controller.signal);
      if (seq !== autocompleteSeqRef.current || controller.signal.aborted) return;
      setPredictions(results);
      setActiveIndex(-1);
      setIsOpen(true);
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (seq !== autocompleteSeqRef.current) return;
      setPredictions([]);
      setIsOpen(false);
    } finally {
      if (seq === autocompleteSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const fetchPredictions = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        autocompleteAbortRef.current?.abort();
        autocompleteSeqRef.current += 1;
        setPredictions([]);
        setIsOpen(false);
        setActiveIndex(-1);
        setLoading(false);
        return;
      }

      const seq = ++autocompleteSeqRef.current;
      setLoading(true);

      // 1. Prefer Google Places AutocompleteService in browser if configured, biased to São Sebastião
      if (typeof window !== 'undefined' && window.google?.maps?.places?.AutocompleteService) {
        try {
          const service = new window.google.maps.places.AutocompleteService();
          const sw = new window.google.maps.LatLng(
            SAO_SEBASTIAO_BOUNDS.minLat,
            SAO_SEBASTIAO_BOUNDS.minLng
          );
          const ne = new window.google.maps.LatLng(
            SAO_SEBASTIAO_BOUNDS.maxLat,
            SAO_SEBASTIAO_BOUNDS.maxLng
          );
          const bounds = new window.google.maps.LatLngBounds(sw, ne);

          service.getPlacePredictions(
            {
              input: trimmed,
              componentRestrictions: { country: 'br' },
              bounds,
            },
            (results, status) => {
              if (seq !== autocompleteSeqRef.current) return;
              if (
                status === window.google.maps.places.PlacesServiceStatus.OK &&
                Array.isArray(results) &&
                results.length > 0
              ) {
                const mapped: PlacePrediction[] = results.map((p) => ({
                  description: p.description,
                  placeId: p.place_id,
                  mainText: p.structured_formatting?.main_text || p.description,
                  secondaryText: p.structured_formatting?.secondary_text || '',
                  source: 'google',
                }));
                setLoading(false);
                setPredictions(mapped);
                setActiveIndex(-1);
                setIsOpen(true);
              } else {
                fetchBackendPredictions(trimmed, seq);
              }
            }
          );
          return;
        } catch {
          // Fall through to backend/OSM autocomplete
        }
      }

      // 2. Backend / São Sebastião-biased OSM Nominatim autocomplete
      fetchBackendPredictions(trimmed, seq);
    },
    [fetchBackendPredictions]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGeocodeError(null);
    onChange(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(val);
    }, 280);
  };

  const handleSelectPrediction = async (item: PlacePrediction) => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }

    setIsOpen(false);
    setActiveIndex(-1);
    setGeocodeError(null);

    if (typeof item.lat === 'number' && typeof item.lng === 'number' && isValidCoordinate(item.lat, item.lng)) {
      validateAndCommitPlace({
        address: item.description,
        lat: item.lat,
        lng: item.lng,
      });
      return;
    }

    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    const seq = ++geocodeSeqRef.current;

    onChange(item.description);
    setLoading(true);
    try {
      const geocoded = await mapsApi.geocode(item.description, controller.signal);
      if (seq !== geocodeSeqRef.current || controller.signal.aborted) return;
      validateAndCommitPlace(geocoded);
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (seq !== geocodeSeqRef.current) return;
      setGeocodeError(
        err?.message ||
          'Não foi possível localizar este endereço. Escolha uma sugestão válida ou ajuste o ponto no mapa.'
      );
    } finally {
      if (seq === geocodeSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const geocodeCurrentValue = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed === lastSelectedAddressRef.current && confirmed) return;

    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    const seq = ++geocodeSeqRef.current;

    setIsOpen(false);
    setActiveIndex(-1);
    setGeocodeError(null);
    setLoading(true);

    try {
      const geocoded = await mapsApi.geocode(trimmed, controller.signal);
      if (seq !== geocodeSeqRef.current || controller.signal.aborted) return;
      validateAndCommitPlace(geocoded);
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (seq !== geocodeSeqRef.current) return;
      setGeocodeError(
        err?.message ||
          'Endereço não encontrado em São Sebastião. Informe rua, número ou bairro, ou ajuste o ponto no mapa.'
      );
    } finally {
      if (seq === geocodeSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && isOpen && predictions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % predictions.length);
      return;
    }
    if (e.key === 'ArrowUp' && isOpen && predictions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? predictions.length - 1 : prev - 1));
      return;
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && predictions.length > 0) {
        const chosen = activeIndex >= 0 ? predictions[activeIndex] : predictions[0];
        handleSelectPrediction(chosen);
      } else if (value.trim().length >= 2) {
        geocodeCurrentValue(value);
      }
    }
  };

  const handleBlur = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
      const trimmed = value.trim();
      if (trimmed.length >= 3 && trimmed !== lastSelectedAddressRef.current && !confirmed) {
        geocodeCurrentValue(trimmed);
      }
    }, 240);
  };

  const handleClear = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    autocompleteAbortRef.current?.abort();
    geocodeAbortRef.current?.abort();
    lastSelectedAddressRef.current = '';
    setGeocodeError(null);
    onChange('');
    onClear?.();
    setPredictions([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const displayError = geocodeError || externalError;

  return (
    <div ref={containerRef} className={`relative space-y-1 ${className}`}>
      {!compact && (
        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            {icon === 'pickup' ? (
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="truncate">{label}</span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {onUseCurrentLocation && (
              <button
                type="button"
                onClick={onUseCurrentLocation}
                disabled={isLocating}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 hover:border-emerald-500 shadow-sm"
                title="Obter localização exata pelo GPS do seu dispositivo"
              >
                <Crosshair className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                {isLocating ? 'Obtendo GPS...' : 'Usar meu GPS'}
              </button>
            )}
            {loading && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                <Loader2 className="w-3 h-3 animate-spin text-emerald-400" /> Buscando...
              </span>
            )}
          </div>
        </label>
      )}

      <div className="relative flex items-center">
        {compact && (
          <span className="absolute left-3 pointer-events-none z-10">
            {icon === 'pickup' ? (
              <MapPin className="w-4 h-4 text-emerald-600" />
            ) : (
              <Navigation className="w-4 h-4 text-rose-500" />
            )}
          </span>
        )}

        <input
          type="text"
          value={value}
          aria-label={label}
          autoComplete="off"
          onChange={handleInputChange}
          onFocus={() => {
            if (predictions.length > 0) setIsOpen(true);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-slate-950 border ${
            displayError
              ? 'border-rose-500 focus:border-rose-400'
              : confirmed
                ? 'border-emerald-500/70 focus:border-emerald-400'
                : 'border-slate-800 focus:border-emerald-500'
          } rounded-xl ${compact ? 'pl-9 pr-16 py-3 text-sm' : 'pl-3 pr-14 py-2.5 text-xs'} text-white placeholder-slate-500 focus:outline-none transition-colors shadow-inner`}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {compact && onUseCurrentLocation && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onUseCurrentLocation}
              disabled={isLocating}
              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
              title="Usar minha localização GPS atual"
              aria-label="Usar minha localização GPS atual"
            >
              <Crosshair className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            </button>
          )}

          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 mr-1" />
          ) : confirmed && !displayError ? (
            <CheckCircle2
              className="w-3.5 h-3.5 text-emerald-400 shrink-0"
              aria-label="Endereço confirmado no mapa"
            />
          ) : null}

          {value ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              title="Limpar campo"
              aria-label="Limpar endereço"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Search className="w-3.5 h-3.5 text-slate-500 mr-1 pointer-events-none" />
          )}
        </div>
      </div>

      {displayError && (
        <span role="alert" className="text-[11px] text-rose-400 flex items-start gap-1 leading-tight pt-0.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{displayError}</span>
        </span>
      )}
      {!displayError && helperText && (
        <span className="text-[10px] text-slate-500 block leading-tight">{helperText}</span>
      )}

      {/* Predictive Autocomplete Dropdown */}
      {isOpen && (predictions.length > 0 || value.trim().length >= 2) && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800 max-h-64 overflow-y-auto"
        >
          {predictions.map((p, idx) => {
            const isOutOfArea = p.inOperationalArea === false;
            const isHighlighted = idx === activeIndex;
            return (
              <button
                key={p.placeId || `${p.description}-${idx}`}
                type="button"
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectPrediction(p);
                }}
                className={`w-full px-3.5 py-2.5 text-left text-xs transition-colors flex items-start gap-2.5 group ${
                  isHighlighted ? 'bg-slate-800' : 'hover:bg-slate-800/80'
                }`}
              >
                <div
                  className={`p-1 rounded-md bg-slate-950 shrink-0 mt-0.5 ${
                    isOutOfArea
                      ? 'text-amber-400'
                      : 'text-slate-400 group-hover:text-emerald-400'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white group-hover:text-emerald-300 truncate">
                      {p.mainText || p.description}
                    </span>
                    {isOutOfArea && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/60 font-bold shrink-0">
                        Fora de São Sebastião
                      </span>
                    )}
                  </div>
                  {p.secondaryText && (
                    <div className="text-[11px] text-slate-400 truncate">{p.secondaryText}</div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Search typed address directly via geocoding */}
          {value.trim().length >= 3 && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                geocodeCurrentValue(value);
              }}
              className="w-full px-3.5 py-2.5 text-left text-xs bg-slate-950/70 hover:bg-emerald-950/50 text-emerald-400 font-semibold flex items-center gap-2 transition-colors"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Buscar endereço: &ldquo;{value.trim()}&rdquo;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
