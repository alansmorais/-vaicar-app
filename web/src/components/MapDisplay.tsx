import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PublicDriverMarker } from '../api/drivers.js';
import { mapsApi } from '../api/maps.js';
import {
  SAO_SEBASTIAO_CENTER,
  escapeHtml,
  formatTelemetryAge,
  isGpsFresh,
  isValidCoordinate,
  shouldRecalculateRoute,
  trimPolylineFromPosition,
  validateOperationalPoint,
} from '../utils/geoNavigation.js';
import {
  Navigation,
  Crosshair,
  LocateFixed,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export interface MapDriverLocation {
  lat: number;
  lng: number;
  heading?: number | null;
  accuracy?: number | null;
  updatedAt?: string | null;
  isStale?: boolean;
}

export interface MapRouteInfo {
  distanceKm: number;
  durationMinutes: number;
  recalculated?: boolean;
  provider?: 'server' | 'osrm';
}

export interface MapProps {
  /** Always represents the passenger pickup / collection coordinate */
  pickup?: { lat: number; lng: number; address?: string } | null;
  /** Always represents the confirmed trip / delivery destination coordinate */
  destination?: { lat: number; lng: number; address?: string } | null;
  onPickupChange?: (lat: number, lng: number, address?: string) => void;
  onDestinationChange?: (lat: number, lng: number, address?: string) => void;
  onMapClick?: (lat: number, lng: number, address?: string) => void;
  drivers?: PublicDriverMarker[];
  /** Always represents the real GPS position of the assigned driver or current driver */
  driverLocation?: MapDriverLocation | null;
  /** Optional real GPS position of the passenger (distinct from editable pickup pin) */
  passengerLocation?: { lat: number; lng: number; accuracy?: number | null } | null;
  assignedDriverTooltip?: string;
  selectedDriverId?: string | null;
  onDriverSelect?: (driver: PublicDriverMarker) => void;
  height?: string;
  className?: string;
  draggable?: boolean;
  pickupLabel?: string;
  destinationLabel?: string;
  mode?: 'planning' | 'driver_to_pickup' | 'driver_to_destination';
  viewerRole?: 'passenger' | 'driver';
  hudTitle?: string;
  showHud?: boolean;
  compactPins?: boolean;
  enforceOperationalArea?: boolean;
  onRouteInfoChange?: (info: MapRouteInfo | null) => void;
  onRouteError?: (errorMessage: string | null) => void;
  onLocateGpsRequest?: () => void;
}

function createCustomMarkerIcon(
  type: 'pickup' | 'destination' | 'assigned' | 'driver_me' | 'passenger_gps',
  label?: string,
  isDraggable: boolean = true,
  compact: boolean = false,
  options?: { isStale?: boolean; heading?: number | null }
) {
  if (type === 'passenger_gps') {
    return L.divIcon({
      className: 'custom-passenger-gps-marker',
      html: `
        <div style="width:24px; height:24px; display:flex; align-items:center; justify-content:center; pointer-events:none;">
          <div style="position:relative; width:18px; height:18px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; inset:-6px; border-radius:50%; background:rgba(37,99,235,0.28); animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width:14px; height:14px; border-radius:50%; background:#2563eb; border:3px solid #ffffff; box-shadow:0 2px 8px rgba(37,99,235,0.65); z-index:2;"></div>
          </div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  if (type === 'driver_me' || type === 'assigned') {
    const isStale = Boolean(options?.isStale);
    const displayLabel = escapeHtml(
      label || (type === 'driver_me' ? 'Você (GPS)' : isStale ? 'Última posição' : 'Motorista')
    );
    const badgeBg = isStale ? '#92400e' : type === 'driver_me' ? '#0369a1' : '#065f46';
    const badgeBorder = isStale ? '#fbbf24' : type === 'driver_me' ? '#38bdf8' : '#34d399';
    const circleBg = isStale ? '#d97706' : type === 'driver_me' ? '#0284c7' : '#059669';
    const heading =
      typeof options?.heading === 'number' && Number.isFinite(options.heading)
        ? Math.round(options.heading)
        : null;

    return L.divIcon({
      className: `custom-${type}-marker-icon`,
      html: `
        <div style="width:164px; height:84px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; pointer-events:auto; user-select:none;">
          <div style="
            background: ${badgeBg};
            color: #f8fafc;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 10px;
            border-radius: 9999px;
            border: 2px solid ${badgeBorder};
            box-shadow: 0 4px 12px rgba(0,0,0,0.45);
            white-space: nowrap;
            max-width: 160px;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 5px;
          ">
            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${badgeBorder}; flex-shrink:0;"></span>
            <span style="overflow:hidden; text-overflow:ellipsis;">${displayLabel}</span>
          </div>
          <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
            ${
              !isStale
                ? `<div style="position:absolute; inset:-4px; border-radius:50%; background:${badgeBorder}55; animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>`
                : ''
            }
            <div style="
              width:38px;
              height:38px;
              border-radius:50%;
              background:${circleBg};
              border:3px solid #ffffff;
              box-shadow:0 4px 12px rgba(0,0,0,0.5);
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:18px;
              z-index:2;
              ${heading !== null ? `transform: rotate(${heading}deg);` : ''}
            ">
              ${heading !== null ? '▲' : '🚗'}
            </div>
          </div>
          <div style="width:16px; height:4px; border-radius:50%; background:rgba(0,0,0,0.38); filter:blur(1px); margin-top:-2px;"></div>
        </div>
      `,
      iconSize: [164, 84],
      iconAnchor: [82, 64],
    });
  }

  if (type === 'pickup') {
    if (compact) {
      return L.divIcon({
        className: 'custom-pickup-marker-icon-compact',
        html: `
          <div style="width:32px; height:42px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; cursor:${isDraggable ? 'grab' : 'default'}; pointer-events:auto; touch-action:none; user-select:none;">
            <div style="position:relative; width:30px; height:38px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
              <svg width="30" height="38" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 44 18 44C18 44 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="#10b981"/>
                <path d="M18 2C9.16344 2 2 9.16344 2 18C2 28.5 18 41.5 18 41.5C18 41.5 34 28.5 34 18C34 9.16344 26.8366 2 18 2Z" fill="#059669"/>
                <circle cx="18" cy="17" r="8" fill="#ffffff"/>
                <circle cx="18" cy="17" r="4.5" fill="#10b981"/>
              </svg>
            </div>
            <div style="width:14px; height:4px; border-radius:50%; background:rgba(0,0,0,0.35); filter:blur(1px); margin-top:-2px;"></div>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });
    }

    const displayLabel = escapeHtml(label || 'Embarque');
    return L.divIcon({
      className: 'custom-pickup-marker-icon',
      html: `
        <div style="width:152px; height:80px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; cursor:${isDraggable ? 'grab' : 'default'}; pointer-events:auto; touch-action:none; user-select:none;">
          <div style="
            background: #064e3b;
            color: #ecfdf5;
            font-size: 11px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 9999px;
            border: 2px solid #34d399;
            box-shadow: 0 4px 14px rgba(0,0,0,0.55);
            white-space: nowrap;
            max-width: 148px;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 3px;
            display: flex;
            align-items: center;
            gap: 5px;
          ">
            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#34d399; flex-shrink:0;"></span>
            <span style="overflow:hidden; text-overflow:ellipsis;">${displayLabel}</span>
          </div>
          <div style="position:relative; width:36px; height:44px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));">
            <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 44 18 44C18 44 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="#10b981"/>
              <path d="M18 2C9.16344 2 2 9.16344 2 18C2 28.5 18 41.5 18 41.5C18 41.5 34 28.5 34 18C34 9.16344 26.8366 2 18 2Z" fill="#059669"/>
              <circle cx="18" cy="17" r="8" fill="#ffffff"/>
              <circle cx="18" cy="17" r="4.5" fill="#10b981"/>
            </svg>
          </div>
          <div style="width:14px; height:4px; border-radius:50%; background:rgba(0,0,0,0.35); filter:blur(1px); margin-top:-2px;"></div>
        </div>
      `,
      iconSize: [152, 80],
      iconAnchor: [76, 80],
    });
  }

  // destination
  if (compact) {
    return L.divIcon({
      className: 'custom-destination-marker-icon-compact',
      html: `
        <div style="width:32px; height:42px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; cursor:${isDraggable ? 'grab' : 'default'}; pointer-events:auto; touch-action:none; user-select:none;">
          <div style="position:relative; width:30px; height:38px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
            <svg width="30" height="38" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 44 18 44C18 44 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="#f43f5e"/>
              <path d="M18 2C9.16344 2 2 9.16344 2 18C2 28.5 18 41.5 18 41.5C18 41.5 34 28.5 34 18C34 9.16344 26.8366 2 18 2Z" fill="#e11d48"/>
              <circle cx="18" cy="17" r="8" fill="#ffffff"/>
              <circle cx="18" cy="17" r="4.5" fill="#f43f5e"/>
            </svg>
          </div>
          <div style="width:14px; height:4px; border-radius:50%; background:rgba(0,0,0,0.35); filter:blur(1px); margin-top:-2px;"></div>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
    });
  }

  const displayLabel = escapeHtml(label || 'Destino');
  return L.divIcon({
    className: 'custom-destination-marker-icon',
    html: `
      <div style="width:152px; height:80px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; cursor:${isDraggable ? 'grab' : 'default'}; pointer-events:auto; touch-action:none; user-select:none;">
        <div style="
          background: #881337;
          color: #fff1f2;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 9999px;
          border: 2px solid #fb7185;
          box-shadow: 0 4px 14px rgba(0,0,0,0.55);
          white-space: nowrap;
          max-width: 148px;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 3px;
          display: flex;
          align-items: center;
          gap: 5px;
        ">
          <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#fb7185; flex-shrink:0;"></span>
          <span style="overflow:hidden; text-overflow:ellipsis;">${displayLabel}</span>
        </div>
        <div style="position:relative; width:36px; height:44px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));">
          <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 44 18 44C18 44 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="#f43f5e"/>
            <path d="M18 2C9.16344 2 2 9.16344 2 18C2 28.5 18 41.5 18 41.5C18 41.5 34 28.5 34 18C34 9.16344 26.8366 2 18 2Z" fill="#e11d48"/>
            <circle cx="18" cy="17" r="8" fill="#ffffff"/>
            <circle cx="18" cy="17" r="4.5" fill="#f43f5e"/>
          </svg>
        </div>
        <div style="width:14px; height:4px; border-radius:50%; background:rgba(0,0,0,0.35); filter:blur(1px); margin-top:-2px;"></div>
      </div>
    `,
    iconSize: [152, 80],
    iconAnchor: [76, 80],
  });
}

export const MapDisplay: React.FC<MapProps> = ({
  pickup,
  destination,
  onPickupChange,
  onDestinationChange,
  onMapClick,
  drivers = [],
  driverLocation,
  passengerLocation,
  assignedDriverTooltip,
  selectedDriverId,
  onDriverSelect,
  height = '480px',
  className = '',
  draggable = true,
  pickupLabel,
  destinationLabel,
  mode = 'planning',
  viewerRole = 'passenger',
  hudTitle,
  showHud = true,
  compactPins = false,
  enforceOperationalArea = true,
  onRouteInfoChange,
  onRouteError,
  onLocateGpsRequest,
}) => {
  const safeDrivers: PublicDriverMarker[] = Array.isArray(drivers) ? drivers : [];
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer / marker refs
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const assignedDriverMarkerRef = useRef<L.Marker | null>(null);
  const driverAccuracyCircleRef = useRef<L.Circle | null>(null);
  const passengerGpsMarkerRef = useRef<L.Marker | null>(null);
  const passengerAccuracyCircleRef = useRef<L.Circle | null>(null);
  const driversLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeShadowPolylineRef = useRef<L.Polyline | null>(null);

  // Latest props in refs for Leaflet event callbacks (no map re-creation)
  const onPickupChangeRef = useRef(onPickupChange);
  onPickupChangeRef.current = onPickupChange;
  const onDestinationChangeRef = useRef(onDestinationChange);
  onDestinationChangeRef.current = onDestinationChange;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onDriverSelectRef = useRef(onDriverSelect);
  onDriverSelectRef.current = onDriverSelect;
  const onRouteInfoChangeRef = useRef(onRouteInfoChange);
  onRouteInfoChangeRef.current = onRouteInfoChange;
  const onRouteErrorRef = useRef(onRouteError);
  onRouteErrorRef.current = onRouteError;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const draggableRef = useRef(draggable);
  draggableRef.current = draggable;
  const enforceAreaRef = useRef(enforceOperationalArea);
  enforceAreaRef.current = enforceOperationalArea;
  const pickupRef = useRef(pickup);
  pickupRef.current = pickup;
  const destinationRef = useRef(destination);
  destinationRef.current = destination;

  // Routing & rerouting tracking refs
  const routeAbortRef = useRef<AbortController | null>(null);
  const routeSeqRef = useRef<number>(0);
  const activeRouteCoordsRef = useRef<[number, number][] | null>(null);
  const activeRouteTotalMetersRef = useRef<number>(0);
  const activeRouteTotalMinutesRef = useRef<number>(0);
  const lastRouteOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteTargetRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteModeRef = useRef<string>('');
  const lastRouteCalculatedAtRef = useRef<number>(0);
  const hasFittedContextKeyRef = useRef<string>('');

  const [routeInfo, setRouteInfo] = useState<MapRouteInfo | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [recalculatingRoute, setRecalculatingRoute] = useState(false);
  const [routeRetryToken, setRouteRetryToken] = useState(0);
  const [locatingGps, setLocatingGps] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTemporaryNotice = useCallback((msg: string) => {
    setMapNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setMapNotice(null);
    }, 5000);
  }, []);

  const updateRouteInfo = useCallback((info: MapRouteInfo | null) => {
    setRouteInfo(info);
    onRouteInfoChangeRef.current?.(info);
  }, []);

  const updateRouteError = useCallback((msg: string | null) => {
    setRouteError(msg);
    onRouteErrorRef.current?.(msg);
  }, []);

  const clearRouteLayers = useCallback(() => {
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (routeShadowPolylineRef.current) {
      routeShadowPolylineRef.current.remove();
      routeShadowPolylineRef.current = null;
    }
    activeRouteCoordsRef.current = null;
    activeRouteTotalMetersRef.current = 0;
    activeRouteTotalMinutesRef.current = 0;
    lastRouteOriginRef.current = null;
    lastRouteTargetRef.current = null;
    lastRouteCalculatedAtRef.current = 0;
  }, []);

  const drawRoutePolyline = useCallback((map: L.Map, coords: [number, number][], activeMode: MapProps['mode']) => {
    if (routeShadowPolylineRef.current) routeShadowPolylineRef.current.remove();
    if (routePolylineRef.current) routePolylineRef.current.remove();

    const isToDestination = activeMode === 'driver_to_destination';
    const shadowColor = isToDestination ? '#0c4a6e' : '#064e3b';
    const lineColor = isToDestination ? '#0ea5e9' : '#10b981';

    const shadow = L.polyline(coords, {
      color: shadowColor,
      weight: 9,
      opacity: 0.45,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    const polyline = L.polyline(coords, {
      color: lineColor,
      weight: 5,
      opacity: 0.96,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    routeShadowPolylineRef.current = shadow;
    routePolylineRef.current = polyline;
    return polyline;
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await mapsApi.reverseGeocode(lat, lng);
      return res.address;
    } catch {
      return `Ponto (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  }, []);

  // 1. Initialize Leaflet Map ONCE (never recreated on prop updates)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const initialLat = isValidCoordinate(pickupRef.current?.lat, pickupRef.current?.lng)
      ? pickupRef.current!.lat
      : SAO_SEBASTIAO_CENTER.lat;
    const initialLng = isValidCoordinate(pickupRef.current?.lat, pickupRef.current?.lng)
      ? pickupRef.current!.lng
      : SAO_SEBASTIAO_CENTER.lng;

    const map = L.map(container, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false,
    });

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    tileLayer.on('tileerror', () => {
      setTileError(true);
    });
    tileLayer.on('tileload', () => {
      setTileError(false);
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    driversLayerRef.current = L.layerGroup().addTo(map);

    // Interactive map click ONLY in editable planning mode
    map.on('click', async (e: L.LeafletMouseEvent) => {
      if (modeRef.current !== 'planning' || !draggableRef.current) return;
      if (!onPickupChangeRef.current && !onDestinationChangeRef.current && !onMapClickRef.current) return;

      const { lat, lng } = e.latlng;
      if (enforceAreaRef.current) {
        const validation = validateOperationalPoint(lat, lng, 'Este ponto no mapa');
        if (!validation.valid) {
          showTemporaryNotice(validation.message || 'Ponto fora da área operacional de São Sebastião.');
          return;
        }
      }

      const address = await reverseGeocode(lat, lng);

      if (onPickupChangeRef.current || onDestinationChangeRef.current) {
        const popupContainer = document.createElement('div');
        popupContainer.style.fontFamily = 'inherit';
        popupContainer.style.textAlign = 'center';
        popupContainer.style.padding = '4px 2px';

        const addrEl = document.createElement('div');
        addrEl.style.fontWeight = '700';
        addrEl.style.fontSize = '11px';
        addrEl.style.color = '#0f172a';
        addrEl.style.marginBottom = '8px';
        addrEl.style.lineHeight = '1.3';
        addrEl.style.maxWidth = '210px';
        addrEl.textContent = `📍 ${address}`;
        popupContainer.appendChild(addrEl);

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '6px';
        btnRow.style.justifyContent = 'center';

        if (onPickupChangeRef.current) {
          const pickupBtn = document.createElement('button');
          pickupBtn.type = 'button';
          pickupBtn.textContent = '🟢 Definir Embarque';
          pickupBtn.style.cssText =
            'background:#059669;color:#fff;font-size:10px;font-weight:800;border:none;border-radius:6px;padding:6px 9px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.25);';
          pickupBtn.addEventListener('click', () => {
            map.closePopup();
            onPickupChangeRef.current?.(lat, lng, address);
          });
          btnRow.appendChild(pickupBtn);
        }

        if (onDestinationChangeRef.current) {
          const destBtn = document.createElement('button');
          destBtn.type = 'button';
          destBtn.textContent = '🔴 Definir Destino';
          destBtn.style.cssText =
            'background:#e11d48;color:#fff;font-size:10px;font-weight:800;border:none;border-radius:6px;padding:6px 9px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.25);';
          destBtn.addEventListener('click', () => {
            map.closePopup();
            onDestinationChangeRef.current?.(lat, lng, address);
          });
          btnRow.appendChild(destBtn);
        }

        popupContainer.appendChild(btnRow);

        L.popup({
          closeButton: true,
          className: 'custom-click-selector-popup',
          offset: [0, -10],
        })
          .setLatLng([lat, lng])
          .setContent(popupContainer)
          .openOn(map);
      }

      onMapClickRef.current?.(lat, lng, address);
    });

    mapInstanceRef.current = map;

    const handleInvalidate = () => {
      map.invalidateSize({ animate: false });
    };

    const ro = new ResizeObserver(handleInvalidate);
    ro.observe(container);
    window.addEventListener('resize', handleInvalidate);
    window.addEventListener('orientationchange', handleInvalidate);
    document.addEventListener('visibilitychange', handleInvalidate);

    const t1 = setTimeout(handleInvalidate, 150);
    const t2 = setTimeout(handleInvalidate, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      routeAbortRef.current?.abort();
      ro.disconnect();
      window.removeEventListener('resize', handleInvalidate);
      window.removeEventListener('orientationchange', handleInvalidate);
      document.removeEventListener('visibilitychange', handleInvalidate);
      map.remove();
      mapInstanceRef.current = null;
      pickupMarkerRef.current = null;
      destinationMarkerRef.current = null;
      assignedDriverMarkerRef.current = null;
      driverAccuracyCircleRef.current = null;
      passengerGpsMarkerRef.current = null;
      passengerAccuracyCircleRef.current = null;
      routePolylineRef.current = null;
      routeShadowPolylineRef.current = null;
      driversLayerRef.current = null;
    };
  }, [reverseGeocode, showTemporaryNotice]);

  // 2. Update Pickup Marker (ALWAYS represents confirmed/selected passenger pickup point)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!pickup || !isValidCoordinate(pickup.lat, pickup.lng)) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }
      return;
    }

    const pos = L.latLng(pickup.lat, pickup.lng);
    const canDrag = draggable && mode === 'planning' && Boolean(onPickupChangeRef.current);
    const markerTitle = pickupLabel || 'Embarque';
    const icon = createCustomMarkerIcon('pickup', markerTitle, canDrag, compactPins);

    if (!pickupMarkerRef.current) {
      const marker = L.marker(pos, {
        icon,
        draggable: canDrag,
        title: markerTitle,
        zIndexOffset: 900,
      }).addTo(map);

      marker.bindTooltip(escapeHtml(pickup.address || markerTitle), {
        permanent: false,
        direction: 'top',
        interactive: false,
        className:
          'bg-slate-900 text-emerald-300 text-xs font-bold border border-emerald-500 rounded-lg px-2.5 py-1 shadow-xl',
      });

      marker.on('dragstart', () => {
        marker.closeTooltip();
      });

      marker.on('dragend', async () => {
        const newPos = marker.getLatLng();
        if (enforceAreaRef.current) {
          const validation = validateOperationalPoint(newPos.lat, newPos.lng, 'O ponto de embarque');
          if (!validation.valid) {
            showTemporaryNotice(validation.message || 'Embarque fora de São Sebastião.');
            if (pickupRef.current && isValidCoordinate(pickupRef.current.lat, pickupRef.current.lng)) {
              marker.setLatLng([pickupRef.current.lat, pickupRef.current.lng]);
            }
            return;
          }
        }
        const address = await reverseGeocode(newPos.lat, newPos.lng);
        marker.setTooltipContent(escapeHtml(address));
        marker.openTooltip();
        onPickupChangeRef.current?.(newPos.lat, newPos.lng, address);
      });

      pickupMarkerRef.current = marker;
    } else {
      pickupMarkerRef.current.setLatLng(pos);
      pickupMarkerRef.current.setIcon(icon);
      if (canDrag) {
        pickupMarkerRef.current.dragging?.enable();
      } else {
        pickupMarkerRef.current.dragging?.disable();
      }
      if (pickup.address) {
        pickupMarkerRef.current.setTooltipContent(escapeHtml(pickup.address));
      }
    }
  }, [pickup?.lat, pickup?.lng, pickup?.address, pickupLabel, draggable, mode, compactPins, reverseGeocode, showTemporaryNotice]);

  // 3. Update Destination Marker (ALWAYS represents confirmed trip destination)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!destination || !isValidCoordinate(destination.lat, destination.lng)) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
      return;
    }

    const pos = L.latLng(destination.lat, destination.lng);
    const canDrag = draggable && mode === 'planning' && Boolean(onDestinationChangeRef.current);
    const markerTitle = destinationLabel || 'Destino';
    const icon = createCustomMarkerIcon('destination', markerTitle, canDrag, compactPins);

    if (!destinationMarkerRef.current) {
      const marker = L.marker(pos, {
        icon,
        draggable: canDrag,
        title: markerTitle,
        zIndexOffset: 900,
      }).addTo(map);

      marker.bindTooltip(escapeHtml(destination.address || markerTitle), {
        permanent: false,
        direction: 'top',
        interactive: false,
        className:
          'bg-slate-900 text-rose-300 text-xs font-bold border border-rose-500 rounded-lg px-2.5 py-1 shadow-xl',
      });

      marker.on('dragstart', () => {
        marker.closeTooltip();
      });

      marker.on('dragend', async () => {
        const newPos = marker.getLatLng();
        if (enforceAreaRef.current) {
          const validation = validateOperationalPoint(newPos.lat, newPos.lng, 'O destino');
          if (!validation.valid) {
            showTemporaryNotice(validation.message || 'Destino fora de São Sebastião.');
            if (destinationRef.current && isValidCoordinate(destinationRef.current.lat, destinationRef.current.lng)) {
              marker.setLatLng([destinationRef.current.lat, destinationRef.current.lng]);
            }
            return;
          }
        }
        const address = await reverseGeocode(newPos.lat, newPos.lng);
        marker.setTooltipContent(escapeHtml(address));
        marker.openTooltip();
        onDestinationChangeRef.current?.(newPos.lat, newPos.lng, address);
      });

      destinationMarkerRef.current = marker;
    } else {
      destinationMarkerRef.current.setLatLng(pos);
      destinationMarkerRef.current.setIcon(icon);
      if (canDrag) {
        destinationMarkerRef.current.dragging?.enable();
      } else {
        destinationMarkerRef.current.dragging?.disable();
      }
      if (destination.address) {
        destinationMarkerRef.current.setTooltipContent(escapeHtml(destination.address));
      }
    }
  }, [destination?.lat, destination?.lng, destination?.address, destinationLabel, draggable, mode, compactPins, reverseGeocode, showTemporaryNotice]);

  // 4. Update Live Assigned / Own Driver Marker & Accuracy Ring (NEVER rendered at fake coordinates)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!driverLocation || !isValidCoordinate(driverLocation.lat, driverLocation.lng)) {
      if (assignedDriverMarkerRef.current) {
        assignedDriverMarkerRef.current.remove();
        assignedDriverMarkerRef.current = null;
      }
      if (driverAccuracyCircleRef.current) {
        driverAccuracyCircleRef.current.remove();
        driverAccuracyCircleRef.current = null;
      }
      return;
    }

    const pos = L.latLng(driverLocation.lat, driverLocation.lng);
    const markerType = viewerRole === 'driver' ? 'driver_me' : 'assigned';
    const isStale = Boolean(driverLocation.isStale);
    const badgeLabel =
      viewerRole === 'driver'
        ? isStale
          ? 'Último GPS conhecido'
          : 'Você (GPS Ao Vivo)'
        : assignedDriverTooltip || (isStale ? 'Última posição' : 'Motorista');

    const icon = createCustomMarkerIcon(markerType, badgeLabel, false, false, {
      isStale,
      heading: driverLocation.heading,
    });

    const tooltipLines = [escapeHtml(badgeLabel)];
    if (driverLocation.updatedAt) {
      tooltipLines.push(`Atualizado ${escapeHtml(formatTelemetryAge(driverLocation.updatedAt))}`);
    }
    const tooltipHtml = tooltipLines.join(' • ');

    if (!assignedDriverMarkerRef.current) {
      const marker = L.marker(pos, {
        icon,
        zIndexOffset: 1200,
      }).addTo(map);
      marker.bindTooltip(tooltipHtml, {
        direction: 'top',
        permanent: false,
        className:
          'bg-slate-900 text-emerald-300 font-bold text-xs rounded-lg px-2 py-1 border border-emerald-500 shadow-xl',
      });
      assignedDriverMarkerRef.current = marker;
    } else {
      assignedDriverMarkerRef.current.setLatLng(pos);
      assignedDriverMarkerRef.current.setIcon(icon);
      assignedDriverMarkerRef.current.setTooltipContent(tooltipHtml);
    }

    const accuracy =
      typeof driverLocation.accuracy === 'number' &&
      Number.isFinite(driverLocation.accuracy) &&
      driverLocation.accuracy > 5
        ? Math.min(driverLocation.accuracy, 250)
        : null;

    if (accuracy) {
      if (!driverAccuracyCircleRef.current) {
        driverAccuracyCircleRef.current = L.circle(pos, {
          radius: accuracy,
          color: isStale ? '#f59e0b' : '#0ea5e9',
          fillColor: isStale ? '#f59e0b' : '#38bdf8',
          fillOpacity: 0.12,
          weight: 1,
          interactive: false,
        }).addTo(map);
      } else {
        driverAccuracyCircleRef.current.setLatLng(pos);
        driverAccuracyCircleRef.current.setRadius(accuracy);
      }
    } else if (driverAccuracyCircleRef.current) {
      driverAccuracyCircleRef.current.remove();
      driverAccuracyCircleRef.current = null;
    }
  }, [
    driverLocation?.lat,
    driverLocation?.lng,
    driverLocation?.heading,
    driverLocation?.accuracy,
    driverLocation?.updatedAt,
    driverLocation?.isStale,
    viewerRole,
    assignedDriverTooltip,
  ]);

  // 5. Update Real Passenger GPS Dot (distinct from editable pickup pin)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!passengerLocation || !isValidCoordinate(passengerLocation.lat, passengerLocation.lng)) {
      if (passengerGpsMarkerRef.current) {
        passengerGpsMarkerRef.current.remove();
        passengerGpsMarkerRef.current = null;
      }
      if (passengerAccuracyCircleRef.current) {
        passengerAccuracyCircleRef.current.remove();
        passengerAccuracyCircleRef.current = null;
      }
      return;
    }

    const pos = L.latLng(passengerLocation.lat, passengerLocation.lng);
    if (!passengerGpsMarkerRef.current) {
      const marker = L.marker(pos, {
        icon: createCustomMarkerIcon('passenger_gps'),
        zIndexOffset: 800,
      }).addTo(map);
      marker.bindTooltip('Sua posição GPS atual', {
        direction: 'top',
        className: 'bg-slate-900 text-sky-300 text-[11px] font-bold rounded-lg px-2 py-1 border border-sky-500',
      });
      passengerGpsMarkerRef.current = marker;
    } else {
      passengerGpsMarkerRef.current.setLatLng(pos);
    }

    const accuracy =
      typeof passengerLocation.accuracy === 'number' &&
      Number.isFinite(passengerLocation.accuracy) &&
      passengerLocation.accuracy > 5
        ? Math.min(passengerLocation.accuracy, 200)
        : null;

    if (accuracy) {
      if (!passengerAccuracyCircleRef.current) {
        passengerAccuracyCircleRef.current = L.circle(pos, {
          radius: accuracy,
          color: '#2563eb',
          fillColor: '#60a5fa',
          fillOpacity: 0.12,
          weight: 1,
          interactive: false,
        }).addTo(map);
      } else {
        passengerAccuracyCircleRef.current.setLatLng(pos);
        passengerAccuracyCircleRef.current.setRadius(accuracy);
      }
    } else if (passengerAccuracyCircleRef.current) {
      passengerAccuracyCircleRef.current.remove();
      passengerAccuracyCircleRef.current = null;
    }
  }, [passengerLocation?.lat, passengerLocation?.lng, passengerLocation?.accuracy]);

  // 6. Update Online Drivers Layer (strict GPS freshness + HTML-escaped tooltips)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = driversLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    safeDrivers.forEach((d) => {
      if (!d.currentLocation || !isValidCoordinate(d.currentLocation.lat, d.currentLocation.lng)) {
        return;
      }
      if (d.currentLocation.updatedAt && !isGpsFresh(d.currentLocation.updatedAt)) {
        return;
      }

      const isSelected = selectedDriverId === d.uid;
      const isBicycle = d.vehicle?.type === 'bicycle';
      const isMoto = d.vehicle?.type === 'motorcycle' || d.isCourier;
      const iconEmoji = isBicycle ? '🚲' : isMoto ? '🛵' : '🚗';

      const marker = L.marker([d.currentLocation.lat, d.currentLocation.lng], {
        icon: L.divIcon({
          className: `custom-driver-marker ${isSelected ? 'selected' : ''}`,
          html: `
            <div style="
              width: ${isSelected ? '38px' : '30px'};
              height: ${isSelected ? '38px' : '30px'};
              border-radius: 50%;
              background: ${isSelected ? '#10b981' : isBicycle ? '#0284c7' : '#facc15'};
              border: ${isSelected ? '3px solid #ffffff' : '2px solid #000000'};
              box-shadow: ${isSelected ? '0 0 18px rgba(16, 185, 129, 0.95)' : '0 2px 8px rgba(0,0,0,0.5)'};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? '18px' : '14px'};
              cursor: pointer;
              transition: transform 0.2s;
            ">
              ${iconEmoji}
            </div>
          `,
          iconSize: isSelected ? [38, 38] : [30, 30],
          iconAnchor: isSelected ? [19, 19] : [15, 15],
        }),
      });

      const safeName = escapeHtml(d.name);
      const safeVehicle = escapeHtml(`${d.vehicle?.brand || ''} ${d.vehicle?.model || ''}`.trim());
      const safeRating = Number.isFinite(d.rating) ? d.rating.toFixed(1) : '5.0';

      marker.bindTooltip(
        `<strong>${safeName}</strong> • ${safeVehicle}<br/><span style="color:#10b981">⭐ ${safeRating}</span> • Clique para escolher`,
        {
          direction: 'top',
          className: 'bg-slate-900 text-slate-100 text-[11px] rounded-lg p-2 border border-slate-700 shadow-xl',
        }
      );

      marker.on('click', () => {
        onDriverSelectRef.current?.(d);
      });

      layer.addLayer(marker);
    });
  }, [safeDrivers, selectedDriverId]);

  // 7. Determine authoritative route endpoints based on mode (ZERO coordinate inversion)
  const routeOrigin =
    mode === 'driver_to_pickup' || mode === 'driver_to_destination'
      ? driverLocation && isValidCoordinate(driverLocation.lat, driverLocation.lng)
        ? { lat: driverLocation.lat, lng: driverLocation.lng }
        : null
      : pickup && isValidCoordinate(pickup.lat, pickup.lng)
        ? { lat: pickup.lat, lng: pickup.lng }
        : null;

  const routeTarget =
    mode === 'driver_to_pickup'
      ? pickup && isValidCoordinate(pickup.lat, pickup.lng)
        ? { lat: pickup.lat, lng: pickup.lng }
        : null
      : destination && isValidCoordinate(destination.lat, destination.lng)
        ? { lat: destination.lat, lng: destination.lng }
        : null;

  // 8. Smart Camera Framing (fits on mode/target/initial point changes without fighting user pan during live GPS ticks)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const contextKey = [
      mode,
      pickup?.lat?.toFixed(4) ?? '',
      pickup?.lng?.toFixed(4) ?? '',
      destination?.lat?.toFixed(4) ?? '',
      destination?.lng?.toFixed(4) ?? '',
      !pickup && !destination && driverLocation ? 'driver-only' : '',
    ].join('|');

    if (contextKey === hasFittedContextKeyRef.current) return;

    const points: [number, number][] = [];
    if (pickup && isValidCoordinate(pickup.lat, pickup.lng)) points.push([pickup.lat, pickup.lng]);
    if (destination && isValidCoordinate(destination.lat, destination.lng)) {
      points.push([destination.lat, destination.lng]);
    }
    if (driverLocation && isValidCoordinate(driverLocation.lat, driverLocation.lng)) {
      points.push([driverLocation.lat, driverLocation.lng]);
    }

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [64, 64], maxZoom: 15 });
      hasFittedContextKeyRef.current = contextKey;
    } else if (points.length === 1) {
      map.setView(points[0], 15);
      hasFittedContextKeyRef.current = contextKey;
    } else if (passengerLocation && isValidCoordinate(passengerLocation.lat, passengerLocation.lng)) {
      map.setView([passengerLocation.lat, passengerLocation.lng], 15);
    }
  }, [
    mode,
    pickup?.lat,
    pickup?.lng,
    destination?.lat,
    destination?.lng,
    Boolean(driverLocation),
    passengerLocation?.lat,
    passengerLocation?.lng,
  ]);

  // 9. Real Road Routing + Automatic Off-Route Recalculation Engine (NEVER draws straight lines)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!routeOrigin || !routeTarget) {
      routeAbortRef.current?.abort();
      routeSeqRef.current += 1;
      clearRouteLayers();
      updateRouteInfo(null);
      updateRouteError(null);
      setLoadingRoute(false);
      setRecalculatingRoute(false);
      return;
    }

    const modeChanged = lastRouteModeRef.current !== mode;
    if (modeChanged) {
      clearRouteLayers();
      lastRouteModeRef.current = mode;
    }

    const isLiveNavigation = mode === 'driver_to_pickup' || mode === 'driver_to_destination';

    // In live navigation modes, check if driver is still on-route or deviated significantly
    let decision: ReturnType<typeof shouldRecalculateRoute> = {
      shouldRecalculate: true,
      reason: 'initial',
    };

    if (isLiveNavigation && activeRouteCoordsRef.current && routeRetryToken === 0) {
      decision = shouldRecalculateRoute({
        currentPos: routeOrigin,
        currentAccuracyMeters: driverLocation?.accuracy ?? null,
        activePolyline: activeRouteCoordsRef.current,
        lastRouteOrigin: lastRouteOriginRef.current,
        target: routeTarget,
        lastRouteTarget: lastRouteTargetRef.current,
        lastCalculatedAtMs: lastRouteCalculatedAtRef.current,
      });

      if (!decision.shouldRecalculate) {
        // Still on-route: smoothly trim traversed portion of polyline and update remaining ETA/distance
        const trimmed = trimPolylineFromPosition(routeOrigin, activeRouteCoordsRef.current);
        if (trimmed) {
          drawRoutePolyline(map, trimmed.coords, mode);
          const remainingKm = Math.max(0.1, Math.round((trimmed.remainingDistanceMeters / 1000) * 10) / 10);
          const ratio =
            activeRouteTotalMetersRef.current > 0
              ? Math.max(0, Math.min(1, trimmed.remainingDistanceMeters / activeRouteTotalMetersRef.current))
              : 1;
          const remainingMin = Math.max(1, Math.round(activeRouteTotalMinutesRef.current * ratio));
          updateRouteInfo({
            distanceKm: remainingKm,
            durationMinutes: remainingMin,
            recalculated: false,
          });
        }
        return;
      }
    }

    // Cancel any superseded routing request before dispatching the new one
    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;
    const seq = ++routeSeqRef.current;

    const isOffRouteRecalc = decision.reason === 'off_route';
    setLoadingRoute(true);
    setRecalculatingRoute(isOffRouteRecalc);
    updateRouteError(null);

    const fetchRoute = async () => {
      try {
        const result = await mapsApi.getDirections(
          routeOrigin.lat,
          routeOrigin.lng,
          routeTarget.lat,
          routeTarget.lng,
          controller.signal
        );

        if (seq !== routeSeqRef.current || controller.signal.aborted) return;

        activeRouteCoordsRef.current = result.coords;
        activeRouteTotalMetersRef.current = Math.max(1, result.distanceKm * 1000);
        activeRouteTotalMinutesRef.current = Math.max(1, result.durationMin);
        lastRouteOriginRef.current = { lat: routeOrigin.lat, lng: routeOrigin.lng };
        lastRouteTargetRef.current = { lat: routeTarget.lat, lng: routeTarget.lng };
        lastRouteModeRef.current = mode;
        lastRouteCalculatedAtRef.current = Date.now();

        const polyline = drawRoutePolyline(map, result.coords, mode);

        updateRouteInfo({
          distanceKm: result.distanceKm,
          durationMinutes: result.durationMin,
          recalculated: isOffRouteRecalc,
          provider: result.provider,
        });
        updateRouteError(null);

        // Fit bounds on initial route, planning mode changes, or off-route recalculation
        if (!isLiveNavigation || decision.reason === 'initial' || decision.reason === 'destination_changed' || isOffRouteRecalc) {
          map.fitBounds(polyline.getBounds(), { padding: [64, 64], maxZoom: 15 });
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted || seq !== routeSeqRef.current) {
          return;
        }
        // NEVER draw a fake straight line when road routing fails!
        clearRouteLayers();
        updateRouteInfo(null);
        updateRouteError(
          err?.message ||
            'Não foi possível calcular a rota viária no momento. Verifique sua conexão e tente novamente.'
        );
      } finally {
        if (seq === routeSeqRef.current) {
          setLoadingRoute(false);
          setRecalculatingRoute(false);
        }
      }
    };

    fetchRoute();

    return () => {
      controller.abort();
    };
  }, [
    mode,
    routeOrigin?.lat,
    routeOrigin?.lng,
    routeTarget?.lat,
    routeTarget?.lng,
    driverLocation?.accuracy,
    routeRetryToken,
    clearRouteLayers,
    drawRoutePolyline,
    updateRouteInfo,
    updateRouteError,
  ]);

  const handleLocateGps = () => {
    if (onLocateGpsRequest) {
      onLocateGpsRequest();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showTemporaryNotice('Seu navegador não suporta geolocalização.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocatingGps(false);
        const { latitude, longitude } = pos.coords;
        if (!isValidCoordinate(latitude, longitude)) {
          showTemporaryNotice('Coordenadas GPS inválidas recebidas do dispositivo.');
          return;
        }
        const map = mapInstanceRef.current;
        if (map) {
          map.setView([latitude, longitude], 16);
        }
        if (modeRef.current === 'planning' && onPickupChangeRef.current) {
          if (enforceAreaRef.current) {
            const validation = validateOperationalPoint(latitude, longitude, 'Sua localização atual');
            if (!validation.valid) {
              showTemporaryNotice(validation.message || 'Sua localização atual está fora de São Sebastião.');
              return;
            }
          }
          const address = await reverseGeocode(latitude, longitude);
          onPickupChangeRef.current(latitude, longitude, address);
        }
      },
      (err) => {
        setLocatingGps(false);
        if (err.code === 1) {
          showTemporaryNotice('Permissão de GPS negada. Ative a localização no navegador.');
        } else {
          showTemporaryNotice('Não foi possível obter sua localização GPS agora.');
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  };

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.fitBounds(routePolylineRef.current.getBounds(), { padding: [64, 64], maxZoom: 16 });
      return;
    }

    const points: [number, number][] = [];
    if (pickup && isValidCoordinate(pickup.lat, pickup.lng)) points.push([pickup.lat, pickup.lng]);
    if (destination && isValidCoordinate(destination.lat, destination.lng)) {
      points.push([destination.lat, destination.lng]);
    }
    if (driverLocation && isValidCoordinate(driverLocation.lat, driverLocation.lng)) {
      points.push([driverLocation.lat, driverLocation.lng]);
    }

    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [64, 64], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 15);
    } else if (passengerLocation && isValidCoordinate(passengerLocation.lat, passengerLocation.lng)) {
      map.setView([passengerLocation.lat, passengerLocation.lng], 15);
    } else {
      map.setView([SAO_SEBASTIAO_CENTER.lat, SAO_SEBASTIAO_CENTER.lng], 13);
    }
  };

  const externalNavTarget =
    mode === 'driver_to_pickup' ? pickup : destination || pickup;
  const externalOriginQuery =
    driverLocation && isValidCoordinate(driverLocation.lat, driverLocation.lng)
      ? `&origin=${driverLocation.lat},${driverLocation.lng}`
      : '';

  const waitingForDriverGps =
    (mode === 'driver_to_pickup' || mode === 'driver_to_destination') &&
    (!driverLocation || !isValidCoordinate(driverLocation.lat, driverLocation.lng));

  return (
    <div
      style={{ height }}
      className={`relative w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 ${className}`}
    >
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top HUD & Controls */}
      <div className="absolute top-3 left-3 right-3 z-[400] pointer-events-none flex items-start justify-between gap-2">
        {showHud ? (
          <div className="bg-slate-950/92 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-xl text-xs flex flex-wrap items-center gap-2 pointer-events-auto max-w-[75%]">
            <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold text-white text-[11px] sm:text-xs truncate">
              {hudTitle ||
                (mode === 'driver_to_pickup'
                  ? 'Rota até o Embarque • GPS Ao Vivo'
                  : mode === 'driver_to_destination'
                    ? 'Em Trânsito até o Destino'
                    : 'São Sebastião • Litoral Norte SP')}
            </span>
            {routeInfo && (
              <span className="inline-block px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold text-[10px]">
                {routeInfo.distanceKm} km (~{routeInfo.durationMinutes} min)
              </span>
            )}
            {recalculatingRoute && (
              <span className="inline-block px-2 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-amber-300 font-bold text-[10px] animate-pulse">
                Recalculando rota...
              </span>
            )}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          {showHud && externalNavTarget && isValidCoordinate(externalNavTarget.lat, externalNavTarget.lng) && (
            <div className="flex items-center gap-1.5">
              <a
                href={`https://www.google.com/maps/dir/?api=1${externalOriginQuery}&destination=${externalNavTarget.lat},${externalNavTarget.lng}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xl transition-all"
                title="Abrir rota no Google Maps"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Google Maps</span>
              </a>
              <a
                href={`https://waze.com/ul?ll=${externalNavTarget.lat},${externalNavTarget.lng}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xl transition-all"
                title="Abrir rota no Waze"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Waze</span>
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={handleLocateGps}
            disabled={locatingGps}
            className="p-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-emerald-400 hover:border-emerald-500 transition-colors shadow-xl"
            title="Centralizar no meu GPS real"
            aria-label="Centralizar no meu GPS real"
          >
            <LocateFixed className={`w-4 h-4 ${locatingGps ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            className="p-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-emerald-400 hover:border-emerald-500 transition-colors shadow-xl"
            title="Enquadrar rota no mapa"
            aria-label="Enquadrar rota no mapa"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Explicit Route / Tile / Area Validation Banners */}
      {(routeError || mapNotice || tileError || waitingForDriverGps) && (
        <div className="absolute top-16 left-3 right-3 z-[400] pointer-events-none flex flex-col items-center gap-2">
          {routeError && (
            <div
              role="alert"
              className="pointer-events-auto bg-rose-950/95 backdrop-blur-md border border-rose-500 text-rose-200 text-xs px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2.5 max-w-md"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="leading-snug">{routeError}</span>
              <button
                type="button"
                onClick={() => setRouteRetryToken((n) => n + 1)}
                className="ml-auto px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center gap-1 shrink-0"
              >
                <RefreshCw className="w-3 h-3" /> Tentar
              </button>
            </div>
          )}

          {waitingForDriverGps && !routeError && (
            <div className="pointer-events-auto bg-amber-950/95 backdrop-blur-md border border-amber-500/70 text-amber-200 text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 max-w-md">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {mode === 'driver_to_pickup'
                  ? 'Aguardando sinal de GPS real do motorista para traçar a rota até o embarque...'
                  : 'Aguardando sinal de GPS real para atualizar a rota até o destino...'}
              </span>
            </div>
          )}

          {mapNotice && (
            <div
              role="status"
              className="pointer-events-auto bg-amber-950/95 backdrop-blur-md border border-amber-500 text-amber-200 text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 max-w-md"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{mapNotice}</span>
            </div>
          )}

          {tileError && (
            <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-600 text-slate-200 text-[11px] px-3 py-1.5 rounded-xl shadow-lg">
              Falha temporária ao carregar imagens do mapa. Verifique sua conexão.
            </div>
          )}
        </div>
      )}

      {/* Bottom HUD: Dynamic Guidance */}
      {showHud && (
        <div className="absolute bottom-3 left-3 right-12 z-[400] pointer-events-none flex justify-center">
          {mode === 'driver_to_pickup' ? (
            <div className="bg-slate-950/95 backdrop-blur-md border border-emerald-500/80 rounded-xl px-3.5 py-2 shadow-2xl text-[11px] text-slate-200 flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
              <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
                {viewerRole === 'driver' ? 'Indo até o Embarque:' : 'Motorista a caminho do Embarque:'}
              </span>
              <span className="text-white font-medium truncate max-w-[200px] sm:max-w-xs">
                {pickup?.address || pickupLabel || 'Ponto de embarque'}
              </span>
              {routeInfo && (
                <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 font-extrabold text-[10px]">
                  {routeInfo.distanceKm} km • ~{routeInfo.durationMinutes} min
                </span>
              )}
              {driverLocation?.isStale && (
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold text-[10px]">
                  Última posição {formatTelemetryAge(driverLocation.updatedAt)}
                </span>
              )}
              {loadingRoute && (
                <span className="text-emerald-300 text-[10px] animate-pulse">
                  {recalculatingRoute ? 'Recalculando desvio...' : 'Calculando rota...'}
                </span>
              )}
            </div>
          ) : mode === 'driver_to_destination' ? (
            <div className="bg-slate-950/95 backdrop-blur-md border border-cyan-500/80 rounded-xl px-3.5 py-2 shadow-2xl text-[11px] text-slate-200 flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
              <span className="flex items-center gap-1.5 font-bold text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm animate-pulse" />
                Em Trânsito para o Destino:
              </span>
              <span className="text-white font-medium truncate max-w-[200px] sm:max-w-xs">
                {destination?.address || destinationLabel || 'Destino'}
              </span>
              {routeInfo && (
                <span className="px-2 py-0.5 rounded bg-cyan-900/80 text-cyan-300 font-extrabold text-[10px]">
                  {routeInfo.distanceKm} km • ~{routeInfo.durationMinutes} min restantes
                </span>
              )}
              {driverLocation?.isStale && (
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold text-[10px]">
                  Última posição {formatTelemetryAge(driverLocation.updatedAt)}
                </span>
              )}
              {loadingRoute && (
                <span className="text-cyan-300 text-[10px] animate-pulse">
                  {recalculatingRoute ? 'Recalculando desvio...' : 'Atualizando rota...'}
                </span>
              )}
            </div>
          ) : pickup?.lat || destination?.lat ? (
            <div className="bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-2xl text-[11px] text-slate-200 flex flex-wrap items-center justify-center gap-2 sm:gap-4 pointer-events-auto">
              {pickup && isValidCoordinate(pickup.lat, pickup.lng) && (
                <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                  {pickupLabel || 'Embarque'}
                </span>
              )}
              {pickup && destination && <span className="text-slate-600 hidden sm:inline">|</span>}
              {destination && isValidCoordinate(destination.lat, destination.lng) && (
                <span className="flex items-center gap-1.5 font-bold text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
                  {destinationLabel || 'Destino'}
                </span>
              )}
              {loadingRoute && (
                <span className="text-emerald-300 text-[10px] animate-pulse">
                  Calculando rota viária...
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default MapDisplay;
