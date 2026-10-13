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

  deleteDriver: (driverId: string) =>
    apiFetch<{ message: string }>(`/admin/drivers/${driverId}`, {
      method: 'DELETE',
    }),

  requestDriverDocs: (driverId: string, requestedDocs: string, reason?: string) =>
    apiFetch<DriverProfile>(`/admin/drivers/${driverId}/request-docs`, {
      method: 'POST',
      body: JSON.stringify({ requestedDocs, reason }),
    }),

  getPassengers: () => apiFetch<PassengerProfile[]>('/admin/passengers'),

  blockPassenger: (passengerId: string, reason?: string, unpaidAmount?: number) =>
    apiFetch<PassengerProfile>(`/admin/passengers/${passengerId}/block`, {
      method: 'POST',
      body: JSON.stringify({ reason, unpaidAmount }),
    }),

  unblockPassenger: (passengerId: string) =>
    apiFetch<PassengerProfile>(`/admin/passengers/${passengerId}/unblock`, {
      method: 'POST',
    }),

  deletePassenger: (passengerId: string) =>
    apiFetch<{ message: string }>(`/admin/passengers/${passengerId}`, {
      method: 'DELETE',
    }),

  requestPassengerDocs: (passengerId: string, requestedDocs: string, reason?: string) =>
    apiFetch<PassengerProfile>(`/admin/passengers/${passengerId}/request-docs`, {
      method: 'POST',
      body: JSON.stringify({ requestedDocs, reason }),
    }),

  getReports: () => apiFetch<any[]>('/admin/reports'),

  resolveReport: (reportId: string, resolutionNote?: string, status: 'RESOLVED' | 'DISMISSED' = 'RESOLVED') =>
    apiFetch<any>(`/admin/reports/${reportId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionNote, status }),
    }),

  getRides: () => apiFetch<Ride[]>('/admin/rides'),

  cancelRide: (rideId: string, reason: string) =>
    apiFetch<Ride>(`/admin/rides/${rideId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

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

  getApkAnalytics: () =>
    apiFetch<import('../../../shared/src/types.js').ApkDownloadAnalyticsResponse>('/admin/analytics/downloads'),

  getDeliveryWaitlist: () =>
    apiFetch<import('../../../shared/src/types.js').DeliveryWaitlistEntry[]>('/admin/deliveries/waitlist'),

  getSubsidies: () =>
    apiFetch<{ subsidies: Ride[]; totalSubsidyLiabilityBRL: number }>('/admin/subsidies'),

  settleSubsidy: (rideId: string) =>
    apiFetch<Ride>(`/admin/subsidies/${rideId}/settle`, {
      method: 'POST',
    }),
};

