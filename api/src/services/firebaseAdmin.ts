import admin from 'firebase-admin';
import { config } from '../config/index.js';

let initialized = false;
let authInstance: admin.auth.Auth | null = null;
let firestoreInstance: admin.firestore.Firestore | null = null;
let storageInstance: admin.storage.Storage | null = null;

export function initFirebaseAdmin(): boolean {
  if (initialized) return true;

  try {
    if (admin.apps.length > 0) {
      initialized = true;
      authInstance = admin.auth();
      firestoreInstance = admin.firestore();
      storageInstance = admin.storage();
      return true;
    }

    const { projectId, clientEmail, privateKey, storageBucket } = config.firebase;

    // If explicit service account credentials are provided
    if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket,
      });
      initialized = true;
      authInstance = admin.auth();
      firestoreInstance = admin.firestore();
      storageInstance = admin.storage();
      console.log(`[Firebase Admin] Initialized with Service Account for project: ${projectId}`);
      return true;
    }

    // Try Application Default Credentials (e.g., in Cloud Run or gcloud logged in)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
        storageBucket,
      });
      initialized = true;
      authInstance = admin.auth();
      firestoreInstance = admin.firestore();
      storageInstance = admin.storage();
      console.log(`[Firebase Admin] Initialized with Application Default Credentials for: ${projectId}`);
      return true;
    }

    // Fallback initialization with project ID (useful for local emulators or basic admin)
    if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      admin.initializeApp({
        projectId: projectId || 'demo-vaicar',
      });
      initialized = true;
      authInstance = admin.auth();
      firestoreInstance = admin.firestore();
      console.log('[Firebase Admin] Initialized with Firebase Emulators');
      return true;
    }

    initialized = true;
    console.warn(
      '[Firebase Admin] Note: Credentials not configured yet. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY or run with Firebase Emulators for production.'
    );
    return false;
  } catch (error) {
    console.error('[Firebase Admin] Initialization warning:', error);
    return false;
  }
}

export function getFirebaseAdminAuth(): admin.auth.Auth | null {
  if (!initialized) initFirebaseAdmin();
  return authInstance;
}

export function getFirebaseAdminFirestore(): admin.firestore.Firestore | null {
  if (!initialized) initFirebaseAdmin();
  return firestoreInstance;
}

export function getFirebaseAdminStorage(): admin.storage.Storage | null {
  if (!initialized) initFirebaseAdmin();
  return storageInstance;
}
