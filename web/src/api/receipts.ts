import { apiFetch } from './client.js';
import { Receipt } from '../../../shared/src/types.js';

export const receiptsApi = {
  getById: (receiptId: string) => apiFetch<Receipt>(`/receipts/${receiptId}`),
  getHtmlUrl: (receiptId: string) => `/api/v1/receipts/${receiptId}/html`,
};
