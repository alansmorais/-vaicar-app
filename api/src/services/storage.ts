import { getFirebaseAdminStorage, getFirebaseAdminFirestore } from './firebaseAdmin.js';
import fs from 'fs';
import path from 'path';

// Allowed MIME types: images and PDF documents
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Memory cache fallback for fast serving
const memoryFiles = new Map<string, { dataBase64: string; mimeType: string }>();

export interface StorageUploadResult {
  url: string;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Validates file magic bytes to prevent disguised files or SVG scripts.
 * Supports JPEG, PNG, WebP, and PDF documents.
 */
export function validateImageBuffer(buffer: Buffer): { valid: boolean; mimeType?: string; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: 'O arquivo está vazio.' };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'O tamanho do arquivo excede o limite máximo de 10MB.' };
  }

  // Check magic bytes
  // PDF: %PDF- (25 50 44 46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { valid: true, mimeType: 'application/pdf' };
  }

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

  return { valid: false, error: 'Formato não suportado. Utilize JPG, PNG, WebP ou PDF.' };
}

/**
 * Stores an image or PDF in Firebase Storage, Firestore fallback, and local disk
 */
export async function storeImage(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<StorageUploadResult> {
  const normalizedPath = storagePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const dataBase64 = buffer.toString('base64');

  // 1. Keep in memory store for instant access
  memoryFiles.set(normalizedPath, { dataBase64, mimeType });

  // 2. Persist in Firestore `stored_files` collection for reliable multi-instance persistence
  const db = getFirebaseAdminFirestore();
  if (db) {
    try {
      const docId = normalizedPath.replace(/[^a-zA-Z0-9_-]/g, '_');
      await db.collection('stored_files').doc(docId).set({
        storagePath: normalizedPath,
        mimeType,
        sizeBytes: buffer.length,
        dataBase64,
        createdAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn('[Storage] Firestore persistent save note:', err);
    }
  }

  // 3. Local filesystem write
  const localDir = path.resolve(process.cwd(), 'public', 'uploads', path.dirname(normalizedPath));
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  const filePath = path.resolve(process.cwd(), 'public', 'uploads', normalizedPath);
  fs.writeFileSync(filePath, buffer);

  // 4. Try remote Firebase/GCS bucket if configured
  const adminStorage = getFirebaseAdminStorage();
  if (adminStorage) {
    try {
      const bucket = adminStorage.bucket();
      const file = bucket.file(normalizedPath);
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000',
        },
      });

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2035',
      });

      return {
        url,
        storagePath: normalizedPath,
        sizeBytes: buffer.length,
        mimeType,
      };
    } catch {
      // Remote bucket signedUrl or permission fallback - localUrl is reliable
    }
  }

  const localUrl = `/uploads/${normalizedPath}`;
  return {
    url: localUrl,
    storagePath: normalizedPath,
    sizeBytes: buffer.length,
    mimeType,
  };
}

/**
 * Retrieves a stored file from disk, memory, or Firestore collection
 */
export async function getStoredFile(storagePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const cleanPath = storagePath.replace(/\\/g, '/').replace(/^\/+/, '');

  // 1. Check local disk
  const filePath = path.resolve(process.cwd(), 'public', 'uploads', cleanPath);
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    const mime = cleanPath.endsWith('.pdf')
      ? 'application/pdf'
      : cleanPath.endsWith('.png')
      ? 'image/png'
      : cleanPath.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
    return { buffer, mimeType: mime };
  }

  // 2. Check memory store
  const mem = memoryFiles.get(cleanPath);
  if (mem) {
    return { buffer: Buffer.from(mem.dataBase64, 'base64'), mimeType: mem.mimeType };
  }

  // 3. Check Firestore `stored_files` collection
  const db = getFirebaseAdminFirestore();
  if (db) {
    try {
      const docId = cleanPath.replace(/[^a-zA-Z0-9_-]/g, '_');
      const docSnap = await db.collection('stored_files').doc(docId).get();
      if (docSnap.exists) {
        const data = docSnap.data() as { dataBase64: string; mimeType: string };
        if (data && data.dataBase64) {
          const buffer = Buffer.from(data.dataBase64, 'base64');
          // Cache to local disk for subsequent reads
          try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, buffer);
          } catch {}
          return { buffer, mimeType: data.mimeType || 'image/jpeg' };
        }
      }
    } catch (err) {
      console.warn('[Storage] Firestore file retrieval error:', err);
    }
  }

  return null;
}
