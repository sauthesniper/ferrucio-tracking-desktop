import { createContext, useContext, useState, type ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function decodeToken(token: string): { userId: number; username: string; role: string; iat: number; exp: number } | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem('auth_token');
    if (stored && !isTokenExpired(stored)) return stored;
    if (stored) localStorage.removeItem('auth_token');
    return null;
  });

  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('auth_token');
    if (stored && !isTokenExpired(stored)) {
      const payload = decodeToken(stored);
      if (payload) return { id: payload.userId, username: payload.username, role: payload.role };
    }
    return null;
  });

  const login = async (username: string, password: string) => {
    const res = await api.post('/api/auth/login', { username, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser({ id: userData.id, username: userData.username, role: userData.role });
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
