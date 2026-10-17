import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);
const USER_SESSION_KEY = 'gsms_auth_user';
const LOCK_KEY = 'gsms_screen_locked';

function readStored(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    if (value === null || value === undefined || value === false) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

const NO_PERMISSIONS = { canGiveDiscount: false, maxDiscountPercent: 0, canReturn: false, canViewReports: false };

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const [currentUser, setCurrentUserState] = useState(() => readStored(USER_SESSION_KEY, null));
  const [isLocked, setIsLockedState] = useState(() => Boolean(readStored(LOCK_KEY, false)));
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  const setCurrentUser = useCallback((user) => {
    setCurrentUserState(user);
    writeStored(USER_SESSION_KEY, user);
  }, []);

  const setIsLocked = useCallback((locked) => {
    setIsLockedState(locked);
    writeStored(LOCK_KEY, locked);
  }, []);

  // Make sure the remembered user still has a valid database session
  const refreshUser = useCallback(async () => {
    const user = await api.getCurrentUser();
    if (user === undefined) return; // offline: keep the cached user
    setCurrentUser(user);
    if (!user) setIsLocked(false);
  }, [setCurrentUser, setIsLocked]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // "Remember me" off: the sign-in only lasts until the browser is closed
  useEffect(() => {
    try {
      if (localStorage.getItem('gsms_session_only') === 'true' && !sessionStorage.getItem('gsms_session_alive')) {
        api.logout?.();
        setCurrentUser(null);
        setIsLocked(false);
      }
    } catch {
      /* storage unavailable */
    }
  }, [setCurrentUser, setIsLocked]);

  const login = useCallback(async (username, password, remember = true) => {
    try {
      setIsLoadingAuth(true);
      const res = await api.login(username, password);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        setIsLocked(false);
        try {
          if (remember) localStorage.setItem('gsms_remember_username', username);
          else localStorage.removeItem('gsms_remember_username');
          localStorage.setItem('gsms_session_only', remember ? 'false' : 'true');
          sessionStorage.setItem('gsms_session_alive', '1');
        } catch {
          /* storage unavailable */
        }
        showToast(`Welcome back, ${res.user.fullName || res.user.username}!`, 'success');
        return { success: true, user: res.user };
      }
      showToast(res.error || 'Login failed. Please verify credentials.', 'error');
      return { success: false, error: res.error || 'Login failed' };
    } catch (err) {
      const errMsg = err.message || 'Error communicating with server';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    } finally {
      setIsLoadingAuth(false);
    }
  }, [showToast, setCurrentUser, setIsLocked]);

  const logout = useCallback(() => {
    api.logout?.();
    setCurrentUser(null);
    setIsLocked(false);
    showToast('Logged out successfully', 'info');
  }, [showToast, setCurrentUser, setIsLocked]);

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    const res = await api.changeOwnPassword(oldPassword, newPassword);
    if (res.success) {
      setCurrentUserState((prev) => {
        const next = prev ? { ...prev, mustChangePassword: false } : prev;
        writeStored(USER_SESSION_KEY, next);
        return next;
      });
    }
    return res;
  }, []);

  const unlock = useCallback(async (password) => {
    const res = await api.verifyOwnPassword(password);
    if (res.success && res.data) {
      setIsLocked(false);
      return { success: true };
    }
    return { success: false, error: res.error || 'Wrong password' };
  }, [setIsLocked]);

  const isAdmin = currentUser?.role === 'ADMIN';
  const permissions = isAdmin
    ? { canGiveDiscount: true, maxDiscountPercent: 100, canReturn: true, canViewReports: true }
    : { ...NO_PERMISSIONS, ...(currentUser?.effectivePermissions || {}) };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        isAdmin,
        isCashier: currentUser?.role === 'CASHIER',
        mustChangePassword: Boolean(currentUser?.mustChangePassword),
        permissions,
        can: (key) => Boolean(permissions[key]),
        isLoadingAuth,
        isLocked,
        lock: () => currentUser && setIsLocked(true),
        unlock,
        login,
        logout,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
