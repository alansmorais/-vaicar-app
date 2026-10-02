import { apiFetch } from './client.js';
import { Report, CreateReportInput } from '../../../shared/src/types.js';

export const reportsApi = {
  create: (data: CreateReportInput) =>
    apiFetch<{ report: Report; message: string; passengerBlocked?: boolean }>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyReports: () =>
    apiFetch<Report[]>('/reports/my-reports', {
      method: 'GET',
    }),
};
