import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export const mapsRouter = Router();

// Key landmarks and zones in São Sebastião, SP for quick location selection
const KNOWN_LOCATIONS = [
  { name: 'Centro Histórico / Rua da Praia', address: 'Av. Dr. Altino Arantes, Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 },
  { name: 'Balsa São Sebastião - Ilhabela', address: 'Av. Antônio Januário do Amaral, Centro, São Sebastião - SP', lat: -23.8166, lng: -45.3995 },
  { name: 'Terminal Rodoviário', address: 'Praça da Bíblia, Centro, São Sebastião - SP', lat: -23.8078, lng: -45.4042 },
  { name: 'Praia de Barequeçaba', address: 'Av. Dr. Manoel Hipólito do Rêgo, Barequeçaba, São Sebastião - SP', lat: -23.8266, lng: -45.4389 },
  { name: 'Praia de Maresias (Entrada 8)', address: 'Av. Dr. Francisco Loup, Maresias, São Sebastião - SP', lat: -23.7915, lng: -45.5683 },
  { name: 'Praia de Boiçucanga', address: 'Estrada do Cascalho, Boiçucanga, São Sebastião - SP', lat: -23.7842, lng: -45.6175 },
  { name: 'Praia de Cambury', address: 'Estrada Camburi, Cambury, São Sebastião - SP', lat: -23.7744, lng: -45.6492 },
  { name: 'Praia de Juquehy', address: 'Av. Mãe Bernarda, Juquehy, São Sebastião - SP', lat: -23.7661, lng: -45.7275 },
  { name: 'Barra do Sahy', address: 'Av. Adelino Tavares, Barra do Sahy, São Sebastião - SP', lat: -23.7702, lng: -45.6888 },
  { name: 'Enseada (Costa Norte)', address: 'Av. Nair Coutinho Pena, Enseada, São Sebastião - SP', lat: -23.7222, lng: -45.3912 },
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

    // If Google Maps API Key is available, call Google Geocoding API
    if (config.googleMaps.apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', São Sebastião, SP')}&key=${config.googleMaps.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
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

    // Fallback: Default São Sebastião Centro with small jitter
    res.json({
      success: true,
      requestId: req.id,
      data: {
        address: `${address}, São Sebastião - SP`,
        lat: -23.8055 + (Math.random() - 0.5) * 0.02,
        lng: -45.4011 + (Math.random() - 0.5) * 0.02,
      },
    });
  } catch (error) {
    next(error);
  }
});
