import { getFirebaseAdminStorage } from './firebaseAdmin.js';
import fs from 'fs';
import path from 'path';

// Allowed MIME types and magic bytes
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface StorageUploadResult {
  url: string;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Validates file magic bytes to prevent disguised files or SVG scripts
 */
export function validateImageBuffer(buffer: Buffer): { valid: boolean; mimeType?: string; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: 'O arquivo de imagem está vazio.' };
  }
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: 'O tamanho da imagem excede o limite máximo de 5MB.' };
  }

  // Check magic bytes
  // JPEG: FF D8 (SOI marker)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { valid: true, mimeType: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { valid: true, mimeType: 'image/png' };
  }
  // WebP: RIFF ... WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { valid: true, mimeType: 'image/webp' };
  }

  // Check if someone disguised SVG or HTML
  const headerStr = buffer.toString('utf-8', 0, Math.min(buffer.length, 100)).toLowerCase();
  if (headerStr.includes('<svg') || headerStr.includes('<?xml') || headerStr.includes('<html')) {
    return { valid: false, error: 'Arquivos SVG ou vetoriais não são permitidos por segurança.' };
  }

  return { valid: false, error: 'Formato de imagem não suportado. Utilize JPG, PNG ou WebP.' };
}

/**
 * Stores an image in Firebase Storage or local secure folder fallback
 */
export async function storeImage(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<StorageUploadResult> {
  const adminStorage = getFirebaseAdminStorage();

  if (adminStorage) {
    try {
      const bucket = adminStorage.bucket();
      const file = bucket.file(storagePath);
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Public URL or signed URL
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2035',
      });

      return {
        url,
        storagePath,
        sizeBytes: buffer.length,
        mimeType,
      };
    } catch (err) {
      console.warn('[Storage] Remote bucket upload failed, using local storage fallback:', err);
    }
  }

  // Local storage fallback
  const localDir = path.resolve(process.cwd(), 'public', 'uploads', path.dirname(storagePath));
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  const filePath = path.resolve(process.cwd(), 'public', 'uploads', storagePath);
  fs.writeFileSync(filePath, buffer);

  const localUrl = `/uploads/${storagePath.replace(/\\/g, '/')}`;
  return {
    url: localUrl,
    storagePath,
    sizeBytes: buffer.length,
    mimeType,
  };
}
