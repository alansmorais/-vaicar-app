import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAqF4zL02-t-Im_cItTvUj-gPeDs4mmGK4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'vaicar-app-prod.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'vaicar-app-prod',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'vaicar-app-prod.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
};

export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
