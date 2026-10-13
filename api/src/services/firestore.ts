import { getFirebaseAdminFirestore } from './firebaseAdmin.js';
import {
  UserProfile,
  PassengerProfile,
  DriverProfile,
  Ride,
  RideOffer,
  Receipt,
  Report,
  PlatformPricingSettings,
  AdminMetrics,
  ReferralRecord,
  ReferralStatus,
  PassengerReferralSummary,
} from '../../../shared/src/types.js';

// In-memory document store for local dev / testing fallback when cloud credentials are not supplied
const localStore: Record<string, Map<string, any>> = {
  users: new Map(),
  passengers: new Map(),
  drivers: new Map(),
  vehicles: new Map(),
  rides: new Map(),
  rideOffers: new Map(),
  pendingPins: new Map(),
  receipts: new Map(),
  reports: new Map(),
  platformSettings: new Map(),
  referrals: new Map(),
};

// Default pricing settings for São Sebastião: R$ 10 base fixo + R$ 1,00/km + R$ 0,25/minuto (mínimo R$ 10)
// Delivery defaults: R$ 10 mínimo + R$ 2,00/km + R$ 0,50/minuto espera
const defaultSettings: PlatformPricingSettings = {
  baseFare: 10.00,
  perKmRate: 1.00,
  perMinuteRate: 0.25,
  minimumFare: 10.00,
  nightSurchargeMultiplier: 1.20,
  deliveryMinimumFee: 10.00,
  deliveryPerKmRate: 2.00,
  deliveryWaitingPerMinuteRate: 0.50,
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

export async function findPassengerByWhatsApp(whatsapp: string): Promise<PassengerProfile | null> {
  const cleaned = whatsapp.replace(/\D/g, '');
  const alt = cleaned.length === 11 ? `55${cleaned}` : cleaned.startsWith('55') && cleaned.length === 13 ? cleaned.slice(2) : cleaned;
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap1 = await db.collection('passengers').where('whatsapp', '==', cleaned).limit(1).get();
    if (!snap1.empty) return snap1.docs[0].data() as PassengerProfile;
    if (alt !== cleaned) {
      const snap2 = await db.collection('passengers').where('whatsapp', '==', alt).limit(1).get();
      if (!snap2.empty) return snap2.docs[0].data() as PassengerProfile;
    }
    return null;
  }
  for (const p of localStore.passengers.values()) {
    const pClean = p.whatsapp?.replace(/\D/g, '');
    if (pClean === cleaned || pClean === alt) return p;
  }
  return null;
}

export async function findPassengerByReferralCode(code: string): Promise<PassengerProfile | null> {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) return null;
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('passengers').where('referralCode', '==', normalized).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as PassengerProfile;
    return null;
  }
  for (const p of localStore.passengers.values()) {
    if (p.referralCode?.toUpperCase() === normalized) return p;
  }
  return null;
}

export function generateReferralCodeCandidate(name?: string): string {
  const cleanName = (name || 'PASS')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'VCR';

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${cleanName}${suffix}`;
}

export async function generateUniqueReferralCode(name?: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCodeCandidate(name);
    const existing = await findPassengerByReferralCode(code);
    if (!existing) return code;
  }
  return `VCR${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

/**
 * Resolves or auto-heals a passenger profile for any authenticated user.
 * Guarantees registered users are never blocked from ordering rides or viewing profile.
 */
export async function resolvePassengerProfile(uid: string, email?: string): Promise<PassengerProfile> {
  // 1. Direct lookup by UID
  const existingByUid = await getPassengerProfile(uid);
  if (existingByUid) {
    if (!existingByUid.referralCode) {
      existingByUid.referralCode = await generateUniqueReferralCode(existingByUid.name);
      if (existingByUid.referralCreditBalance === undefined) existingByUid.referralCreditBalance = 0;
      await savePassengerProfile(existingByUid);
    }
    return existingByUid;
  }

  // 2. Lookup by email in passengers collection if provided
  if (email) {
    const existingByEmail = await findPassengerByEmail(email);
    if (existingByEmail) {
      const linked: PassengerProfile = { ...existingByEmail, uid };
      if (!linked.referralCode) {
        linked.referralCode = await generateUniqueReferralCode(linked.name);
        if (linked.referralCreditBalance === undefined) linked.referralCreditBalance = 0;
      }
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
    const resolvedName = user.displayName || (user.email ? user.email.split('@')[0] : 'Passageiro');
    const referralCode = await generateUniqueReferralCode(resolvedName);
    const resolvedFromUser: PassengerProfile = {
      uid,
      name: resolvedName,
      email: user.email || email || '',
      whatsapp: user.whatsapp || '',
      photoUrl: user.photoUrl || '',
      termsAccepted: true,
      hasCriminalRecordCheck: Boolean(user.isPassenger),
      criminalRecordStatus: 'NONE',
      rating: 5.0,
      totalRides: 0,
      referralCode,
      referralCreditBalance: 0,
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
  const autoReferralCode = await generateUniqueReferralCode(fallbackName);
  const autoCreated: PassengerProfile = {
    uid,
    name: fallbackName,
    email: fallbackEmail,
    whatsapp: '',
    photoUrl: '',
    termsAccepted: true,
    rating: 5.0,
    totalRides: 0,
    referralCode: autoReferralCode,
    referralCreditBalance: 0,
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

export async function getDriverProfile(uid: string): Promise<DriverProfile | null> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('drivers').doc(uid).get();
    if (snap.exists) return snap.data() as DriverProfile;
    // Check by uid field so existing driver documents maintain their original doc ID without duplicating
    const qSnap = await db.collection('drivers').where('uid', '==', uid).limit(1).get();
    if (!qSnap.empty) return qSnap.docs[0].data() as DriverProfile;
    return null;
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

export async function findDriverByEmail(email: string): Promise<DriverProfile | null> {
  const normalized = email.trim().toLowerCase();
  const db = getFirebaseAdminFirestore();
  if (db) {
    let snap = await db.collection('drivers').where('email', '==', normalized).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as DriverProfile;
    if (email.trim() !== normalized) {
      snap = await db.collection('drivers').where('email', '==', email.trim()).limit(1).get();
      if (!snap.empty) return snap.docs[0].data() as DriverProfile;
    }
    return null;
  }
  for (const driver of localStore.drivers.values()) {
    if (driver.email?.toLowerCase() === normalized) return driver;
  }
  return null;
}

export async function findDriverByWhatsApp(whatsapp: string): Promise<DriverProfile | null> {
  const cleaned = whatsapp.replace(/\D/g, '');
  const alt = cleaned.length === 11 ? `55${cleaned}` : cleaned.startsWith('55') && cleaned.length === 13 ? cleaned.slice(2) : cleaned;
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap1 = await db.collection('drivers').where('whatsapp', '==', cleaned).limit(1).get();
    if (!snap1.empty) return snap1.docs[0].data() as DriverProfile;
    if (alt !== cleaned) {
      const snap2 = await db.collection('drivers').where('whatsapp', '==', alt).limit(1).get();
      if (!snap2.empty) return snap2.docs[0].data() as DriverProfile;
    }
    return null;
  }
  for (const d of localStore.drivers.values()) {
    const dClean = d.whatsapp?.replace(/\D/g, '');
    if (dClean === cleaned || dClean === alt) return d;
  }
  return null;
}

/**
 * Resolves or auto-heals a driver profile for any authenticated user.
 * Guarantees that approved drivers logging in with Firebase Auth or email can always access their profile
 * without creating duplicate records in the drivers collection.
 */
export async function resolveDriverProfile(uid: string, email?: string): Promise<DriverProfile | null> {
  const normalizedEmail = email?.trim().toLowerCase();

  // 1. Direct lookup by UID
  let currentDriver = await getDriverProfile(uid);

  // If found but not approved, check if an approved profile with the same email exists in drivers
  if (normalizedEmail) {
    const existingByEmail = await findDriverByEmail(normalizedEmail);
    if (existingByEmail) {
      if (!currentDriver || (currentDriver.status !== 'APPROVED' && existingByEmail.status === 'APPROVED')) {
        currentDriver = { ...existingByEmail, uid };
        await saveDriverProfile(currentDriver);
      }
    }
  }

  if (currentDriver) {
    // Ensure user profile in users collection reflects driver role
    let user = await getUserProfile(uid);
    if (!user && normalizedEmail) user = await findUserByEmail(normalizedEmail);
    if (user && (!user.isDriver || user.role !== 'driver')) {
      await saveUserProfile({
        ...user,
        isDriver: true,
        role: 'driver',
        isCourier: Boolean(user.isCourier || currentDriver.isCourier),
        updatedAt: new Date().toISOString(),
      });
    }
    return currentDriver;
  }

  // 2. Lookup by email in drivers collection: update existing document in-place!
  if (normalizedEmail) {
    const db = getFirebaseAdminFirestore();
    if (db) {
      let snap = await db.collection('drivers').where('email', '==', normalizedEmail).limit(1).get();
      if (snap.empty && email && email.trim() !== normalizedEmail) {
        snap = await db.collection('drivers').where('email', '==', email.trim()).limit(1).get();
      }
      if (!snap.empty) {
        const targetDoc = snap.docs[0];
        const existingData = targetDoc.data() as DriverProfile;
        // Update existing document in-place with the Firebase UID: NO DUPLICATE CREATED
        await targetDoc.ref.update({
          uid,
          updatedAt: new Date().toISOString(),
        });
        const linked: DriverProfile = { ...existingData, uid };

        let user = await getUserProfile(uid);
        if (!user) user = await findUserByEmail(normalizedEmail);
        if (user) {
          await saveUserProfile({
            ...user,
            isDriver: true,
            role: 'driver',
            isCourier: Boolean(user.isCourier || existingData.isCourier),
            updatedAt: new Date().toISOString(),
          });
        }
        localStore.drivers.set(uid, linked);
        return linked;
      }
    } else {
      const existingByEmail = await findDriverByEmail(normalizedEmail);
      if (existingByEmail) {
        const linked: DriverProfile = { ...existingByEmail, uid };
        await saveDriverProfile(linked);
        return linked;
      }
    }
  }

  // 3. Fallback: Lookup in users collection to find original driver UID
  let user = await getUserProfile(uid);
  if (!user && normalizedEmail) {
    user = await findUserByEmail(normalizedEmail);
  }
  if (user) {
    if (user.uid !== uid) {
      const driverByOtherUid = await getDriverProfile(user.uid);
      if (driverByOtherUid) {
        const linked: DriverProfile = { ...driverByOtherUid, uid };
        await saveDriverProfile(linked);
        return linked;
      }
    }
    if (user.whatsapp) {
      const driverByPhone = await findDriverByWhatsApp(user.whatsapp);
      if (driverByPhone) {
        const linked: DriverProfile = { ...driverByPhone, uid };
        await saveDriverProfile(linked);
        return linked;
      }
    }
  }

  return null;
}

export async function saveDriverProfile(profile: DriverProfile): Promise<void> {
  const clean = sanitizeFirestoreData(profile);
  const db = getFirebaseAdminFirestore();
  if (db) {
    // If an existing document exists with this email or UID, update that exact document in-place
    let targetDocRef = db.collection('drivers').doc(profile.uid);
    if (profile.email) {
      const snap = await db.collection('drivers').where('email', '==', profile.email.toLowerCase().trim()).limit(1).get();
      if (!snap.empty) {
        targetDocRef = snap.docs[0].ref;
      }
    } else {
      const snap = await db.collection('drivers').where('uid', '==', profile.uid).limit(1).get();
      if (!snap.empty) {
        targetDocRef = snap.docs[0].ref;
      }
    }
    await targetDocRef.set(clean, { merge: true });
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
  let list: DriverProfile[] = [];
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('drivers').get();
    list = snap.docs.map(d => d.data() as DriverProfile);
  } else {
    list = Array.from(localStore.drivers.values());
  }

  // Deduplicate drivers by normalized email or CPF so admin never sees conflicting duplicate rows
  const seen = new Map<string, DriverProfile>();
  for (const d of list) {
    const key = (d.email && d.email.trim().toLowerCase()) || (d.cpf && d.cpf.replace(/\D/g, '')) || d.uid;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, d);
    } else {
      // Prioritize APPROVED status over PENDING_APPROVAL
      if (d.status === 'APPROVED' && existing.status !== 'APPROVED') {
        seen.set(key, d);
      } else if (new Date(d.updatedAt || 0).getTime() > new Date(existing.updatedAt || 0).getTime() && existing.status !== 'APPROVED') {
        seen.set(key, d);
      }
    }
  }
  return Array.from(seen.values());
}

export const GPS_FRESHNESS_THRESHOLD_MS = 60000; // 60 seconds strict threshold

export function isDriverGpsFresh(
  currentLocation?: DriverProfile['currentLocation'] | null,
  maxAgeMs = GPS_FRESHNESS_THRESHOLD_MS
): boolean {
  if (!currentLocation) return false;
  const { lat, lng, updatedAt } = currentLocation;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (!updatedAt) return false;

  const telemetryTime = new Date(updatedAt).getTime();
  if (isNaN(telemetryTime)) return false;

  const ageMs = Date.now() - telemetryTime;
  // Valid if age is within maxAgeMs and not more than 5s in the future (clock skew tolerance)
  return ageMs >= -5000 && ageMs <= maxAgeMs;
}

export function isDriverCurrentlyEligible(
  driver: DriverProfile,
  options?: {
    maxAgeMs?: number;
    serviceType?: string;
  }
): boolean {
  if (!driver) return false;
  if (driver.status !== 'APPROVED') return false;
  if (driver.isOnline !== true) return false;
  if ((driver as any).isAvailable === false) return false;

  if (!isDriverGpsFresh(driver.currentLocation, options?.maxAgeMs)) {
    return false;
  }

  if (options?.serviceType) {
    const services = driver.servicesOffered || (driver.isCourier ? ['delivery'] : ['ride']);
    if (!services.includes(options.serviceType as any)) {
      return false;
    }
  }

  return true;
}

export const isDriverLiveAndEligible = isDriverCurrentlyEligible;

export async function listOnlineDrivers(options?: { includeStale?: boolean; serviceType?: string }): Promise<DriverProfile[]> {
  const db = getFirebaseAdminFirestore();
  let drivers: DriverProfile[] = [];
  if (db) {
    const snap = await db
      .collection('drivers')
      .where('status', '==', 'APPROVED')
      .where('isOnline', '==', true)
      .get();
    drivers = snap.docs.map(d => d.data() as DriverProfile);
  } else {
    drivers = Array.from(localStore.drivers.values()).filter(
      d => d.status === 'APPROVED' && d.isOnline === true
    );
  }

  if (options?.includeStale) {
    return drivers;
  }

  return drivers.filter(d => isDriverCurrentlyEligible(d, { serviceType: options?.serviceType }));
}
export const listOnlineApprovedDrivers = listOnlineDrivers;

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
    await db.collection('rides').doc(ride.id).set(clean);
  }
  localStore.rides.set(ride.id, clean as any);
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
  rides.sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
  const active = rides.find(r => activeStatuses.includes(r.status));
  if (active) return active;
  // If passenger or driver has a completed ride awaiting driver payment approval, keep it active until driver approves
  const pendingPaymentRide = rides.find(
    r => r.status === 'COMPLETED' && (r.paymentStatus !== 'PAID' || r.paymentApprovedByDriver === false)
  );
  if (pendingPaymentRide) return pendingPaymentRide;
  return null;
}

// --- Ride Offers Collection ---
export async function saveRideOffer(offer: RideOffer): Promise<void> {
  const clean = sanitizeFirestoreData(offer);
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('ride_offers').doc(offer.id).set(clean);
  }
  localStore.rideOffers.set(offer.id, clean as any);
}

export async function getRideOffer(offerId: string): Promise<RideOffer | null> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('ride_offers').doc(offerId).get();
    return snap.exists ? (snap.data() as RideOffer) : null;
  }
  return localStore.rideOffers.get(offerId) || null;
}

export async function getActivePendingOfferForDriver(driverId: string): Promise<RideOffer | null> {
  const db = getFirebaseAdminFirestore();
  const now = Date.now();
  if (db) {
    const snap = await db
      .collection('ride_offers')
      .where('driverId', '==', driverId)
      .where('status', '==', 'PENDING')
      .get();
    for (const doc of snap.docs) {
      const offer = doc.data() as RideOffer;
      if (new Date(offer.expiresAt).getTime() > now) {
        return offer;
      }
    }
    return null;
  }
  for (const offer of localStore.rideOffers.values()) {
    if (offer.driverId === driverId && offer.status === 'PENDING') {
      if (new Date(offer.expiresAt).getTime() > now) {
        return offer;
      }
    }
  }
  return null;
}

export async function listOffersForRide(rideId: string): Promise<RideOffer[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('ride_offers').where('rideId', '==', rideId).get();
    return snap.docs.map(d => d.data() as RideOffer);
  }
  return Array.from(localStore.rideOffers.values()).filter(o => o.rideId === rideId);
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
export async function canRequestPin(key: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const db = getFirebaseAdminFirestore();
  let data: any = null;
  if (db) {
    const snap = await db.collection('pendingPins').doc(key).get();
    if (snap.exists) data = snap.data();
  } else {
    data = localStore.pendingPins.get(key);
  }
  if (!data || !data.createdAt) return { allowed: true };
  const diffMs = Date.now() - new Date(data.createdAt).getTime();
  const cooldownMs = 45 * 1000; // 45 seconds cooldown
  if (diffMs < cooldownMs) {
    return { allowed: false, waitSeconds: Math.ceil((cooldownMs - diffMs) / 1000) };
  }
  return { allowed: true };
}

export async function savePendingPin(key: string, pin: string, expiresMinutes = 15): Promise<void> {
  const data = {
    key,
    pin,
    expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString(),
    attempts: 0,
    maxAttempts: 5,
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
    // Expired - clean up
    if (db) await db.collection('pendingPins').doc(key).delete();
    localStore.pendingPins.delete(key);
    return false;
  }

  const currentAttempts = (data.attempts || 0) + 1;
  if (currentAttempts > (data.maxAttempts || 5)) {
    // Too many failed attempts - lock out and delete
    if (db) await db.collection('pendingPins').doc(key).delete();
    localStore.pendingPins.delete(key);
    return false;
  }

  if (data.pin !== pin) {
    // Record failed attempt
    const updated = { ...data, attempts: currentAttempts };
    if (db) {
      await db.collection('pendingPins').doc(key).update({ attempts: currentAttempts });
    }
    localStore.pendingPins.set(key, updated);
    return false;
  }

  // Correct PIN - Delete immediately to prevent replay
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

  // Phase 1 — Stage 4: Breakdown by serviceType (defaulting omitted serviceType to 'ride' for backward compatibility)
  const totalPassengerRides = allRides.filter(r => (r.serviceType || 'ride') === 'ride').length;
  const totalDeliveries = allRides.filter(r => r.serviceType === 'delivery').length;

  const completedPassengerRides = completed.filter(r => (r.serviceType || 'ride') === 'ride').length;
  const completedDeliveries = completed.filter(r => r.serviceType === 'delivery').length;

  const grossVolumeRidesBRL = completed
    .filter(r => (r.serviceType || 'ride') === 'ride')
    .reduce((acc, r) => acc + (r.fareAmount || 0), 0);
  const grossVolumeDeliveriesBRL = completed
    .filter(r => r.serviceType === 'delivery')
    .reduce((acc, r) => acc + (r.fareAmount || 0), 0);

  const activeOnlineRideDrivers = activeOnline.filter(d => {
    if (d.vehicle?.type === 'bicycle') return false;
    const services = d.servicesOffered || (d.isCourier ? ['delivery'] : ['ride']);
    return services.includes('ride');
  }).length;

  const activeOnlineDeliveryPartners = activeOnline.filter(d => {
    const services = d.servicesOffered || (d.isCourier ? ['delivery'] : ['ride']);
    return services.includes('delivery') || d.vehicle?.type === 'bicycle';
  }).length;

  const pendingSubsidies = completed.filter(
    r => (r.platformSubsidyAmount || 0) > 0 && r.platformSubsidyStatus === 'PENDING_SETTLEMENT'
  );
  const settledSubsidies = completed.filter(
    r => (r.platformSubsidyAmount || 0) > 0 && r.platformSubsidyStatus === 'SETTLED'
  );
  const totalPlatformSubsidyLiabilityBRL = pendingSubsidies.reduce(
    (acc, r) => acc + (r.platformSubsidyAmount || 0),
    0
  );
  const settledSubsidyAmountBRL = settledSubsidies.reduce(
    (acc, r) => acc + (r.platformSubsidyAmount || 0),
    0
  );

  return {
    totalRides: allRides.length,
    completedRides: completed.length,
    activeOnlineDrivers: activeOnline.length,
    pendingDriverApprovals: pendingApprovals.length,
    totalPassengers: allPassengers.length,
    totalDrivers: allDrivers.length,
    grossVolumeBRL: Math.round(grossVolumeBRL * 100) / 100,
    totalPassengerRides,
    totalDeliveries,
    completedPassengerRides,
    completedDeliveries,
    activeOnlineRideDrivers,
    activeOnlineDeliveryPartners,
    grossVolumeRidesBRL: Math.round(grossVolumeRidesBRL * 100) / 100,
    grossVolumeDeliveriesBRL: Math.round(grossVolumeDeliveriesBRL * 100) / 100,
    totalPlatformSubsidyLiabilityBRL: Math.round(totalPlatformSubsidyLiabilityBRL * 100) / 100,
    pendingSubsidyCount: pendingSubsidies.length,
    settledSubsidyAmountBRL: Math.round(settledSubsidyAmountBRL * 100) / 100,
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

// --- Referrals Collection & Business Logic ---
export async function saveReferralRecord(record: ReferralRecord): Promise<void> {
  const clean = sanitizeFirestoreData(record);
  const db = getFirebaseAdminFirestore();
  if (db) {
    await db.collection('referrals').doc(record.id).set(clean, { merge: true });
  }
  const existing = localStore.referrals.get(record.id) || {};
  localStore.referrals.set(record.id, { ...existing, ...clean });
}

export async function getReferralByReferredId(referredId: string): Promise<ReferralRecord | null> {
  const id = `ref_${referredId}`;
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('referrals').doc(id).get();
    return snap.exists ? (snap.data() as ReferralRecord) : null;
  }
  return localStore.referrals.get(id) || null;
}

export async function listReferralsForPassenger(referrerId: string): Promise<ReferralRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection('referrals').where('referrerId', '==', referrerId).get();
    return snap.docs.map(doc => doc.data() as ReferralRecord);
  }
  return Array.from(localStore.referrals.values()).filter(r => r.referrerId === referrerId);
}

export async function getPassengerReferralSummary(passenger: PassengerProfile): Promise<PassengerReferralSummary> {
  let referralCode = passenger.referralCode;
  if (!referralCode) {
    referralCode = await generateUniqueReferralCode(passenger.name);
    passenger.referralCode = referralCode;
    if (passenger.referralCreditBalance === undefined) passenger.referralCreditBalance = 0;
    if (passenger.referralCreditRedeemed === undefined) passenger.referralCreditRedeemed = 0;
    await savePassengerProfile(passenger);
  }

  const referrals = await listReferralsForPassenger(passenger.uid);
  const completedReferrals = referrals.filter(r => r.status === 'REWARDED').length;

  return {
    referralCode,
    shareUrl: `https://vaicar.app/passenger/register?ref=${referralCode}`,
    referralCreditBalance: passenger.referralCreditBalance || 0,
    referralCreditRedeemed: passenger.referralCreditRedeemed || 0,
    referralDiscountAvailable: Boolean(passenger.referralDiscountAvailable),
    totalReferrals: referrals.length,
    completedReferrals,
    referrals,
  };
}

// Mutex to serialize in-memory operations and provide thread-safe concurrency guarantees in tests/memory mode
let referralTransactionMutex = Promise.resolve();

export async function processReferralRewardOnCompletion(ride: Ride): Promise<{ rewarded: boolean; rewardAmount?: number }> {
  if (ride.status !== 'COMPLETED') {
    return { rewarded: false };
  }

  const db = getFirebaseAdminFirestore();
  if (db) {
    try {
      const result = await db.runTransaction(async (transaction) => {
        const refId = `ref_${ride.passengerId}`;
        const refDocRef = db.collection('referrals').doc(refId);
        const refSnap = await transaction.get(refDocRef);
        if (!refSnap.exists) {
          return { rewarded: false };
        }
        const referral = refSnap.data() as ReferralRecord;
        if (referral.status === 'REWARDED') {
          return { rewarded: false };
        }

        const now = new Date().toISOString();
        const rewardAmount = referral.rewardAmount || 5.00;

        const referrerDocRef = db.collection('passengers').doc(referral.referrerId);
        const referrerSnap = await transaction.get(referrerDocRef);

        const passengerDocRef = db.collection('passengers').doc(ride.passengerId);
        const passengerSnap = await transaction.get(passengerDocRef);

        transaction.update(refDocRef, {
          status: 'REWARDED',
          rewardStatus: 'AWARDED',
          qualifyingRideId: ride.id,
          completedAt: now,
        });

        if (referrerSnap.exists) {
          const referrer = referrerSnap.data() as PassengerProfile;
          const currentBal = referrer.referralCreditBalance || 0;
          transaction.update(referrerDocRef, {
            referralCreditBalance: Math.round((currentBal + rewardAmount) * 100) / 100,
            updatedAt: now,
          });
        }

        if (passengerSnap.exists) {
          transaction.update(passengerDocRef, {
            referralDiscountAvailable: false,
            updatedAt: now,
          });
        }

        localStore.referrals.set(refId, {
          ...referral,
          status: 'REWARDED',
          rewardStatus: 'AWARDED',
          qualifyingRideId: ride.id,
          completedAt: now,
        });

        return { rewarded: true, rewardAmount };
      });
      return result;
    } catch (err) {
      console.error('[ReferralTransaction] Firestore transaction note:', err);
    }
  }

  // Serialized atomic processing for in-memory and unit testing
  return new Promise((resolve) => {
    referralTransactionMutex = referralTransactionMutex.then(async () => {
      const referral = await getReferralByReferredId(ride.passengerId);
      if (!referral || referral.status === 'REWARDED') {
        resolve({ rewarded: false });
        return;
      }

      const now = new Date().toISOString();
      const rewardAmount = referral.rewardAmount || 5.00;

      referral.status = 'REWARDED';
      referral.rewardStatus = 'AWARDED';
      referral.qualifyingRideId = ride.id;
      referral.completedAt = now;
      await saveReferralRecord(referral);

      // Credit the referring passenger persistently
      const referrer = await getPassengerProfile(referral.referrerId);
      if (referrer) {
        const currentBal = referrer.referralCreditBalance || 0;
        referrer.referralCreditBalance = Math.round((currentBal + rewardAmount) * 100) / 100;
        referrer.updatedAt = now;
        await savePassengerProfile(referrer);
      }

      // Consume the referred passenger's promotional first-ride discount if active
      const passenger = await getPassengerProfile(ride.passengerId);
      if (passenger && passenger.referralDiscountAvailable) {
        passenger.referralDiscountAvailable = false;
        passenger.updatedAt = now;
        await savePassengerProfile(passenger);
      }

      resolve({ rewarded: true, rewardAmount });
    }).catch((err) => {
      console.error('[ReferralMutex] Error in referral reward execution:', err);
      resolve({ rewarded: false });
    });
  });
}

/**
 * Atomically creates a ride and debits referral credit (if creditAmount > 0) in a single ACID transaction.
 *
 * Enforces strict Firestore transaction ordering: ALL READS BEFORE ALL WRITES.
 *
 * 1. If creditAmount <= 0:
 *    Directly saves the ride, preserving normal ride creation without extra overhead.
 *
 * 2. If creditAmount > 0:
 *    - In Firestore mode (db != null):
 *      - Reads:
 *        a. Passenger document (passengers/{passengerId})
 *        b. Ride document (rides/{ride.id})
 *      - Validates:
 *        a. Ride does not already exist (idempotency guard against duplicate rides)
 *        b. Passenger exists and referralCreditBalance >= creditAmount
 *      - Writes:
 *        a. Updates passenger document (referralCreditBalance, referralCreditRedeemed, updatedAt)
 *        b. Sets ride document
 *      If writing the ride fails or is aborted, Firestore rolls back the debit automatically.
 *
 *    - In local / test mode (db == null):
 *      - Uses referralTransactionMutex to serialize operations.
 *      - Validates balance and ride non-existence.
 *      - Atomically commits both ride and passenger balance update to memory.
 */
export async function createRideAtomic(
  ride: Ride,
  creditAmount: number = 0
): Promise<{ success: boolean; errorReason?: string; balanceRemaining?: number }> {
  if (creditAmount <= 0) {
    await saveRide(ride);
    return { success: true };
  }

  const db = getFirebaseAdminFirestore();
  if (db) {
    try {
      const result = await db.runTransaction(async (transaction) => {
        const pDocRef = db.collection('passengers').doc(ride.passengerId);
        const rideDocRef = db.collection('rides').doc(ride.id);

        // 1. ALL READS BEFORE ALL WRITES
        const [pSnap, rideSnap] = await Promise.all([
          transaction.get(pDocRef),
          transaction.get(rideDocRef),
        ]);

        if (rideSnap.exists) {
          return { success: false, errorReason: 'RIDE_ALREADY_EXISTS' };
        }
        if (!pSnap.exists) {
          return { success: false, errorReason: 'PASSENGER_NOT_FOUND' };
        }

        const p = pSnap.data() as PassengerProfile;
        const currentBal = p.referralCreditBalance || 0;
        if (currentBal < creditAmount) {
          return { success: false, errorReason: 'INSUFFICIENT_CREDIT' };
        }

        if ((ride as any).__simulateRideCreationFailure) {
          throw new Error('SIMULATED_STORAGE_FAILURE');
        }

        // 2. ALL WRITES AFTER ALL READS
        const newBal = Math.round((currentBal - creditAmount) * 100) / 100;
        const newRedeemed = Math.round(((p.referralCreditRedeemed || 0) + creditAmount) * 100) / 100;
        const now = new Date().toISOString();

        transaction.update(pDocRef, {
          referralCreditBalance: newBal,
          referralCreditRedeemed: newRedeemed,
          updatedAt: now,
        });

        const cleanRide = sanitizeFirestoreData(ride);
        transaction.set(rideDocRef, cleanRide);

        localStore.rides.set(ride.id, cleanRide as any);
        const cached = localStore.passengers.get(ride.passengerId);
        if (cached) {
          localStore.passengers.set(ride.passengerId, {
            ...cached,
            referralCreditBalance: newBal,
            referralCreditRedeemed: newRedeemed,
            updatedAt: now,
          });
        }

        return { success: true, balanceRemaining: newBal };
      });
      return result;
    } catch (err: any) {
      console.error('[CreateRideAtomicTransaction] Error:', err);
      return { success: false, errorReason: err?.message || 'TRANSACTION_FAILED' };
    }
  }

  return new Promise((resolve) => {
    referralTransactionMutex = referralTransactionMutex.then(async () => {
      if (localStore.rides.has(ride.id)) {
        resolve({ success: false, errorReason: 'RIDE_ALREADY_EXISTS' });
        return;
      }

      const p = await getPassengerProfile(ride.passengerId);
      if (!p) {
        resolve({ success: false, errorReason: 'PASSENGER_NOT_FOUND' });
        return;
      }
      const currentBal = p.referralCreditBalance || 0;
      if (currentBal < creditAmount) {
        resolve({ success: false, errorReason: 'INSUFFICIENT_CREDIT' });
        return;
      }

      if ((ride as any).__simulateRideCreationFailure) {
        resolve({ success: false, errorReason: 'SIMULATED_STORAGE_FAILURE' });
        return;
      }

      const newBal = Math.round((currentBal - creditAmount) * 100) / 100;
      const newRedeemed = Math.round(((p.referralCreditRedeemed || 0) + creditAmount) * 100) / 100;
      const now = new Date().toISOString();

      // Atomic commit to memory store
      const cleanRide = sanitizeFirestoreData(ride);
      localStore.rides.set(ride.id, cleanRide as any);

      p.referralCreditBalance = newBal;
      p.referralCreditRedeemed = newRedeemed;
      p.updatedAt = now;
      await savePassengerProfile(p);

      resolve({ success: true, balanceRemaining: newBal });
    }).catch((err) => {
      console.error('[CreateRideAtomicMutex] Error:', err);
      resolve({ success: false, errorReason: 'MUTEX_ERROR' });
    });
  });
}

/**
 * Atomically debits referral credit from a passenger when requesting a ride with referral credit applied.
 */
export async function debitReferralCreditForRide(
  passengerId: string,
  amount: number
): Promise<{ success: boolean; balanceRemaining?: number }> {
  if (amount <= 0) return { success: true };

  const db = getFirebaseAdminFirestore();
  if (db) {
    try {
      const result = await db.runTransaction(async (transaction) => {
        const pDocRef = db.collection('passengers').doc(passengerId);
        const pSnap = await transaction.get(pDocRef);
        if (!pSnap.exists) return { success: false };
        const p = pSnap.data() as PassengerProfile;
        const currentBal = p.referralCreditBalance || 0;
        if (currentBal < amount) return { success: false };

        const newBal = Math.round((currentBal - amount) * 100) / 100;
        const newRedeemed = Math.round(((p.referralCreditRedeemed || 0) + amount) * 100) / 100;
        const now = new Date().toISOString();

        transaction.update(pDocRef, {
          referralCreditBalance: newBal,
          referralCreditRedeemed: newRedeemed,
          updatedAt: now,
        });

        const cached = localStore.passengers.get(passengerId);
        if (cached) {
          localStore.passengers.set(passengerId, {
            ...cached,
            referralCreditBalance: newBal,
            referralCreditRedeemed: newRedeemed,
            updatedAt: now,
          });
        }

        return { success: true, balanceRemaining: newBal };
      });
      return result;
    } catch (err) {
      console.error('[DebitCreditTransaction] Error:', err);
    }
  }

  return new Promise((resolve) => {
    referralTransactionMutex = referralTransactionMutex.then(async () => {
      const p = await getPassengerProfile(passengerId);
      if (!p) {
        resolve({ success: false });
        return;
      }
      const currentBal = p.referralCreditBalance || 0;
      if (currentBal < amount) {
        resolve({ success: false });
        return;
      }
      const newBal = Math.round((currentBal - amount) * 100) / 100;
      const newRedeemed = Math.round(((p.referralCreditRedeemed || 0) + amount) * 100) / 100;
      p.referralCreditBalance = newBal;
      p.referralCreditRedeemed = newRedeemed;
      p.updatedAt = new Date().toISOString();
      await savePassengerProfile(p);
      resolve({ success: true, balanceRemaining: newBal });
    }).catch((err) => {
      console.error('[DebitCreditMutex] Error:', err);
      resolve({ success: false });
    });
  });
}

/**
 * Restores redeemed referral credit to the passenger if a ride is cancelled before completion.
 * Enforces idempotency: cannot refund twice on retried cancellations.
 */
export async function refundReferralCreditForRide(ride: Ride): Promise<{ refunded: boolean; balanceAfter?: number }> {
  const amount = ride.referralCreditAmount || 0;
  if (!ride.referralCreditApplied || amount <= 0 || ride.referralCreditRefunded) {
    return { refunded: false };
  }

  const db = getFirebaseAdminFirestore();
  if (db) {
    try {
      const result = await db.runTransaction(async (transaction) => {
        const pDocRef = db.collection('passengers').doc(ride.passengerId);
        const rideDocRef = db.collection('rides').doc(ride.id);

        // 1. ALL READS BEFORE ALL WRITES
        const [pSnap, rideSnap] = await Promise.all([
          transaction.get(pDocRef),
          transaction.get(rideDocRef),
        ]);

        if (rideSnap.exists) {
          const currentRide = rideSnap.data() as Ride;
          if (currentRide.referralCreditRefunded) {
            return { refunded: false };
          }
        }

        if (!pSnap.exists) return { refunded: false };
        const p = pSnap.data() as PassengerProfile;
        const currentBal = p.referralCreditBalance || 0;
        const newBal = Math.round((currentBal + amount) * 100) / 100;
        const currentRedeemed = p.referralCreditRedeemed || 0;
        const newRedeemed = Math.max(0, Math.round((currentRedeemed - amount) * 100) / 100);
        const now = new Date().toISOString();

        // 2. ALL WRITES AFTER ALL READS
        transaction.update(pDocRef, {
          referralCreditBalance: newBal,
          referralCreditRedeemed: newRedeemed,
          updatedAt: now,
        });

        transaction.update(rideDocRef, {
          referralCreditRefunded: true,
          referralCreditRefundedAt: now,
          updatedAt: now,
        });

        ride.referralCreditRefunded = true;
        ride.referralCreditRefundedAt = now;

        const cachedRide = localStore.rides.get(ride.id);
        if (cachedRide) {
          localStore.rides.set(ride.id, {
            ...cachedRide,
            referralCreditRefunded: true,
            referralCreditRefundedAt: now,
            updatedAt: now,
          });
        }

        const cachedP = localStore.passengers.get(ride.passengerId);
        if (cachedP) {
          localStore.passengers.set(ride.passengerId, {
            ...cachedP,
            referralCreditBalance: newBal,
            referralCreditRedeemed: newRedeemed,
            updatedAt: now,
          });
        }

        return { refunded: true, balanceAfter: newBal };
      });
      return result;
    } catch (err) {
      console.error('[RefundCreditTransaction] Error:', err);
    }
  }

  return new Promise((resolve) => {
    referralTransactionMutex = referralTransactionMutex.then(async () => {
      const currentRide = localStore.rides.get(ride.id) || await getRide(ride.id);
      if (currentRide && currentRide.referralCreditRefunded) {
        resolve({ refunded: false });
        return;
      }

      const p = await getPassengerProfile(ride.passengerId);
      if (!p) {
        resolve({ refunded: false });
        return;
      }
      const currentBal = p.referralCreditBalance || 0;
      const newBal = Math.round((currentBal + amount) * 100) / 100;
      const currentRedeemed = p.referralCreditRedeemed || 0;
      const newRedeemed = Math.max(0, Math.round((currentRedeemed - amount) * 100) / 100);
      const now = new Date().toISOString();

      p.referralCreditBalance = newBal;
      p.referralCreditRedeemed = newRedeemed;
      p.updatedAt = now;
      await savePassengerProfile(p);

      if (currentRide) {
        currentRide.referralCreditRefunded = true;
        currentRide.referralCreditRefundedAt = now;
        currentRide.updatedAt = now;
        localStore.rides.set(ride.id, currentRide);
      }
      ride.referralCreditRefunded = true;
      ride.referralCreditRefundedAt = now;

      resolve({ refunded: true, balanceAfter: newBal });
    }).catch((err) => {
      console.error('[RefundCreditMutex] Error:', err);
      resolve({ refunded: false });
    });
  });
}

/**
 * Updates promotional subsidy settlement status (e.g. from PENDING_SETTLEMENT to SETTLED)
 */
export async function updatePlatformSubsidyStatus(
  rideId: string,
  status: 'SETTLED' | 'CANCELLED'
): Promise<Ride | null> {
  const ride = await getRide(rideId);
  if (!ride) return null;
  const now = new Date().toISOString();
  const updated: Ride = {
    ...ride,
    platformSubsidyStatus: status,
    platformSubsidySettledAt: status === 'SETTLED' ? now : ride.platformSubsidySettledAt,
  };
  await saveRide(updated);
  return updated;
}

/**
 * Lists all rides with platform subsidies owed to drivers
 */
export async function listPlatformSubsidies(): Promise<Ride[]> {
  const allRides = await listAllRides();
  return allRides.filter(r => (r.platformSubsidyAmount || 0) > 0);
}


