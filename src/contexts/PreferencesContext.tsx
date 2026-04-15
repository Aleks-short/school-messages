import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UserPreferences } from '@/types';
import { preferencesApi } from '@/lib/api';
import { useAuth } from './AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PreferencesContextType {
  preferences: UserPreferences | null;
  updatePreferences: (data: Partial<UserPreferences>) => Promise<void>;
  isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
};

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['preferences', user?.id],
    queryFn: () => user ? preferencesApi.get(user.id) : Promise.resolve(null),
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<UserPreferences>) => 
      user ? preferencesApi.update(user.id, data) : Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences', user?.id] });
    },
  });

  const updatePreferences = useCallback(async (data: Partial<UserPreferences>) => {
    await mutation.mutateAsync(data);
  }, [mutation]);

  return (
    <PreferencesContext.Provider value={{ preferences: preferences || null, updatePreferences, isLoading }}>
      {children}
    </PreferencesContext.Provider>
  );
};
