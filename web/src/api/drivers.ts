import { apiFetch } from './client.js';
import {
  DriverProfile,
  Ride,
  RideOffer,
  DriverCustomPricing,
  DriverDeliveryPricing,
  ServiceType,
  DriverSubscriptionPlan,
} from '../../../shared/src/types.js';

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
  servicesOffered?: ServiceType[];
}

export const driversApi = {
  getOnlineDrivers: () => apiFetch<PublicDriverMarker[]>('/drivers/online'),

  getMe: () => apiFetch<DriverProfile>('/drivers/me'),

  getPricing: () =>
    apiFetch<{
      customPricing: DriverCustomPricing;
      customDeliveryPricing?: DriverDeliveryPricing;
      servicesOffered?: ServiceType[];
      platformFloor: { minimumFare: number; perKmRate: number; perMinuteRate: number };
      deliveryPlatformFloor?: { minimumDeliveryFee: number; perKmRate: number; waitingPerMinuteRate: number };
    }>('/drivers/pricing'),

  updatePricing: (data: {
    minimumFare?: number;
    perKmRate?: number;
    perMinuteRate?: number;
    allowFixedRoutes?: boolean;
    fixedRoutes?: any[];
    customDeliveryPricing?: Partial<DriverDeliveryPricing>;
    servicesOffered?: ServiceType[];
  }) =>
    apiFetch<{
      customPricing: DriverCustomPricing;
      customDeliveryPricing?: DriverDeliveryPricing;
      servicesOffered?: ServiceType[];
      platformFloor: { minimumFare: number; perKmRate: number; perMinuteRate: number };
      deliveryPlatformFloor?: { minimumDeliveryFee: number; perKmRate: number; waitingPerMinuteRate: number };
      message: string;
    }>('/drivers/pricing', {
      method: 'PUT',
      body: JSON.stringify(data),
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

  updateLocation: (lat: number, lng: number, heading = 0, speed?: number, accuracy?: number) =>
    apiFetch<{ lat: number; lng: number; heading: number; speed?: number; accuracy?: number; updatedAt: string }>('/drivers/location', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, heading, speed, accuracy }),
    }),

  updateFcmToken: (fcmToken: string) =>
    apiFetch<{ driverId: string; fcmToken: string; updatedAt: string }>('/drivers/fcm-token', {
      method: 'POST',
      body: JSON.stringify({ fcmToken }),
    }),

  getAvailableRides: () => apiFetch<Ride[]>('/drivers/available-rides'),

  getPendingOffer: () => apiFetch<RideOffer | null>('/drivers/offers/pending'),

  acceptOffer: (offerId: string) =>
    apiFetch<Ride>(`/drivers/offers/${offerId}/accept`, {
      method: 'POST',
    }),

  declineOffer: (offerId: string) =>
    apiFetch<{ declined: boolean }>(`/drivers/offers/${offerId}/decline`, {
      method: 'POST',
    }),

  getActiveRide: () => apiFetch<Ride | null>('/drivers/active-ride'),

  getRides: () => apiFetch<Ride[]>('/drivers/rides'),

  changePlan: (plan: DriverSubscriptionPlan) =>
    apiFetch<{ driver: DriverProfile; message: string }>('/drivers/change-plan', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
};
