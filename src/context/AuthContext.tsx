import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginResponse } from '../types/auth';
import {
  authHeaders,
  clearAuth,
  getStoredUser,
  getToken,
  saveAuth,
} from '../utils/authStorage';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const verifySession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', { headers: authHeaders() });
      if (!res.ok) throw new Error('Session expired');
      const data = (await res.json()) as { user: AuthUser };
      setUser(data.user);
      saveAuth(token, data.user);
    } catch {
      clearAuth();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      if (err?.error) throw new Error(err.error);
      if (res.status === 404) {
        throw new Error('Login service unavailable. Restart with: npm run start');
      }
      throw new Error('Invalid email or password');
    }

    const data = (await res.json()) as LoginResponse;
    saveAuth(data.token, data.user);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const token = getToken();
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: authHeaders(),
      }).catch(() => undefined);
    }
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
