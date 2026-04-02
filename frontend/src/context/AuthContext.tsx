import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser } from '../types';
import api from '../api/client';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearPasswordResetFlag: () => void;
  isLoading: boolean;
  canEdit: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('rm_token');
    const savedUser = localStorage.getItem('rm_user');
    const savedMustChange = localStorage.getItem('rm_must_change') === '1';
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as AuthUser;
        setToken(savedToken);
        setUser(parsedUser);
        setMustChangePassword(savedMustChange);
        api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } catch {
        localStorage.removeItem('rm_token');
        localStorage.removeItem('rm_user');
        localStorage.removeItem('rm_must_change');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password });
    const { token: newToken, user: newUser, mustChangePassword: mustChange } = data;
    localStorage.setItem('rm_token', newToken);
    localStorage.setItem('rm_user', JSON.stringify(newUser));
    localStorage.setItem('rm_must_change', mustChange ? '1' : '0');
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
    setMustChangePassword(!!mustChange);
  };

  const logout = () => {
    localStorage.removeItem('rm_token');
    localStorage.removeItem('rm_user');
    localStorage.removeItem('rm_must_change');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
  };

  const clearPasswordResetFlag = () => {
    localStorage.setItem('rm_must_change', '0');
    setMustChangePassword(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      mustChangePassword,
      login,
      logout,
      clearPasswordResetFlag,
      isLoading,
      canEdit: user?.role === 'team_lead' || user?.role === 'manager',
      isManager: user?.role === 'manager',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
