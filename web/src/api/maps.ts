import { apiFetch } from './client.js';

export interface KnownLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const mapsApi = {
  getPopularPlaces: () => apiFetch<KnownLocation[]>('/maps/popular-places'),

  getConfig: () => apiFetch<{ defaultCenter: { lat: number; lng: number }; defaultZoom: number; hasKey: boolean }>('/maps/config'),

  geocode: (address: string) =>
    apiFetch<{ address: string; lat: number; lng: number }>('/maps/geocode', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),
};
