import { apiFetch } from './client.js';
import { CreateDeliveryWaitlistInput, DeliveryWaitlistEntry } from '../../../shared/src/types.js';

export const deliveriesApi = {
  joinWaitlist: (data: CreateDeliveryWaitlistInput) =>
    apiFetch<{ success: boolean; message: string; data: Partial<DeliveryWaitlistEntry> }>('/deliveries/waitlist', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getInfo: () =>
    apiFetch<{
      success: boolean;
      service: string;
      status: string;
      label: string;
      modalities: Array<{ type: string; label: string; description: string }>;
      notice: string;
    }>('/deliveries/info'),
};
