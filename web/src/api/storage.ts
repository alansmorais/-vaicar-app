import { apiFetch } from './client.js';

export interface UploadImageResult {
  url: string;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
}

export const storageApi = {
  uploadImage: (fileData: string, pathPrefix?: string, uid?: string) =>
    apiFetch<UploadImageResult>('/storage/upload', {
      method: 'POST',
      body: JSON.stringify({ fileData, pathPrefix, uid }),
    }),
};
