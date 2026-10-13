import { apiFetch } from './client.js';
import {
  UserProfile,
  PassengerProfile,
  DriverProfile,
  DriverSubscriptionPlan,
  ServiceType,
} from '../../../shared/src/types.js';

export interface RegisterPassengerInput {
  uid: string;
  name: string;
  whatsapp: string;
  email: string;
  photoUrl: string;
  idDocumentUrl?: string;
  termsAccepted: boolean;
  hasCriminalRecordCheck?: boolean;
  criminalRecordUrl?: string;
  referralCode?: string;
}

export interface RegisterDriverInput {
  uid: string;
  name: string;
  cpf: string;
  birthDate: string;
  whatsapp: string;
  email: string;
  photoUrl: string;
  cnhUrl?: string;
  crlvUrl?: string;
  proofOfAddressUrl?: string;
  professionalCategory: string;
  cnhNumber: string;
  criminalRecordUrl?: string;
  subscriptionPlan?: DriverSubscriptionPlan;
  servicesOffered?: ServiceType[];
  vehicle: {
    type?: 'car' | 'motorcycle' | 'van' | 'bicycle';
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

  adminLogin: (credentials: { email: string; password: string }) =>
    apiFetch<{ token: string; customToken?: string; user: UserProfile }>('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  checkAccount: (email: string) =>
    apiFetch<{
      email: string;
      existsInFirestore: boolean;
      hasFirebaseAuth: boolean;
      role: 'admin' | 'driver' | 'passenger' | null;
      name: string | null;
      needsMigration: boolean;
    }>('/auth/check-account', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  migrateAccount: (data: { email: string; pin: string; password: string }) =>
    apiFetch<{
      message: string;
      uid: string;
      email: string;
      customToken: string;
      role: 'driver' | 'passenger' | 'admin';
    }>('/auth/migrate-account', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (credentials: { email: string; password: string }) =>
    apiFetch<{
      success: boolean;
      token: string;
      customToken?: string;
      user: UserProfile;
      passenger?: PassengerProfile;
      driver?: DriverProfile;
      roles: string[];
      isAdmin: boolean;
      message: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  passengerAuth: (credentials: { email?: string; phone?: string; password?: string; verificationCode?: string }) =>
    apiFetch<{
      success: boolean;
      token: string;
      passenger: PassengerProfile;
      message: string;
    }>('/passengers/auth', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  driverAuth: (credentials: { email?: string; phone?: string; password?: string; verificationCode?: string }) =>
    apiFetch<{
      success: boolean;
      token: string;
      driver: DriverProfile;
      message: string;
    }>('/drivers/auth', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{
      success: boolean;
      data: { message: string; emailDelivered: boolean };
    }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (data: { email: string; pin: string; newPassword: string }) =>
    apiFetch<{
      success: boolean;
      token?: string;
      message: string;
    }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
