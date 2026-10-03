import { getFirebaseAdminFirestore } from './firebaseAdmin.js';
import {
  UserProfile,
  PassengerProfile,
  DriverProfile,
  Ride,
  Receipt,
  Report,
  PlatformPricingSettings,
  AdminMetrics,
} from '../../../shared/src/types.js';

// In-memory document store for local dev / testing fallback when cloud credentials are not supplied
const localStore: Record<string, Map<string, any>> = {
  users: new Map(),
  passengers: new Map(),
  drivers: new Map(),
  vehicles: new Map(),
  rides: new Map(),
  pendingPins: new Map(),
  receipts: new Map(),
  reports: new Map(),
  platformSettings: new Map(),
};

// Default pricing settings for São Sebastião: R$ 10 base fixo + R$ 1,00/km + R$ 0,25/minuto (mínimo R$ 10)
const defaultSettings: PlatformPricingSettings = {
  baseFare: 10.00,
  perKmRate: 1.00,
  perMinuteRate: 0.25,
  minimumFare: 10.00,
  nightSurchargeMultiplier: 1.20,
  updatedAt: new Date().toISOString(),
};
localStore.platformSettings.set('pricing', defaultSettings);

// --- Users Collection ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? (snap.data() as UserProfile) : null;
  }
  return localStore.users.get(uid) || null;
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const normalized = email.trim().toLowerCase();
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('users').where('email', '==', normalized).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as UserProfile;
    return null;
  }
  for (const user of localStore.users.values()) {
    if (user.email?.toLowerCase() === normalized) return user;
  }
  return null;
}

export async function findUserByWhatsApp(whatsapp: string): Promise<UserProfile | null> {
  const cleaned = whatsapp.replace(/\D/g, '');
  const alt = cleaned.length === 11 ? `55${cleaned}` : cleaned.startsWith('55') && cleaned.length === 13 ? cleaned.slice(2) : cleaned;
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap1 = await db.collection('users').where('whatsapp', '==', cleaned).limit(1).get();
    if (!snap1.empty) return snap1.docs[0].data() as UserProfile;
    if (alt !== cleaned) {
      const snap2 = await db.collection('users').where('whatsapp', '==', alt).limit(1).get();
      if (!snap2.empty) return snap2.docs[0].data() as UserProfile;
    }
    return null;
  }
  for (const user of localStore.users.values()) {
    const userClean = user.whatsapp?.replace(/\D/g, '');
    if (userClean === cleaned || userClean === alt) return user;
  }
  return null;
}

/**
 * Recursively removes keys with undefined values so Firestore never complains about undefined properties.
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => (typeof item === 'object' && item !== null ? sanitizeFirestoreData(item) : item)) as any;
  }
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        clean[key] = sanitizeFirestoreData(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const clean = sanitizeFirestoreData(profile);
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('users').doc(profile.uid).set(clean, { merge: true });
  }
  const existing = localStore.users.get(profile.uid) || {};
  localStore.users.set(profile.uid, { ...existing, ...clean });
}

// --- Passengers Collection ---
export async function getPassengerProfile(uid: string): Promise<PassengerProfile | null> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('passengers').doc(uid).get();
    return snap.exists ? (snap.data() as PassengerProfile) : null;
  }
  return localStore.passengers.get(uid) || null;
}

export async function findPassengerByEmail(email: string): Promise<PassengerProfile | null> {
  const normalized = email.trim().toLowerCase();
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('passengers').where('email', '==', normalized).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as PassengerProfile;
    return null;
  }
  for (const p of localStore.passengers.values()) {
    if (p.email?.toLowerCase() === normalized) return p;
  }
  return null;
}

/**
 * Resolves or auto-heals a passenger profile for any authenticated user.
 * Guarantees registered users are never blocked from ordering rides or viewing profile.
 */
export async function resolvePassengerProfile(uid: string, email?: string): Promise<PassengerProfile> {
  // 1. Direct lookup by UID
  const existingByUid = await getPassengerProfile(uid);
  if (existingByUid) return existingByUid;

  // 2. Lookup by email in passengers collection if provided
  if (email) {
    const existingByEmail = await findPassengerByEmail(email);
    if (existingByEmail) {
      const linked: PassengerProfile = { ...existingByEmail, uid };
      await savePassengerProfile(linked);
      return linked;
    }
  }

  // 3. Fallback to UserProfile (e.g. registered as driver or via auth)
  let user = await getUserProfile(uid);
  if (!user && email) {
    user = await findUserByEmail(email);
  }

  const now = new Date().toISOString();
  if (user) {
    const resolvedFromUser: PassengerProfile = {
      uid,
      name: user.displayName || (user.email ? user.email.split('@')[0] : 'Passageiro'),
      email: user.email || email || '',
      whatsapp: user.whatsapp || '',
      photoUrl: user.photoUrl || '',
      termsAccepted: true,
      hasCriminalRecordCheck: Boolean(user.isPassenger),
      criminalRecordStatus: 'NONE',
      rating: 5.0,
      totalRides: 0,
      createdAt: user.createdAt || now,
      updatedAt: now,
    };
    await savePassengerProfile(resolvedFromUser);
    if (!user.isPassenger) {
      await saveUserProfile({ ...user, isPassenger: true, updatedAt: now });
    }
    return resolvedFromUser;
  }

  // 4. Authenticated user without any prior profile - auto-provision
  const fallbackEmail = (email || '').trim().toLowerCase();
  const fallbackName = fallbackEmail ? fallbackEmail.split('@')[0] : 'Passageiro';
  const autoCreated: PassengerProfile = {
    uid,
    name: fallbackName,
    email: fallbackEmail,
    whatsapp: '',
    photoUrl: '',
    termsAccepted: true,
    rating: 5.0,
    totalRides: 0,
    createdAt: now,
    updatedAt: now,
  };
  await savePassengerProfile(autoCreated);
  await saveUserProfile({
    uid,
    email: fallbackEmail,
    displayName: fallbackName,
    role: 'passenger',
    isPassenger: true,
    createdAt: now,
    updatedAt: now,
  });

  return autoCreated;
}

export async function savePassengerProfile(profile: PassengerProfile): Promise<void> {
  const clean = sanitizeFirestoreData(profile);
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('passengers').doc(profile.uid).set(clean, { merge: true });
  }
  const existing = localStore.passengers.get(profile.uid) || {};
  localStore.passengers.set(profile.uid, { ...existing, ...clean });
}

export async function deletePassengerProfile(uid: string): Promise<void> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('passengers').doc(uid).delete();
  }
  localStore.passengers.delete(uid);

  const user = await getUserProfile(uid);
  if (user) {
    if (!user.isDriver) {
      if (db) {
        await db.collection('users').doc(uid).delete();
      }
      localStore.users.delete(uid);
    } else {
      user.isPassenger = false;
      await saveUserProfile(user);
    }
  }
}

export async function listAllPassengers(): Promise<PassengerProfile[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('passengers').get();
    return snap.docs.map(d => d.data() as PassengerProfile);
  }
  return Array.from(localStore.passengers.values());
}

// --- Drivers Collection ---
export async function getDriverProfile(uid: string): Promise<DriverProfile | null> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('drivers').doc(uid).get();
    return snap.exists ? (snap.data() as DriverProfile) : null;
  }
  return localStore.drivers.get(uid) || null;
}

export async function findDriverByCpf(cpf: string): Promise<DriverProfile | null> {
  const cleaned = cpf.replace(/\D/g, '');
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('drivers').where('cpf', '==', cleaned).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as DriverProfile;
    return null;
  }
  for (const driver of localStore.drivers.values()) {
    if (driver.cpf?.replace(/\D/g, '') === cleaned) return driver;
  }
  return null;
}

export async function saveDriverProfile(profile: DriverProfile): Promise<void> {
  const clean = sanitizeFirestoreData(profile);
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('drivers').doc(profile.uid).set(clean, { merge: true });
  }
  const existing = localStore.drivers.get(profile.uid) || {};
  localStore.drivers.set(profile.uid, { ...existing, ...clean });
}

export async function deleteDriverProfile(uid: string): Promise<void> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('drivers').doc(uid).delete();
  }
  localStore.drivers.delete(uid);

  const user = await getUserProfile(uid);
  if (user) {
    if (!user.isPassenger) {
      if (db) {
        await db.collection('users').doc(uid).delete();
      }
      localStore.users.delete(uid);
    } else {
      user.isDriver = false;
      await saveUserProfile(user);
    }
  }
}

export async function listAllDrivers(): Promise<DriverProfile[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('drivers').get();
    return snap.docs.map(d => d.data() as DriverProfile);
  }
  return Array.from(localStore.drivers.values());
}

export async function listOnlineDrivers(): Promise<DriverProfile[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db
      .collection('drivers')
      .where('status', '==', 'APPROVED')
      .where('isOnline', '==', true)
      .get();
    return snap.docs.map(d => d.data() as DriverProfile);
  }
  return Array.from(localStore.drivers.values()).filter(
    d => d.status === 'APPROVED' && d.isOnline === true
  );
}

// --- Rides Collection ---
export async function getRide(rideId: string): Promise<Ride | null> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('rides').doc(rideId).get();
    return snap.exists ? (snap.data() as Ride) : null;
  }
  return localStore.rides.get(rideId) || null;
}

export async function saveRide(ride: Ride): Promise<void> {
  const clean = sanitizeFirestoreData(ride);
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('rides').doc(ride.id).set(clean, { merge: true });
  }
  const existing = localStore.rides.get(ride.id) || {};
  localStore.rides.set(ride.id, { ...existing, ...clean });
}

export async function listRidesForPassenger(passengerId: string): Promise<Ride[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('rides').where('passengerId', '==', passengerId).get();
    return snap.docs.map(d => d.data() as Ride);
  }
  return Array.from(localStore.rides.values()).filter(r => r.passengerId === passengerId);
}

export async function listRidesForDriver(driverId: string): Promise<Ride[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('rides').where('driverId', '==', driverId).get();
    return snap.docs.map(d => d.data() as Ride);
  }
  return Array.from(localStore.rides.values()).filter(r => r.driverId === driverId);
}

export async function listAllRides(): Promise<Ride[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('rides').get();
    return snap.docs.map(d => d.data() as Ride);
  }
  return Array.from(localStore.rides.values());
}

export async function getActiveRideForUser(uid: string, role: 'passenger' | 'driver'): Promise<Ride | null> {
  const activeStatuses = ['REQUESTED', 'OFFERED', 'ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS'];
  const rides = role === 'passenger' ? await listRidesForPassenger(uid) : await listRidesForDriver(uid);
  const active = rides.find(r => activeStatuses.includes(r.status));
  if (active) return active;
  if (role === 'passenger') {
    // If passenger has completed ride awaiting driver payment approval, keep it active until driver approves
    const pendingPaymentRide = rides.find(
      r => r.status === 'COMPLETED' && (r.paymentStatus === 'PENDING' || r.paymentApprovedByDriver === false)
    );
    if (pendingPaymentRide) return pendingPaymentRide;
  }
  return null;
}

// --- Receipts Collection ---
export async function saveReceipt(receipt: Receipt): Promise<void> {
  const clean = sanitizeFirestoreData(receipt);
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('receipts').doc(receipt.id).set(clean);
  }
  localStore.receipts.set(receipt.id, clean);
}

export async function getReceipt(receiptId: string): Promise<Receipt | null> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('receipts').doc(receiptId).get();
    return snap.exists ? (snap.data() as Receipt) : null;
  }
  return localStore.receipts.get(receiptId) || null;
}

// --- Platform Settings ---
export async function getPlatformPricing(): Promise<PlatformPricingSettings> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('platformSettings').doc('pricing').get();
    if (snap.exists) {
      const data = snap.data() as PlatformPricingSettings;
      if (data.baseFare === 7.00 || data.perKmRate === 3.50) {
        return updatePlatformPricing(defaultSettings);
      }
      return data;
    }
  }
  return localStore.platformSettings.get('pricing') || defaultSettings;
}

export async function updatePlatformPricing(settings: Partial<PlatformPricingSettings>): Promise<PlatformPricingSettings> {
  const current = await getPlatformPricing();
  const updated: PlatformPricingSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('platformSettings').doc('pricing').set(updated);
  }
  localStore.platformSettings.set('pricing', updated);
  return updated;
}

// --- PIN Collection ---
export async function savePendingPin(key: string, pin: string, expiresMinutes = 15): Promise<void> {
  const data = {
    key,
    pin,
    expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString(),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('pendingPins').doc(key).set(data);
  }
  localStore.pendingPins.set(key, data);
}

export async function verifyPendingPin(key: string, pin: string): Promise<boolean> {
  const db = getFirebaseAdminFirestore();
  let data: any = null;
  if (db) {
    const snap = await db.collection('pendingPins').doc(key).get();
    if (snap.exists) data = snap.data();
  } else {
    data = localStore.pendingPins.get(key);
  }

  if (!data) return false;
  if (new Date(data.expiresAt).getTime() < Date.now()) {
    return false; // Expired
  }
  if (data.pin !== pin) {
    return false;
  }

  // Delete after successful verification
  if (db) {
    await db.collection('pendingPins').doc(key).delete();
  }
  localStore.pendingPins.delete(key);
  return true;
}

// --- Admin Metrics ---
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const allRides = await listAllRides();
  const allDrivers = await listAllDrivers();
  const allPassengers = await listAllPassengers();

  const completed = allRides.filter(r => r.status === 'COMPLETED');
  const activeOnline = allDrivers.filter(d => d.status === 'APPROVED' && d.isOnline);
  const pendingApprovals = allDrivers.filter(d => d.status === 'PENDING_APPROVAL');

  const grossVolumeBRL = completed.reduce((acc, r) => acc + (r.fareAmount || 0), 0);

  return {
    totalRides: allRides.length,
    completedRides: completed.length,
    activeOnlineDrivers: activeOnline.length,
    pendingDriverApprovals: pendingApprovals.length,
    totalPassengers: allPassengers.length,
    totalDrivers: allDrivers.length,
    grossVolumeBRL: Math.round(grossVolumeBRL * 100) / 100,
  };
}

// --- Reports Collection ---
export async function saveReport(report: Report): Promise<void> {
  const clean = sanitizeFirestoreData(report);
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('reports').doc(report.id).set(clean, { merge: true });
  }
  const existing = localStore.reports.get(report.id) || {};
  localStore.reports.set(report.id, { ...existing, ...clean });
}

export async function getReport(reportId: string): Promise<Report | null> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('reports').doc(reportId).get();
    return snap.exists ? (snap.data() as Report) : null;
  }
  return localStore.reports.get(reportId) || null;
}

export async function listAllReports(): Promise<Report[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('reports').get();
    return snap.docs.map(d => d.data() as Report);
  }
  return Array.from(localStore.reports.values());
}

export async function listReportsForUser(userId: string): Promise<Report[]> {
  const all = await listAllReports();
  return all.filter(r => r.reporterId === userId || r.targetId === userId);
}

