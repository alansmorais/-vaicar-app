import React, { useState, useEffect, useRef, useCallback } from 'react';
import { mapsApi, PlacePrediction } from '../api/maps.js';
import { MapPin, Navigation, Search, X, Loader2, Crosshair } from 'lucide-react';

interface PlaceAutocompleteInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onSelectPlace: (place: { address: string; lat: number; lng: number }) => void;
  icon?: 'pickup' | 'destination';
  helperText?: string;
  className?: string;
  onUseCurrentLocation?: () => void;
  isLocating?: boolean;
}

export const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  onSelectPlace,
  icon = 'pickup',
  helperText,
  className = '',
  onUseCurrentLocation,
  isLocating = false,
}) => {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch predictions with debounce
  const fetchPredictions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setPredictions([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Try Google Places AutocompleteService in browser if available
    if (window.google?.maps?.places?.AutocompleteService) {
      try {
        const service = new window.google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          {
            input: query,
            componentRestrictions: { country: 'br' },
          },
          (results, status) => {
            setLoading(false);
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
              const mapped: PlacePrediction[] = results.map((p) => ({
                description: p.description,
                placeId: p.place_id,
                mainText: p.structured_formatting?.main_text || p.description,
                secondaryText: p.structured_formatting?.secondary_text || '',
              }));
              setPredictions(mapped);
              setIsOpen(true);
            } else {
              // Fallback to backend autocomplete
              fetchBackendPredictions(query);
            }
          }
        );
        return;
      } catch (err) {
        console.warn('Browser AutocompleteService warning:', err);
      }
    }

    // 2. Fallback to backend autocomplete API
    fetchBackendPredictions(query);
  }, []);

  const lastSelectedAddressRef = useRef<string>('');

  const fetchBackendPredictions = async (query: string) => {
    try {
      const results = await mapsApi.autocomplete(query);
      setPredictions(results);
      setIsOpen(results.length > 0);
    } catch {
      setPredictions([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(val);
    }, 280);
  };

  const handleSelectPrediction = async (item: PlacePrediction) => {
    setIsOpen(false);
    lastSelectedAddressRef.current = item.description;
    onChange(item.description);

    if (item.lat && item.lng) {
      onSelectPlace({ address: item.description, lat: item.lat, lng: item.lng });
      return;
    }

    setLoading(true);
    try {
      // Geocode to coordinates
      const geocoded = await mapsApi.geocode(item.description);
      lastSelectedAddressRef.current = geocoded.address;
      onSelectPlace(geocoded);
    } catch (err) {
      console.error('Failed to geocode selected prediction:', err);
    } finally {
      setLoading(false);
    }
  };

  const geocodeCurrentValue = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed === lastSelectedAddressRef.current) return;
    setIsOpen(false);
    setLoading(true);
    try {
      const geocoded = await mapsApi.geocode(trimmed);
      lastSelectedAddressRef.current = geocoded.address;
      onChange(geocoded.address);
      onSelectPlace(geocoded);
    } catch (err) {
      console.warn('Geocoding fallback notice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (predictions.length > 0 && isOpen) {
        handleSelectPrediction(predictions[0]);
      } else if (value.trim()) {
        geocodeCurrentValue(value);
      }
    }
  };

  const handleBlur = () => {
    // Give time for prediction click to register
    setTimeout(() => {
      if (value.trim() && value.trim() !== lastSelectedAddressRef.current) {
        geocodeCurrentValue(value);
      }
    }, 250);
  };

  const handleClear = () => {
    lastSelectedAddressRef.current = '';
    onChange('');
    setPredictions([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative space-y-1 ${className}`}>
      <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          {icon === 'pickup' ? (
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-rose-400" />
          )}
          {label}
        </span>
        <div className="flex items-center gap-2">
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

      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (predictions.length > 0) setIsOpen(true);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
        />

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            title="Limpar campo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Search className="w-3.5 h-3.5 text-slate-600 absolute right-3 pointer-events-none" />
        )}
      </div>

      {helperText && <span className="text-[10px] text-slate-500 block leading-tight">{helperText}</span>}

      {/* Predictive Autocomplete Dropdown */}
      {isOpen && (predictions.length > 0 || value.trim().length >= 2) && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800 max-h-60 overflow-y-auto">
          {/* Quick manual selection chip */}
          {value.trim().length >= 2 && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                geocodeCurrentValue(value);
              }}
              className="w-full px-3.5 py-2 text-left text-xs bg-slate-950/70 hover:bg-emerald-950/50 text-emerald-300 font-semibold flex items-center gap-2 transition-colors border-b border-slate-800"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Usar endereço digitado: &ldquo;{value.trim()}&rdquo;</span>
            </button>
          )}

          {predictions.map((p, idx) => (
            <button
              key={p.placeId || `${p.description}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectPrediction(p);
              }}
              className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 group"
            >
              <div className="p-1 rounded-md bg-slate-950 text-slate-400 group-hover:text-emerald-400 shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 truncate">
                <div className="font-semibold text-white group-hover:text-emerald-300 truncate">
                  {p.mainText || p.description}
                </div>
                {p.secondaryText && (
                  <div className="text-[11px] text-slate-400 truncate">{p.secondaryText}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
