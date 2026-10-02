import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { PublicDriverMarker } from '../api/drivers.js';
import { MapPin, Navigation, Car, AlertCircle } from 'lucide-react';

interface MapProps {
  pickup: { lat: number; lng: number; address?: string };
  destination?: { lat: number; lng: number; address?: string } | null;
  onPickupChange?: (lat: number, lng: number) => void;
  drivers?: PublicDriverMarker[];
  driverLocation?: { lat: number; lng: number; heading?: number } | null;
  height?: string;
  className?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '12px',
};

const defaultCenter = {
  lat: -23.8055,
  lng: -45.4011, // Centro de São Sebastião
};

export const MapDisplay: React.FC<MapProps> = ({
  pickup,
  destination,
  onPickupChange,
  drivers = [],
  driverLocation,
  height = '400px',
  className = '',
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const center = useMemo(() => {
    if (pickup?.lat && pickup?.lng) {
      return { lat: pickup.lat, lng: pickup.lng };
    }
    return defaultCenter;
  }, [pickup]);

  const onLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fit bounds when both pickup and destination are provided
  useEffect(() => {
    if (map && destination && pickup && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(destination);
      map.fitBounds(bounds, 50);
    }
  }, [map, pickup, destination]);

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && onPickupChange) {
      onPickupChange(e.latLng.lat(), e.latLng.lng());
    }
  };

  // Route points array for polyline
  const routePath = useMemo(() => {
    if (pickup && destination) {
      return [
        { lat: pickup.lat, lng: pickup.lng },
        { lat: destination.lat, lng: destination.lng },
      ];
    }
    return [];
  }, [pickup, destination]);

  // If Google Maps API is loaded without error
  if (isLoaded && !loadError && apiKey) {
    return (
      <div style={{ height }} className={`relative w-full rounded-xl overflow-hidden shadow-2xl border border-slate-800 ${className}`}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={14}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            styles: [
              { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
              { elementType: 'labels.text.stroke', stylers: [{ color: '#020617' }] },
              { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
              { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
              { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
              { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#16a34a' }] },
              { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
            ],
          }}
        >
          {/* Draggable Pickup Marker */}
          {pickup && (
            <Marker
              position={{ lat: pickup.lat, lng: pickup.lng }}
              draggable={!!onPickupChange}
              onDragEnd={handleMarkerDragEnd}
              title="Local de Partida (Arraste para ajustar)"
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                scale: 10,
                fillColor: '#22c55e',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              }}
            />
          )}

          {/* Destination Marker */}
          {destination && (
            <Marker
              position={{ lat: destination.lat, lng: destination.lng }}
              title="Destino da Corrida"
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                scale: 10,
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              }}
            />
          )}

          {/* Online Drivers Markers */}
          {drivers.map(
            (d) =>
              d.currentLocation && (
                <Marker
                  key={d.uid}
                  position={{ lat: d.currentLocation.lat, lng: d.currentLocation.lng }}
                  title={`Motorista: ${d.name} (${d.vehicle.model})`}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.FORWARD_CLOSED_ARROW || 0,
                    scale: 6,
                    fillColor: '#facc15',
                    fillOpacity: 1,
                    strokeColor: '#000000',
                    strokeWeight: 2,
                    rotation: d.currentLocation.heading || 0,
                  }}
                />
              )
          )}

          {/* Assigned Driver Live Marker */}
          {driverLocation && (
            <Marker
              position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
              title="Seu Motorista"
              icon={{
                path: window.google?.maps?.SymbolPath?.FORWARD_CLOSED_ARROW || 0,
                scale: 8,
                fillColor: '#16a34a',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
                rotation: driverLocation.heading || 0,
              }}
            />
          )}

          {/* Route Polyline */}
          {routePath.length > 1 && (
            <Polyline
              path={routePath}
              options={{
                strokeColor: '#22c55e',
                strokeOpacity: 0.85,
                strokeWeight: 4,
              }}
            />
          )}
        </GoogleMap>
      </div>
    );
  }

  // Interactive High-Fidelity São Sebastião Map Canvas Fallback
  return (
    <div
      style={{ height }}
      className={`relative w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex flex-col justify-between p-4 ${className}`}
    >
      {/* Background Visual Map Grid of São Sebastião */}
      <div className="absolute inset-0 bg-radial-gradient from-slate-900 to-slate-950 pointer-events-none opacity-80" />
      <svg className="absolute inset-0 w-full h-full stroke-slate-800/60 pointer-events-none" width="100%" height="100%">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* Coastal Line Contour */}
        <path
          d="M 50,20 Q 200,100 350,140 T 700,220 T 1100,320"
          fill="none"
          stroke="#16A34A"
          strokeWidth="3"
          strokeDasharray="6 4"
          className="opacity-40"
        />
      </svg>

      {/* Top Map HUD Status */}
      <div className="relative z-10 flex items-center justify-between bg-slate-950/80 backdrop-blur-md p-3 rounded-lg border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">Mapa Interativo — São Sebastião / SP</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>{drivers.length} motoristas online na região</span>
        </div>
      </div>

      {/* Center Interactive Visualization */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-6">
        <div className="w-full max-w-md bg-slate-950/90 border border-emerald-500/30 rounded-xl p-4 shadow-xl backdrop-blur-sm space-y-3">
          {/* Pickup info */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider">Partida / Embarque</span>
              <p className="text-sm font-semibold text-white truncate">{pickup?.address || 'Centro Histórico, São Sebastião'}</p>
              <span className="text-[11px] text-slate-400">GPS: {pickup?.lat.toFixed(4)}, {pickup?.lng.toFixed(4)}</span>
            </div>
          </div>

          {/* Destination info */}
          {destination && (
            <div className="flex items-start gap-3 pt-2 border-t border-slate-800">
              <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-400">
                <Navigation className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="text-[11px] font-bold uppercase text-rose-400 tracking-wider">Destino</span>
                <p className="text-sm font-semibold text-white truncate">{destination.address || 'Praia Selecionada'}</p>
                <span className="text-[11px] text-slate-400">GPS: {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}</span>
              </div>
            </div>
          )}

          {/* Active / Available Drivers in area */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Car className="w-4 h-4" /> Frota Local Ativa:
            </span>
            <span>{drivers.length > 0 ? `${drivers.length} veículos rastreados` : 'Buscando motoristas na zona...'}</span>
          </div>
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="relative z-10 text-[11px] text-slate-400 text-center bg-slate-950/60 backdrop-blur-sm py-1.5 px-3 rounded-lg border border-slate-800/60 flex items-center justify-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-emerald-400" />
        <span>Rastreamento georreferenciado contínuo em São Sebastião, Barequeçaba, Maresias e Costa Sul</span>
      </div>
    </div>
  );
};
