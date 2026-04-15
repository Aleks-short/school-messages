import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AuditLogEntry } from '@/types';
import { auditApi } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';

interface AuditLogContextType {
  entries: AuditLogEntry[];
  addEntry: (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => void;
  deleteEntry: (id: string) => void;
}

const AuditLogContext = createContext<AuditLogContextType | null>(null);

export const useAuditLog = () => {
  const ctx = useContext(AuditLogContext);
  if (!ctx) throw new Error('useAuditLog must be used within AuditLogProvider');
  return ctx;
};

export const AuditLogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const { user, activeSchoolScope, isGlobalAdmin } = useAuth();
  const queryClient = useQueryClient();

  // ─── Зареждане от backend чрез React Query ─────────────────────────
  const { data: fetchedEntries } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => auditApi.getAll(),
  });

  useEffect(() => {
    if (fetchedEntries) setEntries(fetchedEntries);
  }, [fetchedEntries]);

  const addEntry = useCallback((entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => {
    // Backend вече създава audit записи автоматично при CRUD операции
    // Този метод обновява локалния state
    const newEntry: AuditLogEntry = {
      ...entry,
      id: 'al' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setEntries(prev => [newEntry, ...prev]);
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    try {
      await auditApi.delete(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    } catch (e) {
      console.error('Failed to delete audit entry:', e);
    }
  }, [queryClient]);

  const filteredEntries = React.useMemo(() => {
    if (!user) return [];
    if (isGlobalAdmin) {
      if (!activeSchoolScope) return entries;
      return entries.filter(e => !e.performedBySchool || e.performedBySchool === activeSchoolScope);
    }
    // Directors shouldn't see other schools either, so we apply the same rule
    return entries.filter(e => e.performedBySchool === user.school);
  }, [activeSchoolScope, entries, isGlobalAdmin, user]);

  return (
    <AuditLogContext.Provider value={{ entries: filteredEntries, addEntry, deleteEntry }}>
      {children}
    </AuditLogContext.Provider>
  );
};
