import { apiFetch } from './client.js';
import { DriverProfile, Ride } from '../../../shared/src/types.js';

export interface PublicDriverMarker {
  uid: string;
  name: string;
  photoUrl: string;
  vehicle: {
    brand: string;
    model: string;
    color: string;
  };
  currentLocation?: {
    lat: number;
    lng: number;
    heading?: number;
    updatedAt: string;
  };
  rating: number;
  operatingZones: string[];
}

export const driversApi = {
  getOnlineDrivers: () => apiFetch<PublicDriverMarker[]>('/drivers/online'),

  getMe: () => apiFetch<DriverProfile>('/drivers/me'),

  updateMe: (data: Partial<DriverProfile>) =>
    apiFetch<DriverProfile>('/drivers/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggleOnline: (isOnline?: boolean) =>
    apiFetch<{ isOnline: boolean; status: string }>('/drivers/toggle-online', {
      method: 'POST',
      body: JSON.stringify({ isOnline }),
    }),

  updateLocation: (lat: number, lng: number, heading = 0) =>
    apiFetch<{ lat: number; lng: number; heading: number; updatedAt: string }>('/drivers/location', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, heading }),
    }),

  getAvailableRides: () => apiFetch<Ride[]>('/drivers/available-rides'),

  getActiveRide: () => apiFetch<Ride | null>('/drivers/active-ride'),

  getRides: () => apiFetch<Ride[]>('/drivers/rides'),
};
