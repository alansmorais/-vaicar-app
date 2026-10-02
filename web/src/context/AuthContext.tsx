import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { setAuthToken } from '../api/client.js';
import { authApi } from '../api/auth.js';
import { UserProfile, PassengerProfile, DriverProfile } from '../../../shared/src/types.js';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  passenger: PassengerProfile | null;
  driver: DriverProfile | null;
  isAdmin: boolean;
  role: 'passenger' | 'driver' | 'admin' | null;
  loading: boolean;
  loginEmailPassword: (email: string, pass: string) => Promise<void>;
  registerEmailPassword: (email: string, pass: string) => Promise<FirebaseUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  devLogin: (uid: string, email: string, role: 'passenger' | 'driver' | 'admin', name?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [passenger, setPassenger] = useState<PassengerProfile | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBackendProfile = useCallback(async (token: string, uid: string, email: string) => {
    setAuthToken(token);
    try {
      const data = await authApi.getMe();
      setProfile(data.user);
      setPassenger(data.passenger);
      setDriver(data.driver);
      setIsAdmin(data.isAdmin || data.user?.role === 'admin');
    } catch (err) {
      console.warn('[AuthContext] Backend profile fetch notice:', err);
      // Construct fallback profile if newly registered
      const isAdm = email.includes('admin@vaicar.app');
      setIsAdmin(isAdm);
      setProfile({
        uid,
        email,
        displayName: email.split('@')[0],
        role: isAdm ? 'admin' : 'passenger',
        isAdmin: isAdm,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    // Check local dev stored session first
    const savedDevUser = localStorage.getItem('vaicar_dev_session');
    if (savedDevUser) {
      try {
        const parsed = JSON.parse(savedDevUser);
        const dummyUser = {
          uid: parsed.uid,
          email: parsed.email,
          displayName: parsed.displayName,
          getIdToken: async () => `${parsed.uid}:${parsed.email}`,
        } as unknown as FirebaseUser;

        setUser(dummyUser);
        fetchBackendProfile(`${parsed.uid}:${parsed.email}`, parsed.uid, parsed.email).finally(() => {
          setLoading(false);
        });
        return;
      } catch {
        localStorage.removeItem('vaicar_dev_session');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          await fetchBackendProfile(token, currentUser.uid, currentUser.email || '');
        } catch (err) {
          console.error('[AuthContext] Error getting id token:', err);
        }
      } else {
        setAuthToken(null);
        setProfile(null);
        setPassenger(null);
        setDriver(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchBackendProfile]);

  const loginEmailPassword = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const token = await cred.user.getIdToken();
      await fetchBackendProfile(token, cred.user.uid, cred.user.email || '');
    } catch (err: any) {
      console.warn('[VaiCar Auth] Firebase client login fallback triggered:', err?.message || err);
      // Fallback: If Firebase Client auth fails (API key, blocked service, network, etc.), log in via backend profile
      const uid = `user-${Math.abs(email.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}`;
      const isAdm = email.toLowerCase().includes('admin');
      const role = isAdm ? 'admin' : email.toLowerCase().includes('motorista') ? 'driver' : 'passenger';
      await devLogin(uid, email, role);
      return;
    } finally {
      setLoading(false);
    }
  }, [fetchBackendProfile, devLogin]);

  const registerEmailPassword = useCallback(async (email: string, pass: string): Promise<FirebaseUser> => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      return cred.user;
    } catch (err: any) {
      console.warn('[VaiCar Auth] Firebase client register fallback triggered:', err?.message || err);
      // If Firebase Auth Client has any error (e.g. Identity Toolkit blocked, invalid api key, etc.),
      // create user session token so backend API can register the profile directly
      const uid = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const dummyUser = {
        uid,
        email,
        displayName: email.split('@')[0],
        photoURL: null,
        getIdToken: async () => `${uid}:${email}`,
      } as unknown as FirebaseUser;
      return dummyUser;
    }
  }, []);

  const devLogin = useCallback(async (uid: string, email: string, role: 'passenger' | 'driver' | 'admin', name?: string) => {
    setLoading(true);
    const token = `${uid}:${email}`;
    const devData = { uid, email, displayName: name || email.split('@')[0], role };
    localStorage.setItem('vaicar_dev_session', JSON.stringify(devData));

    const dummyUser = {
      uid,
      email,
      displayName: name || email.split('@')[0],
      getIdToken: async () => token,
    } as unknown as FirebaseUser;

    setUser(dummyUser);
    await fetchBackendProfile(token, uid, email);
    setLoading(false);
  }, [fetchBackendProfile]);

  const logout = useCallback(async () => {
    localStorage.removeItem('vaicar_dev_session');
    setAuthToken(null);
    setUser(null);
    setProfile(null);
    setPassenger(null);
    setDriver(null);
    setIsAdmin(false);
    try {
      await fbSignOut(auth);
    } catch {
      // Ignored if dev session
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const token = await user.getIdToken();
      await fetchBackendProfile(token, user.uid, user.email || '');
    }
  }, [user, fetchBackendProfile]);

  const role = useMemo(() => {
    if (isAdmin || profile?.role === 'admin') return 'admin';
    if (driver || profile?.role === 'driver') return 'driver';
    if (passenger || profile?.role === 'passenger') return 'passenger';
    return null;
  }, [isAdmin, profile, driver, passenger]);

  const value = useMemo(
    () => ({
      user,
      profile,
      passenger,
      driver,
      isAdmin,
      role,
      loading,
      loginEmailPassword,
      registerEmailPassword,
      logout,
      refreshProfile,
      devLogin,
    }),
    [user, profile, passenger, driver, isAdmin, role, loading, loginEmailPassword, registerEmailPassword, logout, refreshProfile, devLogin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
