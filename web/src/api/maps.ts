import { apiFetch, getAuthToken, resolveApiUrl } from './client.js';
import {
  SAO_SEBASTIAO_BOUNDS,
  buildBiasedAddressQuery,
  decodePolyline,
  isValidCoordinate,
  isWithinOperationalArea,
} from '../utils/geoNavigation.js';

export interface KnownLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface PlacePrediction {
  description: string;
  placeId?: string;
  mainText?: string;
  secondaryText?: string;
  lat?: number;
  lng?: number;
  inOperationalArea?: boolean;
  source?: 'google' | 'osm' | 'backend';
}

export interface DirectionsStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver?: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

export interface DrivingRouteResult {
  distanceKm: number;
  durationMin: number;
  encodedPolyline: string;
  coords: [number, number][];
  summary?: string;
  steps?: DirectionsStep[];
  provider: 'server' | 'osrm';
}

function formatOsmShortAddress(item: any): { description: string; mainText: string; secondaryText: string } {
  const display = typeof item?.display_name === 'string' ? item.display_name : '';
  const a = item?.address;
  if (a && typeof a === 'object') {
    const road = a.road || a.pedestrian || a.footway || a.highway || '';
    const number = a.house_number ? `, ${a.house_number}` : '';
    const placeName = item?.name && item.name !== road ? item.name : '';
    const suburb = a.suburb || a.neighbourhood || a.quarter || a.village || '';
    const city = a.city || a.town || a.municipality || '';
    const state = a['ISO3166-2-lvl4']?.split('-')[1] || a.state || '';

    const primary = placeName
      ? (road ? `${placeName} — ${road}${number}` : placeName)
      : (road ? `${road}${number}` : suburb || display.split(',')[0]?.trim() || '');

    const secondaryParts = [suburb && suburb !== primary ? suburb : '', city, state].filter(Boolean);
    const secondary = secondaryParts.join(', ');
    const full = secondary ? `${primary}, ${secondary}` : primary || display;
    return {
      description: full,
      mainText: primary || display,
      secondaryText: secondary,
    };
  }

  const parts = display.split(',').map((p: string) => p.trim()).filter(Boolean);
  return {
    description: parts.slice(0, 4).join(', '),
    mainText: parts[0] || display,
    secondaryText: parts.slice(1, 4).join(', '),
  };
}

/**
 * Direct OpenStreetMap Nominatim search prioritized for São Sebastião / Litoral Norte SP.
 * Used to supplement autocomplete when backend results are sparse or synthetic.
 */
async function searchNominatimAddresses(
  query: string,
  signal?: AbortSignal
): Promise<PlacePrediction[]> {
  const viewbox = `${SAO_SEBASTIAO_BOUNDS.minLng},${SAO_SEBASTIAO_BOUNDS.maxLat},${SAO_SEBASTIAO_BOUNDS.maxLng},${SAO_SEBASTIAO_BOUNDS.minLat}`;
  const biased = buildBiasedAddressQuery(query);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    biased
  )}&countrycodes=br&viewbox=${viewbox}&limit=6&addressdetails=1&accept-language=pt-BR`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];

  return data
    .map((item: any): PlacePrediction | null => {
      const lat = Number.parseFloat(item?.lat);
      const lng = Number.parseFloat(item?.lon);
      if (!isValidCoordinate(lat, lng)) return null;
      const formatted = formatOsmShortAddress(item);
      return {
        description: formatted.description,
        placeId: `osm-${item.place_id || item.osm_id || `${lat}-${lng}`}`,
        mainText: formatted.mainText,
        secondaryText: formatted.secondaryText,
        lat,
        lng,
        inOperationalArea: isWithinOperationalArea(lat, lng),
        source: 'osm',
      };
    })
    .filter((item): item is PlacePrediction => item !== null);
}

export const mapsApi = {
  /**
   * Preserved only for backwards-compatibility with legacy API clients/tests.
   * Do not use for ride request destination selection.
   */
  getPopularPlaces: () => apiFetch<KnownLocation[]>('/maps/popular-places'),

  getConfig: () =>
    apiFetch<{ defaultCenter: { lat: number; lng: number }; defaultZoom: number; hasKey: boolean }>('/maps/config'),

  geocode: async (
    address: string,
    signal?: AbortSignal
  ): Promise<{ address: string; lat: number; lng: number }> => {
    const biasedQuery = buildBiasedAddressQuery(address);
    const res = await apiFetch<{ address: string; lat: number; lng: number }>('/maps/geocode', {
      method: 'POST',
      body: JSON.stringify({ address: biasedQuery }),
      signal,
    });

    if (!res || !isValidCoordinate(res.lat, res.lng)) {
      throw new Error('Não foi possível obter coordenadas válidas para este endereço.');
    }
    return {
      address: res.address,
      lat: res.lat,
      lng: res.lng,
    };
  },

  reverseGeocode: (lat: number, lng: number, signal?: AbortSignal) =>
    apiFetch<{ address: string; lat: number; lng: number }>('/maps/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
      signal,
    }),

  autocomplete: async (input: string, signal?: AbortSignal): Promise<PlacePrediction[]> => {
    const trimmed = input.trim();
    if (trimmed.length < 2) return [];

    const biased = buildBiasedAddressQuery(trimmed);
    let backendResults: PlacePrediction[] = [];

    try {
      const payload = await apiFetch<PlacePrediction[]>('/maps/autocomplete', {
        method: 'POST',
        body: JSON.stringify({ input: biased }),
        signal,
      });

      const raw = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as any)?.predictions)
          ? (payload as any).predictions
          : Array.isArray((payload as any)?.suggestions)
            ? (payload as any).suggestions
            : [];

      // Filter out backend's hardcoded KNOWN_LOCATIONS ("loc-*") and unverified free-text ("custom-*")
      // so the passenger never gets locked into predefined beach/hospital lists.
      backendResults = raw
        .filter((item: PlacePrediction) => {
          const id = item?.placeId || '';
          return !id.startsWith('loc-') && !id.startsWith('custom-');
        })
        .map((item: PlacePrediction) => ({
          ...item,
          inOperationalArea:
            typeof item.lat === 'number' && typeof item.lng === 'number'
              ? isWithinOperationalArea(item.lat, item.lng)
              : undefined,
          source: 'backend' as const,
        }));
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }

    if (backendResults.length > 0) {
      // Prioritize results inside São Sebastião operational area first
      return backendResults.sort((a, b) => {
        const aIn = a.inOperationalArea === true ? 1 : a.inOperationalArea === false ? -1 : 0;
        const bIn = b.inOperationalArea === true ? 1 : b.inOperationalArea === false ? -1 : 0;
        return bIn - aIn;
      });
    }

    // Fallback to direct Nominatim geocoding biased to São Sebastião viewbox
    try {
      const osmResults = await searchNominatimAddresses(trimmed, signal);
      return osmResults.sort((a, b) => {
        const aIn = a.inOperationalArea ? 1 : 0;
        const bIn = b.inOperationalArea ? 1 : 0;
        return bIn - aIn;
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return [];
    }
  },

  /**
   * Calculates a real driving route via the backend (/api/v1/maps/directions — Google Directions / OSRM),
   * tolerating both wrapped ({ success: true, data }) and raw JSON ({ distanceKm, durationMin, encodedPolyline })
   * responses from the existing backend contract.
   *
   * Never returns a straight-line fallback: throws if no real road geometry is available.
   */
  getDirections: async (
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    signal?: AbortSignal
  ): Promise<DrivingRouteResult> => {
    if (!isValidCoordinate(originLat, originLng) || !isValidCoordinate(destLat, destLng)) {
      throw new Error('Coordenadas inválidas para cálculo de rota.');
    }

    const endpoint = `/maps/directions?originLat=${encodeURIComponent(originLat)}&originLng=${encodeURIComponent(
      originLng
    )}&destLat=${encodeURIComponent(destLat)}&destLng=${encodeURIComponent(destLng)}`;
    const url = resolveApiUrl(endpoint);
    const token = getAuthToken();

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // 1. Authoritative backend routing service (Google Directions or backend OSRM)
    try {
      const response = await fetch(url, { method: 'GET', headers, signal });
      if (response.ok) {
        const raw = (await response.json()) as any;
        const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;

        if (payload && !payload.fallback && typeof payload.encodedPolyline === 'string' && payload.encodedPolyline.length > 0) {
          const coords = decodePolyline(payload.encodedPolyline);
          if (coords.length >= 2) {
            return {
              distanceKm: Number(payload.distanceKm) || 0,
              durationMin: Math.max(1, Math.round(Number(payload.durationMin) || 1)),
              encodedPolyline: payload.encodedPolyline,
              coords,
              summary: payload.summary || '',
              steps: Array.isArray(payload.steps) ? payload.steps : [],
              provider: 'server',
            };
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        throw err;
      }
    }

    // 2. Real road-routing fallback via OSRM (only if real driving geometry is returned — NEVER straight line)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(osrmUrl, {
      method: 'GET',
      signal,
    });

    if (!osrmRes.ok) {
      throw new Error('Serviço de rotas viárias indisponível no momento.');
    }

    const osrmData = (await osrmRes.json()) as any;
    const route = Array.isArray(osrmData?.routes) ? osrmData.routes[0] : null;
    const rawCoords = route?.geometry?.coordinates;

    if (!route || !Array.isArray(rawCoords) || rawCoords.length < 2) {
      throw new Error('Não foi possível encontrar uma rota viária válida entre os pontos informados.');
    }

    const coords: [number, number][] = rawCoords
      .filter(
        (c: unknown) =>
          Array.isArray(c) &&
          c.length >= 2 &&
          isValidCoordinate(Number(c[1]), Number(c[0]))
      )
      .map((c: [number, number]) => [Number(c[1]), Number(c[0])]);

    if (coords.length < 2) {
      throw new Error('A geometria da rota retornada é inválida.');
    }

    return {
      distanceKm: Math.round(((Number(route.distance) || 0) / 1000) * 10) / 10,
      durationMin: Math.max(1, Math.round((Number(route.duration) || 60) / 60)),
      encodedPolyline: '',
      coords,
      summary: route.legs?.[0]?.summary || '',
      steps: [],
      provider: 'osrm',
    };
  },
};
