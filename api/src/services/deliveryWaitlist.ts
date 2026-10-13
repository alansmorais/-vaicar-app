import crypto from 'crypto';
import { getFirebaseAdminFirestore } from './firebaseAdmin.js';
import {
  DeliveryWaitlistEntry,
  CreateDeliveryWaitlistInput,
  DeliveryWaitlistRole,
} from '../../../shared/src/types.js';

// In-memory fallback for local dev/testing
export const localWaitlistStore: DeliveryWaitlistEntry[] = [];

/**
 * Validates and registers a new entry into the Delivery Service waiting list.
 */
export async function addDeliveryWaitlistEntry(
  input: CreateDeliveryWaitlistInput
): Promise<DeliveryWaitlistEntry> {
  const name = String(input.name || '').trim();
  const phone = String(input.phone || '').trim();
  const email = input.email ? String(input.email).trim().toLowerCase() : undefined;
  const role: DeliveryWaitlistRole = input.role || 'courier_motorcycle';
  const vehicleDetails = input.vehicleDetails ? String(input.vehicleDetails).trim() : undefined;
  const neighborhood = input.neighborhood ? String(input.neighborhood).trim() : undefined;
  const notes = input.notes ? String(input.notes).trim() : undefined;

  if (!name || name.length < 2) {
    throw new Error('Nome é obrigatório (mínimo 2 caracteres).');
  }

  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    throw new Error('Telefone/WhatsApp válido é obrigatório (com DDD).');
  }

  const id = `waitlist_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const entry: DeliveryWaitlistEntry = {
    id,
    name,
    phone,
    email,
    role,
    vehicleDetails,
    neighborhood,
    notes,
    createdAt: now,
  };

  const db = getFirebaseAdminFirestore();
  if (db) {
    try {
      await db.collection('delivery_waitlist').doc(id).set(entry);
      return entry;
    } catch (err) {
      console.error('[DeliveryWaitlist] Error saving to Firestore, using local store:', err);
    }
  }

  localWaitlistStore.unshift(entry);
  return entry;
}

/**
 * Retrieves all registered entries from the delivery waiting list (for admin dashboard).
 */
export async function listDeliveryWaitlist(): Promise<DeliveryWaitlistEntry[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    try {
      const snap = await db.collection('delivery_waitlist').orderBy('createdAt', 'desc').get();
      if (!snap.empty) {
        return snap.docs.map((doc) => doc.data() as DeliveryWaitlistEntry);
      }
    } catch (err) {
      console.error('[DeliveryWaitlist] Error listing from Firestore, using local store:', err);
    }
  }

  return [...localWaitlistStore];
}
