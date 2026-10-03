import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PublicDriverMarker } from '../api/drivers.js';
import { mapsApi } from '../api/maps.js';
import { Navigation, Crosshair, LocateFixed } from 'lucide-react';

interface MapProps {
  pickup: { lat: number; lng: number; address?: string };
  destination?: { lat: number; lng: number; address?: string } | null;
  onPickupChange?: (lat: number, lng: number, address?: string) => void;
  onDestinationChange?: (lat: number, lng: number, address?: string) => void;
  onMapClick?: (lat: number, lng: number, address?: string) => void;
  drivers?: PublicDriverMarker[];
  driverLocation?: { lat: number; lng: number; heading?: number } | null;
  selectedDriverId?: string | null;
  onDriverSelect?: (driver: PublicDriverMarker) => void;
  height?: string;
  className?: string;
}

const DEFAULT_CENTER = {
  lat: -23.8055,
  lng: -45.4011, // Centro de São Sebastião - SP
};

// Custom high-visibility SVG Teardrop Pins with Floating Badges
function createCustomMarkerIcon(type: 'pickup' | 'destination' | 'driver' | 'assigned') {
  if (type === 'pickup') {
    return L.divIcon({
      className: 'custom-pickup-marker-icon',
      html: `
        <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:grab;">
          <!-- Floating Pill Badge -->
          <div style="
            background: #064e3b;
            color: #ecfdf5;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 9999px;
            border: 1.5px solid #34d399;
            box-shadow: 0 4px 14px rgba(0,0,0,0.6);
            white-space: nowrap;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 4px;
            pointer-events: none;
          ">
            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#34d399; box-shadow:0 0 6px #34d399;"></span>
            Partida (Arraste)
          </div>

          <!-- Teardrop Pin with Needle pointing to exact GPS -->
          <div style="position:relative; width:36px; height:44px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));">
            <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 44 18 44C18 44 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="#10b981"/>
              <path d="M18 2C9.16344 2 2 9.16344 2 18C2 28.5 18 41.5 18 41.5C18 41.5 34 28.5 34 18C34 9.16344 26.8366 2 18 2Z" fill="#059669"/>
              <circle cx="18" cy="17" r="8" fill="#ffffff"/>
              <circle cx="18" cy="17" r="4.5" fill="#10b981"/>
            </svg>
          </div>

          <!-- Ground Contact Shadow -->
          <div style="width:14px; height:4px; border-radius:50%; background:rgba(0,0,0,0.35); filter:blur(1px); margin-top:-2px;"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  if (type === 'destination') {
    return L.divIcon({
      className: 'custom-destination-marker-icon',
      html: `
        <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:grab;">
          <!-- Floating Pill Badge -->
          <div style="
            background: #881337;
            color: #fff1f2;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 9999px;
            border: 1.5px solid #fb7185;
            box-shadow: 0 4px 14px rgba(0,0,0,0.6);
            white-space: nowrap;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 4px;
            pointer-events: none;
          ">
            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#fb7185; box-shadow:0 0 6px #fb7185;"></span>
            Destino (Arraste)
          </div>

          <!-- Teardrop Pin with Needle pointing to exact GPS -->
          <div style="position:relative; width:36px; height:44px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));">
            <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 44 18 44C18 44 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="#f43f5e"/>
              <path d="M18 2C9.16344 2 2 9.16344 2 18C2 28.5 18 41.5 18 41.5C18 41.5 34 28.5 34 18C34 9.16344 26.8366 2 18 2Z" fill="#e11d48"/>
              <circle cx="18" cy="17" r="8" fill="#ffffff"/>
              <circle cx="18" cy="17" r="4.5" fill="#f43f5e"/>
            </svg>
          </div>

          <!-- Ground Contact Shadow -->
          <div style="width:14px; height:4px; border-radius:50%; background:rgba(0,0,0,0.35); filter:blur(1px); margin-top:-2px;"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
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
  selectedDriverId,
  onDriverSelect,
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

  // Callbacks in refs to avoid rebuilding the map on re-renders
  const onPickupChangeRef = useRef(onPickupChange);
  onPickupChangeRef.current = onPickupChange;
  const onDestinationChangeRef = useRef(onDestinationChange);
  onDestinationChangeRef.current = onDestinationChange;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onDriverSelectRef = useRef(onDriverSelect);
  onDriverSelectRef.current = onDriverSelect;

  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);

  // Reverse geocoding helper
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await mapsApi.reverseGeocode(lat, lng);
      return res.address;
    } catch {
      return `Ponto (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  }, []);

  // 1. Initialize Leaflet Map ONCE
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

    // OpenStreetMap standard street tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Create LayerGroup for drivers
    driversLayerRef.current = L.layerGroup().addTo(map);

    // Interactive Map Click Handler: Opens quick selector popup
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const address = await reverseGeocode(lat, lng);

      const popupContainer = document.createElement('div');
      popupContainer.style.fontFamily = 'inherit';
      popupContainer.style.textAlign = 'center';
      popupContainer.style.padding = '4px 2px';

      popupContainer.innerHTML = `
        <div style="font-weight:700; font-size:11px; color:#0f172a; margin-bottom:8px; line-height:1.3; max-width:200px;">
          📍 ${address}
        </div>
        <div style="display:flex; gap:6px; justify-content:center;">
          <button id="btn-click-pickup" style="background:#059669; color:#fff; font-size:10px; font-weight:800; border:none; border-radius:6px; padding:6px 9px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
            🟢 Definir Partida
          </button>
          <button id="btn-click-dest" style="background:#e11d48; color:#fff; font-size:10px; font-weight:800; border:none; border-radius:6px; padding:6px 9px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
            🔴 Definir Destino
          </button>
        </div>
      `;

      const popup = L.popup({
        closeButton: true,
        className: 'custom-click-selector-popup',
        offset: [0, -10],
      })
        .setLatLng([lat, lng])
        .setContent(popupContainer)
        .openOn(map);

      setTimeout(() => {
        popupContainer.querySelector('#btn-click-pickup')?.addEventListener('click', () => {
          map.closePopup();
          onPickupChangeRef.current?.(lat, lng, address);
        });
        popupContainer.querySelector('#btn-click-dest')?.addEventListener('click', () => {
          map.closePopup();
          onDestinationChangeRef.current?.(lat, lng, address);
        });
      }, 50);

      onMapClickRef.current?.(lat, lng, address);
    });

    mapInstanceRef.current = map;

    // ResizeObserver ensures map tile alignment on flex/grid resize
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(mapContainerRef.current);

    setTimeout(() => map.invalidateSize(), 150);
    setTimeout(() => map.invalidateSize(), 500);

    return () => {
      ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      pickupMarkerRef.current = null;
      destinationMarkerRef.current = null;
      routePolylineRef.current = null;
      routeShadowPolylineRef.current = null;
      driversLayerRef.current = null;
    };
  }, [reverseGeocode]);

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
        draggable: true,
        title: 'Ponto de Partida (Arraste para ajustar)',
        zIndexOffset: 1000,
      }).addTo(map);

      marker.bindTooltip(pickup.address || 'Ponto de Partida (Arraste)', {
        permanent: false,
        direction: 'top',
        className: 'bg-slate-900 text-emerald-300 text-xs font-bold border border-emerald-500 rounded-lg px-2.5 py-1 shadow-xl',
      });

      marker.on('dragend', async () => {
        const newPos = marker.getLatLng();
        const address = await reverseGeocode(newPos.lat, newPos.lng);
        marker.setTooltipContent(address);
        onPickupChangeRef.current?.(newPos.lat, newPos.lng, address);
      });

      pickupMarkerRef.current = marker;
    } else {
      pickupMarkerRef.current.setLatLng(pos);
      if (pickup.address) {
        pickupMarkerRef.current.setTooltipContent(pickup.address);
      }
    }
  }, [pickup?.lat, pickup?.lng, pickup?.address, reverseGeocode]);

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
        draggable: true,
        title: 'Destino (Arraste para ajustar)',
        zIndexOffset: 1000,
      }).addTo(map);

      marker.bindTooltip(destination.address || 'Destino (Arraste)', {
        permanent: false,
        direction: 'top',
        className: 'bg-slate-900 text-rose-300 text-xs font-bold border border-rose-500 rounded-lg px-2.5 py-1 shadow-xl',
      });

      marker.on('dragend', async () => {
        const newPos = marker.getLatLng();
        const address = await reverseGeocode(newPos.lat, newPos.lng);
        marker.setTooltipContent(address);
        onDestinationChangeRef.current?.(newPos.lat, newPos.lng, address);
      });

      destinationMarkerRef.current = marker;
    } else {
      destinationMarkerRef.current.setLatLng(pos);
      if (destination.address) {
        destinationMarkerRef.current.setTooltipContent(destination.address);
      }
    }
  }, [destination?.lat, destination?.lng, destination?.address, reverseGeocode]);

  // 4. Update Online Drivers Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = driversLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    drivers.forEach((d) => {
      if (d.currentLocation?.lat && d.currentLocation?.lng) {
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

        marker.bindTooltip(
          `<strong>${d.name}</strong> • ${d.vehicle.brand} ${d.vehicle.model}<br/><span style="color:#10b981">⭐ ${d.rating.toFixed(1)}</span> • Clique para escolher`,
          {
            direction: 'top',
            className: 'bg-slate-900 text-slate-100 text-[11px] rounded-lg p-2 border border-slate-700 shadow-xl',
          }
        );

        marker.on('click', () => {
          onDriverSelectRef.current?.(d);
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
  }, [drivers, driverLocation, selectedDriverId]);

  // 5. Fit bounds to keep both pickup and destination fully visible
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (pickup?.lat && pickup?.lng && destination?.lat && destination?.lng) {
      const bounds = L.latLngBounds(
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng]
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (pickup?.lat && pickup?.lng) {
      map.setView([pickup.lat, pickup.lng], 15);
    } else if (destination?.lat && destination?.lng) {
      map.setView([destination.lat, destination.lng], 15);
    }
  }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]);

  // 6. Calculate and Render Real Driving Route (OSRM)
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
        const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
        if (!res.ok) throw new Error('OSRM error');
        const data = await res.json();

        if (isCancelled) return;

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          const coords: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

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

          // Fit route with padding
          map.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 15 });
          return;
        }
      } catch {
        // Fallback: straight line
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
        map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
      } finally {
        if (!isCancelled) setLoadingRoute(false);
      }
    };

    fetchRoute();

    return () => {
      isCancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]);

  const handleLocateGps = () => {
    if (!navigator.geolocation) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocatingGps(false);
        const { latitude, longitude } = pos.coords;
        const map = mapInstanceRef.current;
        if (map) {
          map.setView([latitude, longitude], 16);
        }
        const address = await reverseGeocode(latitude, longitude);
        onPickupChangeRef.current?.(latitude, longitude, address);
      },
      (err) => {
        setLocatingGps(false);
        console.warn('Map locate GPS error:', err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.fitBounds(routePolylineRef.current.getBounds(), { padding: [60, 60] });
    } else if (pickup?.lat && pickup?.lng && destination?.lat && destination?.lng) {
      const bounds = L.latLngBounds([pickup.lat, pickup.lng], [destination.lat, destination.lng]);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else if (pickup?.lat && pickup?.lng) {
      map.setView([pickup.lat, pickup.lng], 15);
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
            onClick={handleLocateGps}
            disabled={locatingGps}
            className="p-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-emerald-400 hover:border-emerald-500 transition-colors shadow-xl"
            title="Localizar meu GPS exato no mapa"
          >
            <LocateFixed className={`w-4 h-4 ${locatingGps ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
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
        <div className="bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-2xl text-[11px] text-slate-200 flex flex-wrap items-center justify-center gap-2 sm:gap-4 pointer-events-auto">
          <span className="flex items-center gap-1.5 font-bold text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
            Ponto de Partida (Arraste o pino verde)
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="flex items-center gap-1.5 font-bold text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm animate-pulse" />
            Destino (Arraste o pino vermelho ou clique no mapa)
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
