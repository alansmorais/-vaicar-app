import { apiFetch } from './client.js';
import { Ride, Receipt, PaymentMethod, PlatformPricingSettings, DriverRideOption } from '../../../shared/src/types.js';

export interface EstimateRideInput {
  origin: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
}

export interface EstimateRideResult {
  distanceKm: number;
  durationMinutes: number;
  fareAmount: number;
  originalFareAmount?: number;
  discountAmount?: number;
  discountApplied?: boolean;
  discountPercentage?: number;
  pricing: PlatformPricingSettings;
  availableDrivers?: DriverRideOption[];
}

export interface RequestRideInput {
  origin: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  paymentMethod: PaymentMethod;
  requestedDriverId?: string;
}

export const ridesApi = {
  estimate: (input: EstimateRideInput) =>
    apiFetch<EstimateRideResult>('/rides/estimate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  request: (input: RequestRideInput) =>
    apiFetch<Ride>('/rides/request', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  accept: (rideId: string) =>
    apiFetch<Ride>(`/rides/${rideId}/accept`, {
      method: 'POST',
    }),

  arrived: (rideId: string) =>
    apiFetch<Ride>(`/rides/${rideId}/arrived`, {
      method: 'POST',
    }),

  start: (rideId: string) =>
    apiFetch<Ride>(`/rides/${rideId}/start`, {
      method: 'POST',
    }),

  complete: (rideId: string, paymentApproved: boolean = true) =>
    apiFetch<{ ride: Ride; receipt?: Receipt }>(`/rides/${rideId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ paymentApproved }),
    }),

  approvePayment: (rideId: string) =>
    apiFetch<{ ride: Ride; receipt: Receipt }>(`/rides/${rideId}/approve-payment`, {
      method: 'POST',
    }),

  cancel: (rideId: string, reason?: string) =>
    apiFetch<Ride>(`/rides/${rideId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getById: (rideId: string) =>
    apiFetch<Ride>(`/rides/${rideId}`),

  rate: (rideId: string, rating: number, feedback?: string) =>
    apiFetch<Ride>(`/rides/${rideId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, feedback }),
    }),

  ratePassenger: (rideId: string, rating: number, feedback?: string) =>
    apiFetch<Ride>(`/rides/${rideId}/rate-passenger`, {
      method: 'POST',
      body: JSON.stringify({ rating, feedback }),
    }),
};
