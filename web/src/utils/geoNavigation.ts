/**
 * VaiCar Next — Geographic Validation, GPS Filtering, Polyline Geometry & Rerouting Engine
 *
 * Pure, deterministic utilities shared across Passenger Dashboard, Driver Cockpit,
 * MapDisplay, PlaceAutocompleteInput, and HomePage.
 *
 * Operational area: Municipality of São Sebastião (Costa Sul, Centro, Costa Norte), SP.
 * Never fabricates coordinates or straight-line routes.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GpsSample extends GeoPoint {
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
  updatedAt: string;
}

export interface OperationalBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Default viewport center (Centro de São Sebastião - SP).
 * Used strictly for initial map framing — NEVER as a fake user/driver GPS position.
 */
export const SAO_SEBASTIAO_CENTER: GeoPoint = {
  lat: -23.8055,
  lng: -45.4011,
};

/**
 * Geographic bounds covering the municipality of São Sebastião (SP):
 * - West: Boracéia / Rio Guaratuba (~ -45.85)
 * - East: Canal de São Sebastião / Balsa / Ponta do Araçá (~ -45.375)
 * - South: Ponta de Toque-Toque / Guaecá (~ -23.86)
 * - North: Canto do Mar / Enseada / Rio Juqueriquerê (~ -23.685)
 *
 * Deliberately does NOT auto-expand to Ilhabela, Caraguatatuba, Bertioga,
 * Ubatuba, or São Paulo capital. Any expansion requires explicit authorization.
 */
export const SAO_SEBASTIAO_BOUNDS: OperationalBounds = {
  minLat: -23.875,
  maxLat: -23.685,
  minLng: -45.855,
  maxLng: -45.375,
};

export const GPS_FRESHNESS_MAX_AGE_MS = 60_000;
export const GPS_FUTURE_SKEW_TOLERANCE_MS = 10_000;
export const GPS_LOW_ACCURACY_WARNING_METERS = 80;
export const GPS_MAX_ACCEPTED_ACCURACY_METERS = 500;
export const GPS_OFF_ROUTE_MAX_ACCURACY_METERS = 100;

export const MIN_OFF_ROUTE_THRESHOLD_METERS = 45;
export const MAX_OFF_ROUTE_THRESHOLD_METERS = 120;
export const REROUTE_COOLDOWN_MS = 8_000;
export const PROGRESS_REFRESH_MIN_DISTANCE_METERS = 250;
export const PROGRESS_REFRESH_MIN_INTERVAL_MS = 20_000;

export const DRIVER_TRANSMIT_MIN_INTERVAL_MS = 3_000;
export const DRIVER_TRANSMIT_MIN_DISTANCE_METERS = 10;
export const DRIVER_TRANSMIT_HEARTBEAT_MS = 18_000;

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Validates that lat/lng are finite numbers within WGS-84 range and not Null Island (0, 0).
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (Math.abs(lat) < 1e-7 && Math.abs(lng) < 1e-7) return false;
  return true;
}

/**
 * Checks whether a coordinate falls within the São Sebastião operational coverage area.
 */
export function isWithinOperationalArea(
  lat: number,
  lng: number,
  bounds: OperationalBounds = SAO_SEBASTIAO_BOUNDS
): boolean {
  if (!isValidCoordinate(lat, lng)) return false;
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

export interface OperationalValidationResult {
  valid: boolean;
  code?: 'INVALID_COORDS' | 'OUT_OF_AREA';
  message?: string;
}

/**
 * Validates a geographic point for VaiCar operations in São Sebastião.
 */
export function validateOperationalPoint(
  lat: number,
  lng: number,
  pointLabel = 'Este endereço'
): OperationalValidationResult {
  if (!isValidCoordinate(lat, lng)) {
    return {
      valid: false,
      code: 'INVALID_COORDS',
      message: `${pointLabel} possui coordenadas inválidas. Selecione uma sugestão válida ou ajuste o pino no mapa.`,
    };
  }

  if (!isWithinOperationalArea(lat, lng)) {
    return {
      valid: false,
      code: 'OUT_OF_AREA',
      message: `${pointLabel} está fora da área operacional do VaiCar (São Sebastião — Costa Sul, Centro e Costa Norte).`,
    };
  }

  return { valid: true };
}

/**
 * Checks if a user's free-text query already mentions an explicit municipality or state.
 * If not, returns a query biased toward São Sebastião, SP so local streets resolve accurately
 * while still allowing out-of-area cities explicitly typed by the user to resolve and be rejected clearly.
 */
const EXPLICIT_CITY_OR_STATE_PATTERN =
  /\b(s[aã]o\s+sebasti[aã]o|ilhabela|caraguatatuba|ubatuba|bertioga|santos|guaruj[aá]|s[aã]o\s+paulo|campinas|s[aã]o\s+jos[eé]\s+dos\s+campos|taubat[eé]|rio\s+de\s+janeiro|curitiba|belo\s+horizonte|minas\s+gerais|paraty|rj|mg|pr|sc|rs|ba|df|go|ce|pe|es)\b/i;

export function buildBiasedAddressQuery(rawQuery: string): string {
  const trimmed = rawQuery.trim();
  if (!trimmed) return '';
  if (EXPLICIT_CITY_OR_STATE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}, São Sebastião, SP`;
}

/**
 * Haversine distance in meters between two WGS-84 points.
 */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  return Math.round((haversineDistanceMeters(a, b) / 1000) * 10) / 10;
}

/**
 * Safely decodes a Google / OSRM encoded polyline (precision 1e5) into [lat, lng] tuples.
 * Returns [] if the string is empty, malformed, or contains out-of-range coordinates.
 */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded || typeof encoded !== 'string') return [];
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      if (index >= len) return [];
      b = encoded.charCodeAt(index++) - 63;
      if (b < 0) return [];
      result |= (b & 0x1f) << shift;
      shift += 5;
      if (shift > 35) return [];
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      if (index >= len) return [];
      b = encoded.charCodeAt(index++) - 63;
      if (b < 0) return [];
      result |= (b & 0x1f) << shift;
      shift += 5;
      if (shift > 35) return [];
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    const decodedLat = lat / 1e5;
    const decodedLng = lng / 1e5;
    if (!isValidCoordinate(decodedLat, decodedLng)) {
      return [];
    }
    points.push([decodedLat, decodedLng]);
  }

  return points;
}

/**
 * Computes total length of a polyline in meters.
 */
export function calculatePolylineDistanceMeters(coords: [number, number][]): number {
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistanceMeters(
      { lat: coords[i - 1][0], lng: coords[i - 1][1] },
      { lat: coords[i][0], lng: coords[i][1] }
    );
  }
  return total;
}

/**
 * Perpendicular distance from a point to a line segment [segStart, segEnd] in meters,
 * using local equirectangular tangent-plane projection (sub-meter accuracy at urban scales).
 */
export function distancePointToSegmentMeters(
  point: GeoPoint,
  segStart: GeoPoint,
  segEnd: GeoPoint
): { distanceMeters: number; projected: GeoPoint; t: number } {
  const refLatRad = (point.lat * Math.PI) / 180;
  const metersPerDegLat = 111_132.92;
  const metersPerDegLng = 111_412.84 * Math.cos(refLatRad);

  const ax = (segStart.lng - point.lng) * metersPerDegLng;
  const ay = (segStart.lat - point.lat) * metersPerDegLat;
  const bx = (segEnd.lng - point.lng) * metersPerDegLng;
  const by = (segEnd.lat - point.lat) * metersPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 1e-9) {
    t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
  }

  const px = ax + t * dx;
  const py = ay + t * dy;
  const distanceMeters = Math.hypot(px, py);

  const projected: GeoPoint = {
    lat: segStart.lat + t * (segEnd.lat - segStart.lat),
    lng: segStart.lng + t * (segEnd.lng - segStart.lng),
  };

  return { distanceMeters, projected, t };
}

export interface PolylineMatch {
  distanceMeters: number;
  segmentIndex: number;
  projectedPoint: GeoPoint;
  remainingDistanceMeters: number;
  totalDistanceMeters: number;
}

/**
 * Projects a GPS point onto the closest segment of a route polyline and calculates
 * both perpendicular deviation and remaining road distance to the route end.
 */
export function findNearestPointOnPolyline(
  point: GeoPoint,
  polyline: [number, number][]
): PolylineMatch | null {
  if (!Array.isArray(polyline) || polyline.length < 2 || !isValidCoordinate(point.lat, point.lng)) {
    return null;
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestSegmentIndex = 0;
  let bestProjected: GeoPoint = { lat: polyline[0][0], lng: polyline[0][1] };

  const segmentLengths: number[] = new Array(polyline.length - 1);
  let totalDistanceMeters = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const start: GeoPoint = { lat: polyline[i][0], lng: polyline[i][1] };
    const end: GeoPoint = { lat: polyline[i + 1][0], lng: polyline[i + 1][1] };
    const segLen = haversineDistanceMeters(start, end);
    segmentLengths[i] = segLen;
    totalDistanceMeters += segLen;

    const match = distancePointToSegmentMeters(point, start, end);
    if (match.distanceMeters < bestDistance) {
      bestDistance = match.distanceMeters;
      bestSegmentIndex = i;
      bestProjected = match.projected;
    }
  }

  let remainingDistanceMeters = haversineDistanceMeters(bestProjected, {
    lat: polyline[bestSegmentIndex + 1][0],
    lng: polyline[bestSegmentIndex + 1][1],
  });
  for (let i = bestSegmentIndex + 1; i < segmentLengths.length; i++) {
    remainingDistanceMeters += segmentLengths[i];
  }

  return {
    distanceMeters: bestDistance,
    segmentIndex: bestSegmentIndex,
    projectedPoint: bestProjected,
    remainingDistanceMeters,
    totalDistanceMeters,
  };
}

/**
 * Trims the traversed portion of an active route polyline so the rendered line starts
 * at the driver's snapped position and continues cleanly to the original destination.
 */
export function trimPolylineFromPosition(
  point: GeoPoint,
  polyline: [number, number][]
): { coords: [number, number][]; remainingDistanceMeters: number; deviationMeters: number } | null {
  const nearest = findNearestPointOnPolyline(point, polyline);
  if (!nearest) return null;

  const trimmed: [number, number][] = [
    [nearest.projectedPoint.lat, nearest.projectedPoint.lng],
    ...polyline.slice(nearest.segmentIndex + 1),
  ];

  return {
    coords: trimmed.length >= 2 ? trimmed : polyline,
    remainingDistanceMeters: nearest.remainingDistanceMeters,
    deviationMeters: nearest.distanceMeters,
  };
}

export interface RecalculationDecision {
  shouldRecalculate: boolean;
  reason: 'initial' | 'destination_changed' | 'off_route' | 'periodic_progress_refresh' | 'none';
  deviationMeters?: number;
  thresholdMeters?: number;
}

/**
 * Decides whether a new road route should be fetched from the routing engine.
 * - Tolerates normal GPS noise and poor accuracy readings without flapping.
 * - Triggers automatic rerouting on significant deviation from the active route.
 * - Never changes the confirmed destination.
 */
export function shouldRecalculateRoute(params: {
  currentPos: GeoPoint;
  currentAccuracyMeters?: number | null;
  activePolyline: [number, number][] | null;
  lastRouteOrigin: GeoPoint | null;
  target: GeoPoint;
  lastRouteTarget: GeoPoint | null;
  lastCalculatedAtMs: number;
  nowMs?: number;
}): RecalculationDecision {
  const {
    currentPos,
    currentAccuracyMeters,
    activePolyline,
    lastRouteOrigin,
    target,
    lastRouteTarget,
    lastCalculatedAtMs,
    nowMs = Date.now(),
  } = params;

  if (!activePolyline || activePolyline.length < 2 || !lastRouteOrigin || !lastRouteTarget) {
    return { shouldRecalculate: true, reason: 'initial' };
  }

  if (haversineDistanceMeters(target, lastRouteTarget) > 10) {
    return { shouldRecalculate: true, reason: 'destination_changed' };
  }

  const nearest = findNearestPointOnPolyline(currentPos, activePolyline);
  if (!nearest) {
    return { shouldRecalculate: true, reason: 'initial' };
  }

  const accuracy =
    typeof currentAccuracyMeters === 'number' && Number.isFinite(currentAccuracyMeters) && currentAccuracyMeters > 0
      ? currentAccuracyMeters
      : 15;

  const thresholdMeters = Math.max(
    MIN_OFF_ROUTE_THRESHOLD_METERS,
    Math.min(MAX_OFF_ROUTE_THRESHOLD_METERS, 35 + Math.min(accuracy, 65))
  );

  const elapsedMs = nowMs - lastCalculatedAtMs;

  // Do not trigger off-route rerouting on severely degraded GPS accuracy (> 100m)
  if (accuracy <= GPS_OFF_ROUTE_MAX_ACCURACY_METERS && nearest.distanceMeters > thresholdMeters) {
    if (elapsedMs >= REROUTE_COOLDOWN_MS) {
      return {
        shouldRecalculate: true,
        reason: 'off_route',
        deviationMeters: Math.round(nearest.distanceMeters),
        thresholdMeters: Math.round(thresholdMeters),
      };
    }
  }

  // Periodic refresh as the driver advances substantially along the route (keeps ETA accurate)
  const movedFromLastOrigin = haversineDistanceMeters(currentPos, lastRouteOrigin);
  if (
    movedFromLastOrigin >= PROGRESS_REFRESH_MIN_DISTANCE_METERS &&
    elapsedMs >= PROGRESS_REFRESH_MIN_INTERVAL_MS
  ) {
    return {
      shouldRecalculate: true,
      reason: 'periodic_progress_refresh',
      deviationMeters: Math.round(nearest.distanceMeters),
      thresholdMeters: Math.round(thresholdMeters),
    };
  }

  return {
    shouldRecalculate: false,
    reason: 'none',
    deviationMeters: Math.round(nearest.distanceMeters),
    thresholdMeters: Math.round(thresholdMeters),
  };
}

/**
 * Checks if a GPS timestamp string is fresh (<= maxAgeMs old and not far in the future).
 */
export function isGpsFresh(
  updatedAt?: string | null,
  nowMs: number = Date.now(),
  maxAgeMs: number = GPS_FRESHNESS_MAX_AGE_MS
): boolean {
  if (!updatedAt) return false;
  const parsed = new Date(updatedAt).getTime();
  if (!Number.isFinite(parsed)) return false;
  const age = nowMs - parsed;
  return age >= -GPS_FUTURE_SKEW_TOLERANCE_MS && age <= maxAgeMs;
}

export interface GpsFilterResult {
  accepted: boolean;
  sample?: GpsSample;
  reason?: 'invalid_coords' | 'stale_timestamp' | 'poor_accuracy' | 'teleport_jump' | 'micro_jitter';
}

/**
 * Filters raw device GPS fixes to eliminate invalid coordinates, stale fixes,
 * impossible teleportation spikes, and stationary jitter while preserving real motion.
 */
export function filterGpsSample(previous: GpsSample | null, incoming: GpsSample): GpsFilterResult {
  if (!isValidCoordinate(incoming.lat, incoming.lng)) {
    return { accepted: false, reason: 'invalid_coords' };
  }

  const incomingAccuracy =
    typeof incoming.accuracy === 'number' && Number.isFinite(incoming.accuracy) && incoming.accuracy >= 0
      ? incoming.accuracy
      : null;

  if (!previous) {
    if (incomingAccuracy !== null && incomingAccuracy > 2000) {
      return { accepted: false, reason: 'poor_accuracy' };
    }
    return { accepted: true, sample: incoming };
  }

  if (incoming.timestamp < previous.timestamp) {
    return { accepted: false, reason: 'stale_timestamp' };
  }

  const prevAccuracy =
    typeof previous.accuracy === 'number' && Number.isFinite(previous.accuracy) && previous.accuracy >= 0
      ? previous.accuracy
      : 30;

  // Reject wildly inaccurate fix when we already hold a precise recent fix
  if (
    incomingAccuracy !== null &&
    incomingAccuracy > GPS_MAX_ACCEPTED_ACCURACY_METERS &&
    prevAccuracy <= 100 &&
    incoming.timestamp - previous.timestamp < 30_000
  ) {
    return { accepted: false, reason: 'poor_accuracy' };
  }

  const distanceMeters = haversineDistanceMeters(previous, incoming);
  const dtSeconds = Math.max(0.1, (incoming.timestamp - previous.timestamp) / 1000);
  const impliedSpeedMps = distanceMeters / dtSeconds;

  // Reject impossible single-tick teleport jumps (e.g. > 200 km/h with weak accuracy or instant jump)
  if (
    (impliedSpeedMps > 55 && (incomingAccuracy === null || incomingAccuracy > 35)) ||
    (dtSeconds < 2 && distanceMeters > 300)
  ) {
    return { accepted: false, reason: 'teleport_jump' };
  }

  // Suppress micro-jitter while vehicle/user is stationary, unless accuracy improved significantly
  const jitterFloorMeters = Math.max(4, Math.min(12, (incomingAccuracy ?? 15) * 0.35));
  const accuracyImprovedMuch =
    incomingAccuracy !== null && prevAccuracy - incomingAccuracy >= 20;

  if (distanceMeters < jitterFloorMeters && !accuracyImprovedMuch) {
    // Still refresh timestamp if > 15s elapsed so freshness heartbeat stays alive without moving the pin
    if (incoming.timestamp - previous.timestamp >= 15_000) {
      return {
        accepted: true,
        sample: {
          ...previous,
          accuracy: incomingAccuracy ?? previous.accuracy,
          timestamp: incoming.timestamp,
          updatedAt: incoming.updatedAt,
        },
      };
    }
    return { accepted: false, reason: 'micro_jitter' };
  }

  return { accepted: true, sample: incoming };
}

/**
 * Throttling policy for driver GPS transmission to backend:
 * avoids excessive requests/battery drain while guaranteeing freshness (< 60s).
 */
export function shouldTransmitDriverLocation(
  lastSent: { lat: number; lng: number; sentAtMs: number } | null,
  current: GeoPoint,
  nowMs: number = Date.now()
): boolean {
  if (!isValidCoordinate(current.lat, current.lng)) return false;
  if (!lastSent) return true;

  const elapsedMs = nowMs - lastSent.sentAtMs;
  if (elapsedMs >= DRIVER_TRANSMIT_HEARTBEAT_MS) return true;
  if (elapsedMs < DRIVER_TRANSMIT_MIN_INTERVAL_MS) return false;

  return haversineDistanceMeters(lastSent, current) >= DRIVER_TRANSMIT_MIN_DISTANCE_METERS;
}

/**
 * Formats relative time in Portuguese for telemetry freshness badges.
 */
export function formatTelemetryAge(updatedAt?: string | null, nowMs: number = Date.now()): string {
  if (!updatedAt) return 'sem atualização';
  const parsed = new Date(updatedAt).getTime();
  if (!Number.isFinite(parsed)) return 'sem atualização';
  const seconds = Math.max(0, Math.floor((nowMs - parsed) / 1000));
  if (seconds < 10) return 'agora mesmo';
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `há ${minutes} min`;
}

/**
 * Escapes untrusted strings before rendering inside Leaflet HTML templates (divIcon, tooltip, popup).
 */
export function escapeHtml(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
