import { apiFetch } from './client.js';
import { AdminMetrics, DriverProfile, PassengerProfile, Ride, PlatformPricingSettings } from '../../../shared/src/types.js';

export interface EmailLogItem {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: 'SENT' | 'FAILED';
  error?: string;
  sentAt: string;
  previewUrl?: string;
}

export const adminApi = {
  getMetrics: () => apiFetch<AdminMetrics>('/admin/metrics'),

  getDrivers: (status?: string) =>
    apiFetch<DriverProfile[]>(`/admin/drivers${status ? `?status=${status}` : ''}`),

  approveDriver: (driverId: string) =>
    apiFetch<DriverProfile>(`/admin/drivers/${driverId}/approve`, {
      method: 'POST',
    }),

  rejectDriver: (driverId: string, reason: string) =>
    apiFetch<DriverProfile>(`/admin/drivers/${driverId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  suspendDriver: (driverId: string, reason: string) =>
    apiFetch<DriverProfile>(`/admin/drivers/${driverId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getPassengers: () => apiFetch<PassengerProfile[]>('/admin/passengers'),

  getRides: () => apiFetch<Ride[]>('/admin/rides'),

  getPricing: () => apiFetch<PlatformPricingSettings>('/admin/pricing'),

  updatePricing: (settings: Partial<PlatformPricingSettings>) =>
    apiFetch<PlatformPricingSettings>('/admin/pricing', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),

  getEmailDiagnostics: () => apiFetch<EmailLogItem[]>('/admin/email-diagnostics'),

  resendEmail: (logId: string) =>
    apiFetch<{ success: boolean; messageId?: string; previewUrl?: string }>('/admin/email-diagnostics/resend', {
      method: 'POST',
      body: JSON.stringify({ logId }),
    }),
};
