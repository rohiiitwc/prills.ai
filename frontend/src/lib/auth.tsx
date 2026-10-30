'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl } from './api';

export interface AuthUser {
  id?: number;
  name: string;
  email: string;
  age?: number;
  token?: string;
  created_at?: string;
  login_time?: number;
  expires_at?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionExpired: boolean;
  login: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, age: number, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isSessionExpired: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  resetPassword: async () => ({ success: false }),
  logout: () => {},
  clearSessionExpired: () => {}
});

const STORAGE_KEY = 'prills_terminal_user_session';
const CREDENTIALS_KEY = 'prills_registered_credentials';

// 2 Hours = 7,200,000 milliseconds
export const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;

function getLocalCredentials(): Record<string, { name: string; password: string; age?: number }> {
  try {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(CREDENTIALS_KEY);
      return data ? JSON.parse(data) : {};
    }
  } catch {}
  return {};
}

function saveLocalCredential(email: string, name: string, password: string, age?: number) {
  try {
    if (typeof window !== 'undefined') {
      const creds = getLocalCredentials();
      creds[email.trim().toLowerCase()] = { name: name.trim(), password, age };
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
    }
  } catch {}
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);

  // Hydrate session on client load & enforce 2-hour timeout
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: AuthUser = JSON.parse(stored);
          const now = Date.now();
          if (parsed && parsed.email) {
            // Check if 2-hour session expired
            if (parsed.expires_at && now >= parsed.expires_at) {
              localStorage.removeItem(STORAGE_KEY);
              document.cookie = 'prills_token=; path=/; max-age=0';
              setUser(null);
              setIsSessionExpired(true);
            } else {
              setUser(parsed);
              setIsSessionExpired(false);
            }
          }
        }
      }
    } catch {
      // safe ignore parse errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = () => {
    setUser(null);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        document.cookie = 'prills_token=; path=/; max-age=0';
      }
    } catch {}
  };

  // Periodic active session watchdog: logs out user and prompts for re-entry every 2 hours
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (user.expires_at && now >= user.expires_at) {
        logout();
        setIsSessionExpired(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  const saveUserSession = (userData: AuthUser) => {
    const now = Date.now();
    const sessionUser: AuthUser = {
      ...userData,
      login_time: userData.login_time || now,
      expires_at: now + SESSION_DURATION_MS
    };

    setUser(sessionUser);
    setIsSessionExpired(false);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
        // Cookie expires in 7200 seconds (2 hours)
        document.cookie = `prills_token=${sessionUser.token || 'auth'}; path=/; max-age=7200; SameSite=Lax`;
      }
    } catch {}
  };

  const login = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const urls = [`${getApiBaseUrl()}/auth/login`, '/api/v1/auth/login'];
    const payload = { name: cleanName, email: cleanEmail, password };

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success && data.user) {
            saveLocalCredential(cleanEmail, cleanName || data.user.name, password, data.user.age);
            saveUserSession({
              ...data.user,
              name: data.user.name || cleanName || cleanEmail.split('@')[0],
              token: data.token
            });
            return { success: true };
          } else if (!res.ok) {
            return { 
              success: false, 
              error: data.detail || data.error || 'Password incorrect. Wrong password! If you forgot your password, please create a new password or create a new account again.' 
            };
          }
        }
      } catch {
        // try fallback url
      }
    }

    // Client-side local verification for offline/serverless sandbox
    const creds = getLocalCredentials();
    const existing = creds[cleanEmail];
    if (existing) {
      if (existing.password && existing.password !== password) {
        return {
          success: false,
          error: 'Password incorrect. Wrong password! If you forgot your password, please create a new password or create a new account again.'
        };
      }
    } else {
      // First time login auto-registers into local credentials
      saveLocalCredential(cleanEmail, cleanName || cleanEmail.split('@')[0], password, 21);
    }

    const fallbackUser: AuthUser = {
      name: cleanName || cleanEmail.split('@')[0].toUpperCase(),
      email: cleanEmail,
      age: existing?.age || 21,
      token: `prills_client_${Date.now()}`
    };
    saveUserSession(fallbackUser);
    return { success: true };
  };

  const register = async (name: string, age: number, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const urls = [`${getApiBaseUrl()}/auth/register`, '/api/v1/auth/register'];
    const payload = { name: cleanName, age: Number(age), email: cleanEmail, password };

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success && data.user) {
            saveLocalCredential(cleanEmail, cleanName, password, Number(age));
            saveUserSession({
              ...data.user,
              name: data.user.name || cleanName,
              token: data.token
            });
            return { success: true };
          } else if (!res.ok) {
            return { success: false, error: data.detail || data.error || 'Failed to create account' };
          }
        }
      } catch {
        // try fallback
      }
    }

    // Direct fallback for client-side offline or remote sandbox
    saveLocalCredential(cleanEmail, cleanName, password, Number(age) || 21);
    const fallbackUser: AuthUser = {
      name: cleanName,
      email: cleanEmail,
      age: Number(age) || 21,
      token: `prills_client_${Date.now()}`
    };
    saveUserSession(fallbackUser);
    return { success: true };
  };

  const resetPassword = async (email: string, newPassword: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const urls = [`${getApiBaseUrl()}/auth/reset-password`, '/api/v1/auth/reset-password'];
    const payload = { email: cleanEmail, new_password: newPassword };

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success && data.user) {
            saveLocalCredential(cleanEmail, data.user.name, newPassword, data.user.age);
            saveUserSession({
              ...data.user,
              token: data.token
            });
            return { success: true, message: data.message };
          } else if (!res.ok) {
            return { 
              success: false, 
              error: data.detail || data.error || 'Account not found. Please create a new account again.' 
            };
          }
        }
      } catch {
        // try fallback
      }
    }

    // Client-side local fallback update
    const creds = getLocalCredentials();
    const existing = creds[cleanEmail];
    const userName = existing?.name || cleanEmail.split('@')[0].toUpperCase();
    saveLocalCredential(cleanEmail, userName, newPassword, existing?.age || 21);

    const fallbackUser: AuthUser = {
      name: userName,
      email: cleanEmail,
      age: existing?.age || 21,
      token: `prills_client_${Date.now()}`
    };
    saveUserSession(fallbackUser);
    return { success: true, message: `Password updated successfully! Welcome back to PRILLS.AI, ${userName}.` };
  };

  const clearSessionExpired = () => {
    setIsSessionExpired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isSessionExpired,
        login,
        register,
        resetPassword,
        logout,
        clearSessionExpired
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
