import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { setAuthToken, getAuthToken } from '../api/client.js';
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
  adminLogin: (email: string, pass: string) => Promise<void>;
  registerEmailPassword: (email: string, pass: string) => Promise<FirebaseUser>;
  migrateAccount: (email: string, pin: string, pass: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; emailDelivered: boolean }>;
  resetPassword: (email: string, pin: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
      setIsAdmin(Boolean(data.isAdmin || data.user?.role === 'admin'));
    } catch (err) {
      console.warn('[AuthContext] Authoritative profile fetch notice:', err);
      const isAdm = email.includes('admin@vaicar.app') || email.includes('vaicar@alansmsolutions.com');
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
    const initAuth = async () => {
      const existingToken = getAuthToken();
      if (existingToken) {
        try {
          const data = await authApi.getMe();
          setProfile(data.user);
          setPassenger(data.passenger);
          setDriver(data.driver);
          setIsAdmin(Boolean(data.isAdmin || data.user?.role === 'admin'));
        } catch (err) {
          console.warn('[AuthContext] Session restore notice:', err);
        }
      }
      setLoading(false);
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          await fetchBackendProfile(token, currentUser.uid, currentUser.email || '');
        } catch (err) {
          console.error('[AuthContext] Error getting id token:', err);
        }
      } else if (!getAuthToken()) {
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

  const adminLogin = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await authApi.adminLogin({ email, password: pass });
      const customToken = res.customToken || res.token;
      if (customToken && customToken.startsWith('eyJ')) {
        const cred = await signInWithCustomToken(auth, customToken);
        const token = await cred.user.getIdToken(true);
        await fetchBackendProfile(token, cred.user.uid, cred.user.email || email);
      } else {
        setAuthToken(customToken);
        setProfile(res.user);
        setIsAdmin(true);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchBackendProfile]);

  const loginEmailPassword = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    const normalized = email.trim().toLowerCase();
    const isAdminTarget = normalized === 'admin@vaicar.app' || normalized === 'vaicar@alansmsolutions.com';

    if (isAdminTarget) {
      return await adminLogin(email, pass);
    }

    try {
      const res = await authApi.login({ email: normalized, password: pass });
      setAuthToken(res.token);
      setProfile(res.user);
      setPassenger(res.passenger || null);
      setDriver(res.driver || null);
      setIsAdmin(Boolean(res.isAdmin || res.roles?.includes('admin')));

      if (res.customToken) {
        try {
          const cred = await signInWithCustomToken(auth, res.customToken);
          setUser(cred.user);
        } catch (fbErr) {
          console.warn('[AuthContext] Optional custom token sign-in notice:', fbErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [adminLogin]);

  const registerEmailPassword = useCallback(async (email: string, pass: string): Promise<FirebaseUser> => {
    const normalized = email.trim().toLowerCase();
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalized, pass);
      return cred.user;
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(auth, normalized, pass);
        return cred.user;
      }
      throw err;
    }
  }, []);

  const migrateAccount = useCallback(async (email: string, pin: string, pass: string) => {
    setLoading(true);
    try {
      const res = await authApi.migrateAccount({ email: email.trim(), pin: pin.trim(), password: pass });
      const customToken = res.customToken;
      if (customToken) {
        const cred = await signInWithCustomToken(auth, customToken);
        const token = await cred.user.getIdToken(true);
        await fetchBackendProfile(token, cred.user.uid, cred.user.email || email);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchBackendProfile]);

  const forgotPassword = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim().toLowerCase());
      return res.data;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string, pin: string, pass: string) => {
    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        pin: pin.trim(),
        newPassword: pass,
      });
      if (res.token) {
        setAuthToken(res.token);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setProfile(null);
    setPassenger(null);
    setDriver(null);
    setIsAdmin(false);
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.warn('[AuthContext] SignOut note:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken(true);
      await fetchBackendProfile(token, auth.currentUser.uid, auth.currentUser.email || '');
    } else if (getAuthToken()) {
      try {
        const data = await authApi.getMe();
        setProfile(data.user);
        setPassenger(data.passenger);
        setDriver(data.driver);
        setIsAdmin(Boolean(data.isAdmin || data.user?.role === 'admin'));
      } catch (err) {
        console.warn('[AuthContext] refreshProfile note:', err);
      }
    }
  }, [fetchBackendProfile]);

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
      adminLogin,
      registerEmailPassword,
      migrateAccount,
      forgotPassword,
      resetPassword,
      logout,
      refreshProfile,
    }),
    [user, profile, passenger, driver, isAdmin, role, loading, loginEmailPassword, adminLogin, registerEmailPassword, migrateAccount, forgotPassword, resetPassword, logout, refreshProfile]
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
