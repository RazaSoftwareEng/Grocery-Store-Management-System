import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);
const USER_SESSION_KEY = 'gsms_auth_user';

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Supabase: make sure the remembered user still has a valid database session
  useEffect(() => {
    if (!api.getCurrentUser) return;
    let isMounted = true;
    api.getCurrentUser().then((user) => {
      if (!isMounted) return;
      setCurrentUser(user);
      if (user) {
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_SESSION_KEY);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      setIsLoadingAuth(true);
      const res = await api.login(username, password);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(res.user));
        showToast(`Welcome back, ${res.user.fullName || res.user.username}!`, 'success');
        return { success: true, user: res.user };
      } else {
        showToast(res.error || 'Login failed. Please verify credentials.', 'error');
        return { success: false, error: res.error || 'Login failed' };
      }
    } catch (err) {
      const errMsg = err.message || 'Error communicating with server';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    } finally {
      setIsLoadingAuth(false);
    }
  }, [showToast]);

  const quickLogin = useCallback(async (role) => {
    if (role === 'ADMIN' || role === 'admin') {
      return await login('admin', 'admin123');
    } else {
      return await login('cashier1', '1234');
    }
  }, [login]);

  const logout = useCallback(() => {
    api.logout?.();
    setCurrentUser(null);
    localStorage.removeItem(USER_SESSION_KEY);
    showToast('Logged out successfully', 'info');
  }, [showToast]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        isAdmin: currentUser?.role === 'ADMIN',
        isCashier: currentUser?.role === 'CASHIER',
        isLoadingAuth,
        login,
        quickLogin,
        logout,
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
