import { apiFetch } from './client.js';
import { PassengerProfile, Ride } from '../../../shared/src/types.js';

export const passengersApi = {
  getMe: () => apiFetch<PassengerProfile>('/passengers/me'),

  updateMe: (data: { name?: string; whatsapp?: string; photoUrl?: string }) =>
    apiFetch<PassengerProfile>('/passengers/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getRides: () => apiFetch<Ride[]>('/passengers/rides'),

  getActiveRide: () => apiFetch<Ride | null>('/passengers/active-ride'),
};
