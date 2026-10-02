import { apiFetch } from './client.js';
import { UserProfile, PassengerProfile, DriverProfile } from '../../../shared/src/types.js';

export interface RegisterPassengerInput {
  uid: string;
  name: string;
  whatsapp: string;
  email: string;
  photoUrl: string;
  termsAccepted: boolean;
}

export interface RegisterDriverInput {
  uid: string;
  name: string;
  cpf: string;
  birthDate: string;
  whatsapp: string;
  email: string;
  photoUrl: string;
  professionalCategory: string;
  cnhNumber: string;
  vehicle: {
    brand: string;
    model: string;
    year: number;
    color: string;
    plate: string;
  };
  operatingZones: string[];
}

export const authApi = {
  registerPassenger: (data: RegisterPassengerInput) =>
    apiFetch<{ user: UserProfile; passenger: PassengerProfile; emailStatus: string }>('/auth/register-passenger', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  registerDriver: (data: RegisterDriverInput) =>
    apiFetch<{ user: UserProfile; driver: DriverProfile; emailStatus: string }>('/auth/register-driver', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  requestPin: (destination: string, type: 'passenger' | 'driver') =>
    apiFetch<{ message: string; destination: string; emailDelivered: boolean }>('/auth/request-pin', {
      method: 'POST',
      body: JSON.stringify({ destination, type }),
    }),

  verifyPin: (destination: string, pin: string) =>
    apiFetch<{ verified: boolean; message: string }>('/auth/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ destination, pin }),
    }),

  getMe: () =>
    apiFetch<{
      user: UserProfile | null;
      passenger: PassengerProfile | null;
      driver: DriverProfile | null;
      isAdmin: boolean;
    }>('/auth/me'),

  setAdmin: (targetUid?: string) =>
    apiFetch<{ user: UserProfile }>('/auth/set-admin', {
      method: 'POST',
      body: JSON.stringify({ targetUid }),
    }),
};
