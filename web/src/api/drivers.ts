import { apiFetch } from './client.js';
import { DriverProfile, Ride, DriverCustomPricing } from '../../../shared/src/types.js';

export interface PublicDriverMarker {
  uid: string;
  name: string;
  photoUrl: string;
  vehicle: {
    type?: string;
    brand: string;
    model: string;
    color: string;
    plate?: string;
  };
  currentLocation?: {
    lat: number;
    lng: number;
    heading?: number;
    updatedAt: string;
  };
  rating: number;
  operatingZones: string[];
  isCourier?: boolean;
}

export const driversApi = {
  getOnlineDrivers: () => apiFetch<PublicDriverMarker[]>('/drivers/online'),

  getMe: () => apiFetch<DriverProfile>('/drivers/me'),

  getPricing: () =>
    apiFetch<{
      customPricing: DriverCustomPricing;
      platformFloor: { minimumFare: number; perKmRate: number; perMinuteRate: number };
    }>('/drivers/pricing'),

  updatePricing: (pricing: Partial<DriverCustomPricing>) =>
    apiFetch<{
      customPricing: DriverCustomPricing;
      platformFloor: { minimumFare: number; perKmRate: number; perMinuteRate: number };
      message: string;
    }>('/drivers/pricing', {
      method: 'PUT',
      body: JSON.stringify(pricing),
    }),

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

  changePlan: (plan: 'monthly_100' | 'weekly_percent_10') =>
    apiFetch<{ driver: DriverProfile; message: string }>('/drivers/change-plan', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
};
