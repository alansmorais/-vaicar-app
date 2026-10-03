import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PublicDriverMarker } from '../api/drivers.js';
import { mapsApi } from '../api/maps.js';
import { Navigation, MapPin, Car, Crosshair, AlertCircle } from 'lucide-react';

interface MapProps {
  pickup: { lat: number; lng: number; address?: string };
  destination?: { lat: number; lng: number; address?: string } | null;
  onPickupChange?: (lat: number, lng: number, address?: string) => void;
  onDestinationChange?: (lat: number, lng: number, address?: string) => void;
  onMapClick?: (lat: number, lng: number, address?: string) => void;
  drivers?: PublicDriverMarker[];
  driverLocation?: { lat: number; lng: number; heading?: number } | null;
  height?: string;
  className?: string;
}

const DEFAULT_CENTER = {
  lat: -23.8055,
  lng: -45.4011, // Centro de São Sebastião - SP
};

// Custom SVG Icons for Leaflet
function createCustomMarkerIcon(type: 'pickup' | 'destination' | 'driver' | 'assigned') {
  if (type === 'pickup') {
    return L.divIcon({
      className: 'custom-pickup-marker',
      html: `
        <div style="
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #10b981;
          border: 3px solid #ffffff;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        ">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: #ffffff;"></div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }

  if (type === 'destination') {
    return L.divIcon({
      className: 'custom-destination-marker',
      html: `
        <div style="
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #ef4444;
          border: 3px solid #ffffff;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        ">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: #ffffff;"></div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }

  if (type === 'assigned') {
    return L.divIcon({
      className: 'custom-assigned-driver-marker',
      html: `
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #059669;
          border: 3px solid #ffffff;
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
        ">
          🚗
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }

  // Generic online driver
  return L.divIcon({
    className: 'custom-driver-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #facc15;
        border: 2px solid #000000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
      ">
        🚗
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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
  height = '480px',
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups / markers references
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const driversLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeShadowPolylineRef = useRef<L.Polyline | null>(null);

  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Reverse geocoding helper
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await mapsApi.reverseGeocode(lat, lng);
      return res.address;
    } catch {
      return `Ponto (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  }, []);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = pickup?.lat || DEFAULT_CENTER.lat;
    const initialLng = pickup?.lng || DEFAULT_CENTER.lng;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false,
    });

    // OpenStreetMap standard street tiles (100% open, reliable, no API key required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Create LayerGroup for drivers
    driversLayerRef.current = L.layerGroup().addTo(map);

    // Click handler on map
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const address = await reverseGeocode(lat, lng);
      if (onDestinationChange) {
        onDestinationChange(lat, lng, address);
      }
      if (onMapClick) {
        onMapClick(lat, lng, address);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [reverseGeocode, onDestinationChange, onMapClick]);

  // 2. Update Pickup Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!pickup?.lat || !pickup?.lng) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }
      return;
    }

    const pos = L.latLng(pickup.lat, pickup.lng);

    if (!pickupMarkerRef.current) {
      const marker = L.marker(pos, {
        icon: createCustomMarkerIcon('pickup'),
        draggable: !!onPickupChange,
        title: 'Ponto de Partida',
      }).addTo(map);

      marker.bindTooltip(pickup.address || 'Ponto de Partida', {
        permanent: false,
        direction: 'top',
        className: 'bg-slate-900 text-white text-xs border border-emerald-500 rounded-lg px-2 py-1',
      });

      marker.on('dragend', async () => {
        const newPos = marker.getLatLng();
        const address = await reverseGeocode(newPos.lat, newPos.lng);
        marker.setTooltipContent(address);
        onPickupChange?.(newPos.lat, newPos.lng, address);
      });

      pickupMarkerRef.current = marker;
    } else {
      pickupMarkerRef.current.setLatLng(pos);
      if (pickup.address) {
        pickupMarkerRef.current.setTooltipContent(pickup.address);
      }
    }
  }, [pickup, onPickupChange, reverseGeocode]);

  // 3. Update Destination Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!destination?.lat || !destination?.lng) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
      return;
    }

    const pos = L.latLng(destination.lat, destination.lng);

    if (!destinationMarkerRef.current) {
      const marker = L.marker(pos, {
        icon: createCustomMarkerIcon('destination'),
        draggable: !!onDestinationChange,
        title: 'Destino da Corrida',
      }).addTo(map);

      marker.bindTooltip(destination.address || 'Destino', {
        permanent: false,
        direction: 'top',
        className: 'bg-slate-900 text-white text-xs border border-rose-500 rounded-lg px-2 py-1',
      });

      marker.on('dragend', async () => {
        const newPos = marker.getLatLng();
        const address = await reverseGeocode(newPos.lat, newPos.lng);
        marker.setTooltipContent(address);
        onDestinationChange?.(newPos.lat, newPos.lng, address);
      });

      destinationMarkerRef.current = marker;
    } else {
      destinationMarkerRef.current.setLatLng(pos);
      if (destination.address) {
        destinationMarkerRef.current.setTooltipContent(destination.address);
      }
    }
  }, [destination, onDestinationChange, reverseGeocode]);

  // 4. Update Drivers Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = driversLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // Online drivers
    drivers.forEach((d) => {
      if (d.currentLocation?.lat && d.currentLocation?.lng) {
        const marker = L.marker([d.currentLocation.lat, d.currentLocation.lng], {
          icon: createCustomMarkerIcon('driver'),
        });
        marker.bindTooltip(`${d.name} (${d.vehicle.brand} ${d.vehicle.model})`, {
          direction: 'top',
          className: 'bg-slate-900 text-slate-100 text-[10px] rounded px-1.5 py-0.5 border border-slate-700',
        });
        layer.addLayer(marker);
      }
    });

    // Live Assigned Driver
    if (driverLocation?.lat && driverLocation?.lng) {
      const assignedMarker = L.marker([driverLocation.lat, driverLocation.lng], {
        icon: createCustomMarkerIcon('assigned'),
      });
      assignedMarker.bindTooltip('Seu Motorista está a caminho!', {
        direction: 'top',
        permanent: true,
        className: 'bg-emerald-950 text-emerald-300 font-bold text-xs rounded-lg px-2 py-1 border border-emerald-500',
      });
      layer.addLayer(assignedMarker);
    }
  }, [drivers, driverLocation]);

  // 5. Calculate and Render Real Driving Route (OSRM with fallback)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing route if either pickup or destination is missing
    if (!pickup?.lat || !pickup?.lng || !destination?.lat || !destination?.lng) {
      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }
      if (routeShadowPolylineRef.current) {
        routeShadowPolylineRef.current.remove();
        routeShadowPolylineRef.current = null;
      }
      setRouteInfo(null);
      return;
    }

    let isCancelled = false;
    setLoadingRoute(true);

    const fetchRoute = async () => {
      try {
        // Query OSRM driving service
        const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
        if (!res.ok) throw new Error('OSRM error');
        const data = await res.json();

        if (isCancelled) return;

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          const coords: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

          // Draw shadow and active polyline
          if (routeShadowPolylineRef.current) routeShadowPolylineRef.current.remove();
          if (routePolylineRef.current) routePolylineRef.current.remove();

          const shadow = L.polyline(coords, {
            color: '#064e3b',
            weight: 8,
            opacity: 0.6,
          }).addTo(map);

          const polyline = L.polyline(coords, {
            color: '#10b981',
            weight: 5,
            opacity: 0.95,
            lineJoin: 'round',
          }).addTo(map);

          routeShadowPolylineRef.current = shadow;
          routePolylineRef.current = polyline;

          setRouteInfo({
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
            durationMinutes: Math.max(3, Math.round(route.duration / 60)),
          });

          // Fit bounds smoothly with padding
          map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 16 });
          return;
        }
      } catch (err) {
        // Fallback: draw direct line connecting the points
        if (isCancelled) return;
        const straightCoords: [number, number][] = [
          [pickup.lat, pickup.lng],
          [destination.lat, destination.lng],
        ];

        if (routeShadowPolylineRef.current) routeShadowPolylineRef.current.remove();
        if (routePolylineRef.current) routePolylineRef.current.remove();

        const polyline = L.polyline(straightCoords, {
          color: '#10b981',
          weight: 4,
          opacity: 0.9,
          dashArray: '8, 8',
        }).addTo(map);

        routePolylineRef.current = polyline;
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      } finally {
        if (!isCancelled) setLoadingRoute(false);
      }
    };

    fetchRoute();

    return () => {
      isCancelled = true;
    };
  }, [pickup, destination]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.fitBounds(routePolylineRef.current.getBounds(), { padding: [50, 50] });
    } else if (pickup?.lat && pickup?.lng) {
      map.setView([pickup.lat, pickup.lng], 14);
    } else {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
    }
  };

  return (
    <div
      style={{ height }}
      className={`relative w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 ${className}`}
    >
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top HUD: Status & Active Drivers */}
      <div className="absolute top-3 left-3 right-3 z-[400] pointer-events-none flex items-center justify-between gap-2">
        <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-xl text-xs flex items-center gap-2 pointer-events-auto">
          <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-white text-[11px] sm:text-xs">
            São Sebastião • Litoral Norte SP
          </span>
          {routeInfo && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold text-[10px]">
              🛣️ {routeInfo.distanceKm} km (~{routeInfo.durationMinutes} min)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleRecenter}
            className="p-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-emerald-400 hover:border-emerald-500 transition-colors shadow-xl"
            title="Recentralizar Rota no Mapa"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom HUD: Draggable markers guidance */}
      <div className="absolute bottom-3 left-3 right-3 z-[400] pointer-events-none flex justify-center">
        <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-2xl text-[11px] text-slate-200 flex flex-wrap items-center justify-center gap-2 sm:gap-4 pointer-events-auto">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            Ponto de Partida (Arraste)
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="flex items-center gap-1.5 font-semibold text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
            Destino (Arraste ou clique no mapa)
          </span>
          {loadingRoute && (
            <span className="text-emerald-300 text-[10px] animate-pulse">
              Calculando melhor trajeto...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapDisplay;
