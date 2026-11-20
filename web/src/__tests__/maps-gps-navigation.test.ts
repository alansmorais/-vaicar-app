import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SAO_SEBASTIAO_BOUNDS,
  SAO_SEBASTIAO_CENTER,
  GPS_FRESHNESS_MAX_AGE_MS,
  GPS_LOW_ACCURACY_WARNING_METERS,
  buildBiasedAddressQuery,
  calculatePolylineDistanceMeters,
  decodePolyline,
  escapeHtml,
  filterGpsSample,
  findNearestPointOnPolyline,
  formatTelemetryAge,
  haversineDistanceMeters,
  isGpsFresh,
  isValidCoordinate,
  isWithinOperationalArea,
  shouldRecalculateRoute,
  shouldTransmitDriverLocation,
  trimPolylineFromPosition,
  validateOperationalPoint,
  type GpsSample,
} from '../utils/geoNavigation.js';
import { mapsApi } from '../api/maps.js';
import { ridesApi } from '../api/rides.js';

// Helper to encode [lat, lng][] into Google/OSRM polyline5 format for deterministic tests
function encodePolyline(points: [number, number][]): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = '';

  const encodeValue = (v: number) => {
    let shifted = v < 0 ? ~(v << 1) : v << 1;
    let out = '';
    while (shifted >= 0x20) {
      out += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
      shifted >>= 5;
    }
    out += String.fromCharCode(shifted + 63);
    return out;
  };

  for (const [lat, lng] of points) {
    const eLat = Math.round(lat * 1e5);
    const eLng = Math.round(lng * 1e5);
    result += encodeValue(eLat - lastLat);
    result += encodeValue(eLng - lastLng);
    lastLat = eLat;
    lastLng = eLng;
  }
  return result;
}

describe('VaiCar Next — Maps, GPS, Operational Area, Routing & Sync Audit Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Coordinate & Operational Area Validation (São Sebastião - SP)', () => {
    it('accepts valid coordinates and rejects NaN, Infinity, out-of-range, and Null Island (0,0)', () => {
      expect(isValidCoordinate(-23.8055, -45.4011)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(false);
      expect(isValidCoordinate(Number.NaN, -45.4)).toBe(false);
      expect(isValidCoordinate(-23.8, Number.POSITIVE_INFINITY)).toBe(false);
      expect(isValidCoordinate(-91, -45.4)).toBe(false);
      expect(isValidCoordinate(-23.8, -181)).toBe(false);
      expect(isValidCoordinate(undefined, -45.4)).toBe(false);
    });

    it('covers the full municipality of São Sebastião (Costa Sul, Centro e Costa Norte) without relying on a single center point', () => {
      const saoSebastiaoDistricts = [
        { name: 'Boracéia', lat: -23.7512, lng: -45.8234 },
        { name: 'Barra do Una', lat: -23.7589, lng: -45.7612 },
        { name: 'Juquehy', lat: -23.7661, lng: -45.7275 },
        { name: 'Barra do Sahy', lat: -23.7702, lng: -45.6888 },
        { name: 'Praia da Baleia', lat: -23.7789, lng: -45.6698 },
        { name: 'Cambury', lat: -23.7744, lng: -45.6492 },
        { name: 'Boiçucanga', lat: -23.7842, lng: -45.6175 },
        { name: 'Maresias', lat: -23.7915, lng: -45.5683 },
        { name: 'Paúba', lat: -23.8012, lng: -45.5512 },
        { name: 'Toque-Toque Pequeno', lat: -23.8298, lng: -45.5342 },
        { name: 'Toque-Toque Grande', lat: -23.8345, lng: -45.5123 },
        { name: 'Guaecá', lat: -23.8291, lng: -45.4678 },
        { name: 'Barequeçaba', lat: -23.8266, lng: -45.4389 },
        { name: 'Centro / Balsa', lat: -23.8166, lng: -45.3995 },
        { name: 'São Francisco', lat: -23.7543, lng: -45.3985 },
        { name: 'Enseada', lat: -23.7222, lng: -45.3912 },
        { name: 'Canto do Mar', lat: -23.7089, lng: -45.3978 },
      ];

      for (const district of saoSebastiaoDistricts) {
        expect(isWithinOperationalArea(district.lat, district.lng), district.name).toBe(true);
        expect(validateOperationalPoint(district.lat, district.lng, district.name).valid).toBe(true);
      }
    });

    it('rejects addresses outside São Sebastião with explicit OUT_OF_AREA feedback (never silently accepts)', () => {
      const outOfAreaCities = [
        { name: 'São Paulo (Av. Paulista)', lat: -23.5614, lng: -46.6559 },
        { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
        { name: 'Caraguatatuba Centro', lat: -23.6203, lng: -45.4132 },
        { name: 'Ubatuba Centro', lat: -23.4339, lng: -45.0838 },
        { name: 'Bertioga Centro', lat: -23.8544, lng: -46.1387 },
        { name: 'Ilhabela Balsa', lat: -23.8159, lng: -45.3672 },
      ];

      for (const city of outOfAreaCities) {
        const res = validateOperationalPoint(city.lat, city.lng, city.name);
        expect(res.valid, city.name).toBe(false);
        expect(res.code).toBe('OUT_OF_AREA');
        expect(res.message).toContain('fora da área operacional');
      }
    });

    it('biases unqualified local street searches to São Sebastião while keeping explicit external cities detectable', () => {
      expect(buildBiasedAddressQuery('Av. Dr. Altino Arantes, 200')).toBe(
        'Av. Dr. Altino Arantes, 200, São Sebastião, SP'
      );
      expect(buildBiasedAddressQuery('Av. Francisco Loup, 800, Maresias')).toBe(
        'Av. Francisco Loup, 800, Maresias, São Sebastião, SP'
      );
      // Explicit city preserved so geocoder returns its real coords and operational validation rejects it clearly
      expect(buildBiasedAddressQuery('Av. Paulista, 1000, São Paulo')).toBe(
        'Av. Paulista, 1000, São Paulo'
      );
      expect(buildBiasedAddressQuery('Praia Grande, Ubatuba')).toBe('Praia Grande, Ubatuba');
    });
  });

  describe('2. GPS Filtering, Freshness, Low Accuracy & Battery-Safe Throttling', () => {
    const baseTime = 1_750_000_000_000;
    const makeSample = (overrides: Partial<GpsSample>): GpsSample => {
      const ts = overrides.timestamp ?? baseTime;
      return {
        lat: SAO_SEBASTIAO_CENTER.lat,
        lng: SAO_SEBASTIAO_CENTER.lng,
        accuracy: 12,
        heading: 90,
        speed: 8,
        timestamp: ts,
        updatedAt: new Date(ts).toISOString(),
        ...overrides,
      };
    };

    it('rejects invalid coordinates, stale timestamps, and impossible GPS teleport jumps', () => {
      const prev = makeSample({ lat: -23.8055, lng: -45.4011, accuracy: 10, timestamp: baseTime });

      // Invalid coords
      expect(filterGpsSample(prev, makeSample({ lat: 0, lng: 0, timestamp: baseTime + 2000 })).accepted).toBe(false);

      // Out-of-order / stale timestamp
      expect(filterGpsSample(prev, makeSample({ lat: -23.806, lng: -45.402, timestamp: baseTime - 1000 })).accepted).toBe(false);

      // Extreme inaccuracy spike (> 500m) when previous fix was precise
      const poorFix = filterGpsSample(
        prev,
        makeSample({ lat: -23.809, lng: -45.405, accuracy: 850, timestamp: baseTime + 3000 })
      );
      expect(poorFix.accepted).toBe(false);
      expect(poorFix.reason).toBe('poor_accuracy');

      // Impossible 1km teleport in 1 second
      const teleport = filterGpsSample(
        prev,
        makeSample({ lat: -23.8155, lng: -45.4011, accuracy: 45, timestamp: baseTime + 1000 })
      );
      expect(teleport.accepted).toBe(false);
      expect(teleport.reason).toBe('teleport_jump');
    });

    it('suppresses stationary micro-jitter while accepting legitimate movement', () => {
      const prev = makeSample({ lat: -23.8055, lng: -45.4011, accuracy: 15, timestamp: baseTime });

      // 2-meter GPS wobble while stopped -> ignored
      const jitter = filterGpsSample(
        prev,
        makeSample({ lat: -23.805515, lng: -45.40111, accuracy: 15, timestamp: baseTime + 2000 })
      );
      expect(jitter.accepted).toBe(false);
      expect(jitter.reason).toBe('micro_jitter');

      // Real 35-meter movement in 3 seconds (~42 km/h) -> accepted
      const moved = filterGpsSample(
        prev,
        makeSample({ lat: -23.80582, lng: -45.4011, accuracy: 12, timestamp: baseTime + 3000 })
      );
      expect(moved.accepted).toBe(true);
      expect(moved.sample?.lat).toBeCloseTo(-23.80582, 5);
    });

    it('validates GPS freshness strictly against 60s window and formats telemetry age', () => {
      const now = baseTime;
      expect(isGpsFresh(new Date(now - 15_000).toISOString(), now)).toBe(true);
      expect(isGpsFresh(new Date(now - GPS_FRESHNESS_MAX_AGE_MS - 1000).toISOString(), now)).toBe(false);
      expect(isGpsFresh('', now)).toBe(false);
      expect(GPS_LOW_ACCURACY_WARNING_METERS).toBe(80);
      expect(formatTelemetryAge(new Date(now - 5_000).toISOString(), now)).toBe('agora mesmo');
      expect(formatTelemetryAge(new Date(now - 35_000).toISOString(), now)).toBe('há 35s');
      expect(formatTelemetryAge(new Date(now - 125_000).toISOString(), now)).toBe('há 2 min');
    });

    it('throttles driver GPS uploads to prevent spam while maintaining fresh heartbeats', () => {
      const origin = { lat: -23.8055, lng: -45.4011 };
      expect(shouldTransmitDriverLocation(null, origin, baseTime)).toBe(true);

      const lastSent = { ...origin, sentAtMs: baseTime };
      // 1s later even with movement -> throttled
      expect(shouldTransmitDriverLocation(lastSent, { lat: -23.8057, lng: -45.4011 }, baseTime + 1000)).toBe(false);
      // 4s later with < 5m movement -> throttled
      expect(shouldTransmitDriverLocation(lastSent, { lat: -23.80552, lng: -45.4011 }, baseTime + 4000)).toBe(false);
      // 4s later with 25m movement -> transmitted
      expect(shouldTransmitDriverLocation(lastSent, { lat: -23.80575, lng: -45.4011 }, baseTime + 4000)).toBe(true);
      // 19s later while stationary -> heartbeat transmitted to keep 60s freshness alive
      expect(shouldTransmitDriverLocation(lastSent, origin, baseTime + 19_000)).toBe(true);
    });
  });

  describe('3. Polyline Decoding, Route Progress Trimming & Automatic Off-Route Recalculation', () => {
    const roadRoute: [number, number][] = [
      [-23.8055, -45.4011], // Start (Centro)
      [-23.8100, -45.4050], // Midpoint 1
      [-23.8150, -45.4100], // Midpoint 2
      [-23.8200, -45.4150], // Destination (Praia Grande)
    ];

    it('accurately decodes valid encoded polylines and rejects corrupted input', () => {
      const encoded = encodePolyline(roadRoute);
      const decoded = decodePolyline(encoded);
      expect(decoded.length).toBe(roadRoute.length);
      expect(decoded[0][0]).toBeCloseTo(roadRoute[0][0], 4);
      expect(decoded[0][1]).toBeCloseTo(roadRoute[0][1], 4);
      expect(decoded[3][0]).toBeCloseTo(roadRoute[3][0], 4);

      expect(decodePolyline('')).toEqual([]);
      expect(decodePolyline('   ')).toEqual([]);
    });

    it('trims traversed route and decreases remaining road distance as vehicle advances', () => {
      const fullMeters = calculatePolylineDistanceMeters(roadRoute);
      expect(fullMeters).toBeGreaterThan(1500);

      const nearMidpoint = { lat: -23.8125, lng: -45.4075 };
      const trimmed = trimPolylineFromPosition(nearMidpoint, roadRoute);
      expect(trimmed).not.toBeNull();
      expect(trimmed!.deviationMeters).toBeLessThan(20);
      expect(trimmed!.remainingDistanceMeters).toBeLessThan(fullMeters * 0.6);
      expect(trimmed!.remainingDistanceMeters).toBeGreaterThan(fullMeters * 0.35);

      const nearerDest = { lat: -23.8185, lng: -45.4135 };
      const trimmedNearDest = trimPolylineFromPosition(nearerDest, roadRoute);
      expect(trimmedNearDest!.remainingDistanceMeters).toBeLessThan(trimmed!.remainingDistanceMeters);
    });

    it('detects significant route deviation and triggers automatic recalculation without flapping on GPS noise', () => {
      const origin = { lat: roadRoute[0][0], lng: roadRoute[0][1] };
      const destination = { lat: roadRoute[3][0], lng: roadRoute[3][1] };
      const calcAt = 1_750_000_000_000;

      // Small 15m GPS drift on-route -> NO recalculation
      const onRoute = shouldRecalculateRoute({
        currentPos: { lat: -23.8101, lng: -45.4051 },
        currentAccuracyMeters: 12,
        activePolyline: roadRoute,
        lastRouteOrigin: origin,
        target: destination,
        lastRouteTarget: destination,
        lastCalculatedAtMs: calcAt,
        nowMs: calcAt + 12_000,
      });
      expect(onRoute.shouldRecalculate).toBe(false);
      expect(onRoute.reason).toBe('none');

      // Significant ~220m off-route detour after cooldown -> TRIGGERS automatic recalculation
      const offRoute = shouldRecalculateRoute({
        currentPos: { lat: -23.8100, lng: -45.4072 },
        currentAccuracyMeters: 12,
        activePolyline: roadRoute,
        lastRouteOrigin: origin,
        target: destination,
        lastRouteTarget: destination,
        lastCalculatedAtMs: calcAt,
        nowMs: calcAt + 10_000,
      });
      expect(offRoute.shouldRecalculate).toBe(true);
      expect(offRoute.reason).toBe('off_route');
      expect(offRoute.deviationMeters).toBeGreaterThan(150);

      // Same detour inside 8s cooldown -> does NOT spam recalculation
      const cooldownBlocked = shouldRecalculateRoute({
        currentPos: { lat: -23.8100, lng: -45.4072 },
        currentAccuracyMeters: 12,
        activePolyline: roadRoute,
        lastRouteOrigin: origin,
        target: destination,
        lastRouteTarget: destination,
        lastCalculatedAtMs: calcAt,
        nowMs: calcAt + 3_000,
      });
      expect(cooldownBlocked.shouldRecalculate).toBe(false);

      // Severe GPS inaccuracy (> 100m) -> does NOT trigger false off-route reroute
      const lowAccuracyNoise = shouldRecalculateRoute({
        currentPos: { lat: -23.8100, lng: -45.4072 },
        currentAccuracyMeters: 150,
        activePolyline: roadRoute,
        lastRouteOrigin: origin,
        target: destination,
        lastRouteTarget: destination,
        lastCalculatedAtMs: calcAt,
        nowMs: calcAt + 10_000,
      });
      expect(lowAccuracyNoise.shouldRecalculate).toBe(false);

      // Destination changed -> always recalculates
      const destChanged = shouldRecalculateRoute({
        currentPos: origin,
        currentAccuracyMeters: 10,
        activePolyline: roadRoute,
        lastRouteOrigin: origin,
        target: { lat: -23.7915, lng: -45.5683 }, // Maresias
        lastRouteTarget: destination,
        lastCalculatedAtMs: calcAt,
        nowMs: calcAt + 1_000,
      });
      expect(destChanged.shouldRecalculate).toBe(true);
      expect(destChanged.reason).toBe('destination_changed');

      // Nearest projection sanity check
      const match = findNearestPointOnPolyline({ lat: -23.8100, lng: -45.4050 }, roadRoute);
      expect(match?.distanceMeters).toBeLessThan(1);
      expect(haversineDistanceMeters(origin, destination)).toBeGreaterThan(1500);
    });
  });

  describe('4. Routing API Contract, Anti-Straight-Line Guarantee & Abort Handling', () => {
    const validCoords: [number, number][] = [
      [-23.8055, -45.4011],
      [-23.8120, -45.4150],
      [-23.8198, -45.4211],
    ];
    const validPolyline = encodePolyline(validCoords);

    it('parses raw backend /maps/directions JSON (without success wrapper) as authoritative server route', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          distanceKm: 3.8,
          durationMin: 8,
          encodedPolyline: validPolyline,
          summary: 'Rod. Dr. Manoel Hipólito do Rêgo',
          steps: [],
        }),
      } as any);

      const route = await mapsApi.getDirections(-23.8055, -45.4011, -23.8198, -45.4211);
      expect(route.provider).toBe('server');
      expect(route.distanceKm).toBe(3.8);
      expect(route.durationMin).toBe(8);
      expect(route.coords.length).toBe(3);
    });

    it('rejects backend straight-line fallback (fallback: true / empty polyline) and falls back only to real OSRM road geometry', async () => {
      global.fetch = vi
        .fn()
        // 1. Server returns straight-line fallback
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            distanceKm: 4.1,
            durationMin: 10,
            encodedPolyline: '',
            fallback: true,
            steps: [],
          }),
        } as any)
        // 2. OSRM returns real road geometry
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            routes: [
              {
                distance: 3900,
                duration: 480,
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [-45.4011, -23.8055],
                    [-45.4150, -23.8120],
                    [-45.4211, -23.8198],
                  ],
                },
                legs: [{ summary: 'SP-055' }],
              },
            ],
          }),
        } as any);

      const route = await mapsApi.getDirections(-23.8055, -45.4011, -23.8198, -45.4211);
      expect(route.provider).toBe('osrm');
      expect(route.distanceKm).toBe(3.9);
      expect(route.durationMin).toBe(8);
      // Verify GeoJSON [lng, lat] was properly swapped to Leaflet [lat, lng]
      expect(route.coords[0]).toEqual([-23.8055, -45.4011]);
      expect(route.coords[2]).toEqual([-23.8198, -45.4211]);
    });

    it('throws an explicit error (NEVER returns a straight line) when all routing providers fail', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 } as any)
        .mockResolvedValueOnce({ ok: false, status: 503 } as any);

      await expect(
        mapsApi.getDirections(-23.8055, -45.4011, -23.8198, -45.4211)
      ).rejects.toThrow(/indisponível/i);
    });

    it('propagates AbortError immediately when a superseded routing request is cancelled', async () => {
      const controller = new AbortController();
      const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
      global.fetch = vi.fn().mockRejectedValueOnce(abortErr);
      controller.abort();

      await expect(
        mapsApi.getDirections(-23.8055, -45.4011, -23.8198, -45.4211, controller.signal)
      ).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('filters out backend hardcoded KNOWN_LOCATIONS (loc-*) and unverified free-text (custom-*) in autocomplete', async () => {
      global.fetch = vi
        .fn()
        // 1. Backend returns hardcoded loc-* and custom-* fallbacks
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            data: [
              { description: 'Praia de Maresias', placeId: 'loc--23.79--45.56', lat: -23.7915, lng: -45.5683 },
              { description: 'Rua Teste', placeId: 'custom-12345' },
            ],
          }),
        } as any)
        // 2. Direct Nominatim search biased to São Sebastião viewbox returns real geocoded results
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              place_id: 991,
              lat: '-23.5614',
              lon: '-46.6559',
              display_name: 'Avenida Paulista, Bela Vista, São Paulo, SP',
              address: { road: 'Avenida Paulista', suburb: 'Bela Vista', city: 'São Paulo', state: 'SP' },
            },
            {
              place_id: 992,
              lat: '-23.8055',
              lon: '-45.4011',
              display_name: 'Avenida Doutor Altino Arantes, Centro, São Sebastião, SP',
              address: { road: 'Avenida Doutor Altino Arantes', suburb: 'Centro', city: 'São Sebastião', state: 'SP' },
            },
          ],
        } as any);

      const results = await mapsApi.autocomplete('Avenida');
      expect(results.length).toBe(2);
      // São Sebastião operational result MUST be sorted first
      expect(results[0].inOperationalArea).toBe(true);
      expect(results[0].description).toContain('São Sebastião');
      // Out-of-area result is explicitly flagged
      expect(results[1].inOperationalArea).toBe(false);
    });
  });

  describe('5. Passenger ↔ Driver Live Location Sync Endpoints & Security Escaping', () => {
    it('consumes GET /rides/:id/driver-location and POST /rides/:id/driver-location cleanly', async () => {
      const updatedAt = new Date().toISOString();
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            hasLiveLocation: true,
            status: 'DRIVER_ARRIVING',
            driverLocation: {
              lat: -23.8012,
              lng: -45.3989,
              heading: 180,
              accuracy: 10,
              updatedAt,
              distanceKm: 1.4,
              etaMinutes: 4,
              isStale: false,
              secondsAgo: 2,
            },
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            driverLocation: {
              lat: -23.8020,
              lng: -45.3995,
              heading: 185,
              accuracy: 9,
              updatedAt,
            },
          }),
        } as any);

      const live = await ridesApi.getDriverLocation('ride-sync-01');
      expect(live.hasLiveLocation).toBe(true);
      expect(live.driverLocation?.lat).toBe(-23.8012);
      expect(live.driverLocation?.isStale).toBe(false);

      const sent = await ridesApi.updateDriverLocation('ride-sync-01', {
        lat: -23.8020,
        lng: -45.3995,
        heading: 185,
        accuracy: 9,
      });
      expect(sent.driverLocation.lat).toBe(-23.8020);
    });

    it('escapes HTML characters to prevent XSS in Leaflet marker tooltips and labels', () => {
      expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
        '&lt;img src=x onerror=alert(1)&gt;'
      );
      expect(escapeHtml('Rua "A" & B\'s')).toBe('Rua &quot;A&quot; &amp; B&#39;s');
      expect(SAO_SEBASTIAO_BOUNDS.minLat).toBeLessThan(SAO_SEBASTIAO_BOUNDS.maxLat);
      expect(SAO_SEBASTIAO_BOUNDS.minLng).toBeLessThan(SAO_SEBASTIAO_BOUNDS.maxLng);
    });
  });
});
