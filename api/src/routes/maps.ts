import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export const mapsRouter = Router();

// Key landmarks and zones in São Sebastião, SP for quick location selection
const KNOWN_LOCATIONS = [
  { name: 'Centro Histórico / Rua da Praia', address: 'Av. Dr. Altino Arantes, Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 },
  { name: 'Balsa São Sebastião - Ilhabela', address: 'Av. Antônio Januário do Amaral, Centro, São Sebastião - SP', lat: -23.8166, lng: -45.3995 },
  { name: 'Terminal Rodoviário de São Sebastião', address: 'Praça da Bíblia, Centro, São Sebastião - SP', lat: -23.8078, lng: -45.4042 },
  { name: 'Porto Grande', address: 'Av. Guarda Mor Lobo Viana, Porto Grande, São Sebastião - SP', lat: -23.8012, lng: -45.3989 },
  { name: 'Praia do Arrastão', address: 'Av. Dr. Manoel Hipólito do Rêgo, Arrastão, São Sebastião - SP', lat: -23.7821, lng: -45.3923 },
  { name: 'Pontal da Cruz', address: 'Rua Dr. Fernando Costa, Pontal da Cruz, São Sebastião - SP', lat: -23.7712, lng: -45.3901 },
  { name: 'Bairro São Francisco / Convento', address: 'Rua Martins do Val, São Francisco, São Sebastião - SP', lat: -23.7543, lng: -45.3985 },
  { name: 'Praia da Enseada (Costa Norte)', address: 'Av. Nair Coutinho Pena, Enseada, São Sebastião - SP', lat: -23.7222, lng: -45.3912 },
  { name: 'Canto do Mar', address: 'Av. Américo Timóteo, Canto do Mar, São Sebastião - SP', lat: -23.7089, lng: -45.3978 },
  { name: 'Praia Grande (Balneário dos Trabalhadores)', address: 'Av. Dr. Manoel Hipólito do Rêgo, Praia Grande, São Sebastião - SP', lat: -23.8198, lng: -45.4211 },
  { name: 'Praia de Barequeçaba', address: 'Av. Dr. Manoel Hipólito do Rêgo, Barequeçaba, São Sebastião - SP', lat: -23.8266, lng: -45.4389 },
  { name: 'Praia de Guaecá', address: 'Av. Marginal Guaecá, Guaecá, São Sebastião - SP', lat: -23.8291, lng: -45.4678 },
  { name: 'Praia de Toque-Toque Grande', address: 'Rod. Dr. Manoel Hipólito do Rêgo, Toque-Toque Grande, São Sebastião - SP', lat: -23.8345, lng: -45.5123 },
  { name: 'Praia de Toque-Toque Pequeno', address: 'Av. Dr. Bezerra de Menezes, Toque-Toque Pequeno, São Sebastião - SP', lat: -23.8298, lng: -45.5342 },
  { name: 'Praia de Paúba', address: 'Rua Bragança Paulista, Paúba, São Sebastião - SP', lat: -23.8012, lng: -45.5512 },
  { name: 'Praia de Maresias (Entrada 8)', address: 'Av. Dr. Francisco Loup, Maresias, São Sebastião - SP', lat: -23.7915, lng: -45.5683 },
  { name: 'Praia de Boiçucanga', address: 'Estrada do Cascalho, Boiçucanga, São Sebastião - SP', lat: -23.7842, lng: -45.6175 },
  { name: 'Praia de Cambury', address: 'Estrada Camburi, Cambury, São Sebastião - SP', lat: -23.7744, lng: -45.6492 },
  { name: 'Praia da Baleia', address: 'Av. Beira Mar, Praia da Baleia, São Sebastião - SP', lat: -23.7789, lng: -45.6698 },
  { name: 'Barra do Sahy', address: 'Av. Adelino Tavares, Barra do Sahy, São Sebastião - SP', lat: -23.7702, lng: -45.6888 },
  { name: 'Praia de Juquehy', address: 'Av. Mãe Bernarda, Juquehy, São Sebastião - SP', lat: -23.7661, lng: -45.7275 },
  { name: 'Barra do Una', address: 'Av. Magno Passos Cavalcanti, Barra do Una, São Sebastião - SP', lat: -23.7589, lng: -45.7612 },
  { name: 'Praia de Boracéia', address: 'Rod. Rio-Santos, Boracéia, São Sebastião - SP', lat: -23.7512, lng: -45.8234 },
  { name: 'Hospital de Clínicas de São Sebastião', address: 'Rua Capitão Luiz Soares, 250, Centro, São Sebastião - SP', lat: -23.8041, lng: -45.4025 },
  { name: 'UPA São Sebastião', address: 'Rua Antônio Januário do Amaral, Centro, São Sebastião - SP', lat: -23.8095, lng: -45.4031 },
];

mapsRouter.get('/popular-places', (req: Request, res: Response) => {
  res.json({
    success: true,
    requestId: req.id,
    data: KNOWN_LOCATIONS,
  });
});

mapsRouter.get('/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    requestId: req.id,
    data: {
      defaultCenter: { lat: -23.8055, lng: -45.4011 }, // Centro de São Sebastião
      defaultZoom: 14,
      hasKey: !!config.googleMaps.apiKey,
    },
  });
});

/**
 * Autocomplete suggestions for address typing
 */
mapsRouter.post('/autocomplete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== 'string' || input.trim().length < 2) {
      return res.json({ success: true, requestId: req.id, data: [] });
    }

    const trimmed = input.trim();

    // 1. If Google Maps API Key is available, call Places Autocomplete API
    if (config.googleMaps.apiKey) {
      try {
        // Bias nearby to northern coast/SP without restricting other cities
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          trimmed
        )}&components=country:br&locationbias=point:-23.8055,-45.4011&language=pt-BR&key=${config.googleMaps.apiKey}`;
        const response = await fetch(url);
        const data = (await response.json()) as any;
        if (data.status === 'OK' && Array.isArray(data.predictions) && data.predictions.length > 0) {
          const suggestions = data.predictions.map((p: any) => ({
            description: p.description,
            placeId: p.place_id,
            mainText: p.structured_formatting?.main_text || p.description,
            secondaryText: p.structured_formatting?.secondary_text || '',
          }));
          return res.json({ success: true, requestId: req.id, data: suggestions });
        }
      } catch (err) {
        console.warn('[Maps Autocomplete] Google Places API warning:', err);
      }
    }

    // 2. OpenStreetMap Nominatim search (supports any city, street, or neighborhood in Brazil)
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&countrycodes=br&limit=6&addressdetails=1`;
      const osmRes = await fetch(osmUrl, {
        headers: { 'User-Agent': 'VaiCar-App/1.0 (contato@vaicar.app)' },
        signal: AbortSignal.timeout(3500),
      });
      if (osmRes.ok) {
        const osmData = (await osmRes.json()) as any;
        if (Array.isArray(osmData) && osmData.length > 0) {
          const suggestions = osmData.map((item: any) => {
            const parts = (item.display_name || '').split(',');
            const mainText = parts[0]?.trim() || trimmed;
            const secondaryText = parts.slice(1, 4).join(',').trim();
            return {
              description: item.display_name,
              placeId: `osm-${item.place_id || item.osm_id}`,
              mainText,
              secondaryText,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });
          return res.json({ success: true, requestId: req.id, data: suggestions });
        }
      }
    } catch (osmErr) {
      console.warn('[Maps Autocomplete] OSM Nominatim warning:', osmErr);
    }

    // 3. Fallback matching against known regional locations
    const lower = trimmed.toLowerCase();
    const matches = KNOWN_LOCATIONS.filter(
      loc => loc.name.toLowerCase().includes(lower) || loc.address.toLowerCase().includes(lower)
    ).slice(0, 7);

    const fallbackSuggestions: Array<{
      description: string;
      placeId: string;
      mainText: string;
      secondaryText: string;
      lat?: number;
      lng?: number;
    }> = matches.map(loc => ({
      description: loc.address,
      placeId: `loc-${loc.lat}-${loc.lng}`,
      mainText: loc.name,
      secondaryText: 'Litoral Norte - SP',
      lat: loc.lat,
      lng: loc.lng,
    }));

    // If no direct matches, return free-text suggestion for any Brazilian location
    if (fallbackSuggestions.length === 0) {
      fallbackSuggestions.push({
        description: trimmed,
        placeId: `custom-${Date.now()}`,
        mainText: trimmed,
        secondaryText: 'Localização livre',
      });
    }

    res.json({ success: true, requestId: req.id, data: fallbackSuggestions });
  } catch (error) {
    next(error);
  }
});

/**
 * Forward Geocoding: Address to Coordinates
 */
mapsRouter.post('/geocode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ success: false, requestId: req.id, error: { code: 'VALIDATION_ERROR', message: 'Endereço obrigatório' } });
    }

    // Match against known points first
    const lower = address.toLowerCase();
    const matched = KNOWN_LOCATIONS.find(loc => loc.name.toLowerCase().includes(lower) || loc.address.toLowerCase().includes(lower));

    if (matched) {
      return res.json({
        success: true,
        requestId: req.id,
        data: {
          address: matched.address,
          lat: matched.lat,
          lng: matched.lng,
        },
      });
    }

    // 1. If Google Maps API Key is available, call Google Geocoding API (nationwide/regional)
    if (config.googleMaps.apiKey) {
      try {
        const query = address.toLowerCase().includes('brasil') ? address : `${address}, Brasil`;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:BR&language=pt-BR&key=${config.googleMaps.apiKey}`;
        const response = await fetch(url);
        const data = (await response.json()) as any;
        if (data.results && data.results.length > 0) {
          const first = data.results[0];
          return res.json({
            success: true,
            requestId: req.id,
            data: {
              address: first.formatted_address,
              lat: first.geometry.location.lat,
              lng: first.geometry.location.lng,
            },
          });
        }
      } catch (err) {
        console.warn('[Maps Geocode] Google Maps API fetch warning:', err);
      }
    }

    // 2. OpenStreetMap Nominatim Search Fallback (any city in Brazil)
    try {
      const query = address.toLowerCase().includes('brasil') ? address : `${address}, Brasil`;
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=1`;
      const osmRes = await fetch(osmUrl, {
        headers: { 'User-Agent': 'VaiCar-App/1.0 (contato@vaicar.app)' },
        signal: AbortSignal.timeout(4000),
      });
      if (osmRes.ok) {
        const osmData = (await osmRes.json()) as any;
        if (Array.isArray(osmData) && osmData.length > 0) {
          const first = osmData[0];
          return res.json({
            success: true,
            requestId: req.id,
            data: {
              address: first.display_name.split(',').slice(0, 4).join(',').trim(),
              lat: parseFloat(first.lat),
              lng: parseFloat(first.lon),
            },
          });
        }
      }
    } catch (osmErr) {
      console.warn('[Maps Geocode] OSM Nominatim warning:', osmErr);
    }

    // 3. Fallback: Return address as requested
    res.json({
      success: true,
      requestId: req.id,
      data: {
        address,
        lat: -23.8055,
        lng: -45.4011,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reverse Geocoding: Coordinates to Street Address
 */
mapsRouter.post('/reverse-geocode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        error: { code: 'VALIDATION_ERROR', message: 'Coordenadas lat e lng numéricas são obrigatórias.' },
      });
    }

    // 1. If Google Maps API Key is available, call Google Geocoding API
    if (config.googleMaps.apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR&key=${config.googleMaps.apiKey}`;
        const response = await fetch(url);
        const data = (await response.json()) as any;
        if (data.results && data.results.length > 0) {
          const first = data.results[0];
          return res.json({
            success: true,
            requestId: req.id,
            data: {
              address: first.formatted_address,
              lat,
              lng,
            },
          });
        }
      } catch (err) {
        console.warn('[Maps Reverse Geocode] Google Maps API fetch warning:', err);
      }
    }

    // 2. OpenStreetMap Nominatim reverse geocoding fallback (worldwide, exact real street)
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const osmRes = await fetch(osmUrl, {
        headers: { 'User-Agent': 'VaiCar-App/1.0 (contato@vaicar.app)' },
        signal: AbortSignal.timeout(4000),
      });
      if (osmRes.ok) {
        const osmData = (await osmRes.json()) as any;
        if (osmData && osmData.address) {
          const a = osmData.address;
          const street = a.road || a.pedestrian || a.street || a.suburb || '';
          const houseNumber = a.house_number ? `, ${a.house_number}` : '';
          const neighborhood = a.suburb || a.neighbourhood || a.city_district || '';
          const city = a.city || a.town || a.municipality || a.village || '';
          const state = a.state ? (a['ISO3166-2-lvl4']?.split('-')[1] || a.state) : '';

          let formatted = street ? `${street}${houseNumber}` : '';
          if (neighborhood && neighborhood !== street) {
            formatted += formatted ? `, ${neighborhood}` : neighborhood;
          }
          if (city) {
            formatted += formatted ? ` - ${city}` : city;
          }
          if (state) {
            formatted += ` (${state})`;
          }

          if (!formatted && osmData.display_name) {
            formatted = osmData.display_name.split(',').slice(0, 3).join(',').trim();
          }

          if (formatted) {
            return res.json({
              success: true,
              requestId: req.id,
              data: {
                address: formatted,
                lat,
                lng,
              },
            });
          }
        }
      }
    } catch (osmErr) {
      console.warn('[Maps Reverse Geocode] OSM Nominatim warning:', osmErr);
    }

    // 3. Fallback: Find closest known location in São Sebastião
    let closest = KNOWN_LOCATIONS[0];
    let minDistanceSq = Number.MAX_VALUE;
    for (const loc of KNOWN_LOCATIONS) {
      const dLat = loc.lat - lat;
      const dLng = loc.lng - lng;
      const distSq = dLat * dLat + dLng * dLng;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closest = loc;
      }
    }

    const approxAddress = Math.sqrt(minDistanceSq) < 0.02
      ? closest.address
      : `Ponto próximo a ${closest.name}, São Sebastião - SP`;

    res.json({
      success: true,
      requestId: req.id,
      data: {
        address: approxAddress,
        lat,
        lng,
      },
    });
  } catch (error) {
    next(error);
  }
});
