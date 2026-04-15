import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { authApi, usersApi, setApiToken } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

interface AuthActionResult {
  success: boolean;
  user?: User;
  error?: string;
}

type RegisterPayload = Omit<User, 'id' | 'registrationStatus' | 'registrationReviewNote' | 'registrationReviewedAt'> & {
  password: string;
};

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (data: RegisterPayload) => Promise<AuthActionResult>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  allUsers: User[];
  systemUsers: User[];
  activeSchoolScope: string;
  setActiveSchoolScope: (school: string) => void;
  isGlobalAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSchoolScope, setActiveSchoolScopeState] = useState('');

  // ─── Зареждане на всички потребители чрез React Query ───────────────
  const { data: fetchedUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
    enabled: !!user,
  });

  useEffect(() => {
    if (fetchedUsers) setUsers(fetchedUsers);
  }, [fetchedUsers]);

  useEffect(() => {
    const token = localStorage.getItem('school-connect-token');
    if (token) {
      authApi.me()
        .then(setUser)
        .catch(() => {
          setApiToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const isGlobalAdmin = Boolean(user && user.role === 'admin' && !user.school);

  useEffect(() => {
    if (!user) {
      setActiveSchoolScopeState('');
      return;
    }

    if (user.role === 'admin' && !user.school) {
      const storedScope = localStorage.getItem('admin-school-scope') || '';
      setActiveSchoolScopeState(storedScope);
      return;
    }

    setActiveSchoolScopeState(user.school || '');
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      const found = await authApi.login(email, password);
      setUser(found);
      return { success: true, user: found };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неуспешен вход.';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterPayload) => {
    try {
      setLoading(true);
      await usersApi.create(data);
      return await login(data.email, data.password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неуспешна регистрация.';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('dashboard_activity_page');
    localStorage.removeItem('admin-school-scope');
    setApiToken(null);
    setUser(null);
  }, []);

  const setActiveSchoolScope = useCallback((school: string) => {
    setActiveSchoolScopeState(school);
    if (school) {
      localStorage.setItem('admin-school-scope', school);
    } else {
      localStorage.removeItem('admin-school-scope');
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user) return;
    try {
      await usersApi.update(user.id, data);
      setUser(prev => prev ? { ...prev, ...data } : null);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...data } : u));
    } catch (err) {
      console.error('Грешка при обновяване на профила:', err);
    }
  }, [user]);

  const filteredUsers = React.useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin' && !user.school) {
      if (!activeSchoolScope) return users;
      return users.filter(u => u.school === activeSchoolScope);
    }
    return users.filter(u => u.school === user.school);
  }, [activeSchoolScope, user, users]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfile, allUsers: filteredUsers, systemUsers: users, activeSchoolScope, setActiveSchoolScope, isGlobalAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
