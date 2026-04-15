import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Notification, NotificationSettings } from '@/types';
import { notificationsApi } from '@/lib/api';
import { useAuth } from './AuthContext';
import { useQuery } from '@tanstack/react-query';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  replaceNotificationForMessage: (messageId: string, n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAsReadByMessage: (messageId: string) => void;
  markAllAsRead: () => void;
  markMultipleAsRead: (ids: string[]) => void;
  deleteNotification: (id: string) => void;
  deleteNotifications: (ids: string[]) => void;
  getUserNotifications: () => Notification[];
  refreshNotifications: () => Promise<void>;
  getSettings: () => Promise<NotificationSettings>;
  updateSettings: (settings: NotificationSettings) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  // ─── Зареждане на уведомления от backend чрез React Query
  const { data: fetchedNotifications, refetch } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => user ? notificationsApi.getByUser(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  useEffect(() => {
    if (fetchedNotifications) {
      setNotifications(fetchedNotifications);
    }
  }, [fetchedNotifications]);

  const refreshNotifications = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const getUserNotifications = useCallback(() => {
    if (!user) return [];
    return notifications
      .filter(n => n.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [user, notifications]);

  const unreadCount = getUserNotifications().filter(n => !n.read).length;

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    // Добавяме локално – backend ще създава уведомления автоматично при нужда
    const newN: Notification = {
      ...n,
      id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [newN, ...prev]);
  }, []);

  const replaceNotificationForMessage = useCallback((messageId: string, n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    setNotifications(prev => {
      const filtered = prev.filter(
        existing => !(existing.messageId === messageId && existing.userId === n.userId)
      );
      const newN: Notification = {
        ...n,
        id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
        createdAt: new Date().toISOString(),
        read: false,
      };
      return [newN, ...filtered];
    });
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Грешка при маркиране на уведомление:', err);
    }
  }, []);

  const markAsReadByMessage = useCallback(async (messageId: string) => {
    if (!user) return;
    try {
      await notificationsApi.markByMessage(user.id, messageId);
      setNotifications(prev => prev.map(n => 
        (n.userId === user.id && n.messageId === messageId) ? { ...n, read: true } : n
      ));
    } catch (err) {
      console.error('Грешка при маркиране на уведомления по съобщение:', err);
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    try {
      await notificationsApi.markAllAsRead(user.id);
      setNotifications(prev => prev.map(n => n.userId === user.id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Грешка при маркиране на всички уведомления:', err);
    }
  }, [user]);

  const markMultipleAsRead = useCallback(async (ids: string[]) => {
    if (!user) return;
    try {
      // Mark individually for now as there is no bulk mark endpoint specifically for IDs
      // But we can add it to backend if needed.
      // Actually notificationsApi.markAsRead exists.
      for (const id of ids) {
        await notificationsApi.markAsRead(id);
      }
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Грешка при маркиране на избрани уведомления:', err);
    }
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await notificationsApi.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Грешка при изтриване на уведомление:', err);
    }
  }, []);

  const deleteNotifications = useCallback(async (ids: string[]) => {
    try {
      await notificationsApi.deleteMultiple(ids);
      setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    } catch (err) {
      console.error('Грешка при изтриване на уведомления:', err);
    }
  }, []);

  const getSettings = useCallback(async () => {
    if (!user) throw new Error('No user');
    return await notificationsApi.getSettings(user.id);
  }, [user]);

  const updateSettings = useCallback(async (settings: NotificationSettings) => {
    if (!user) return;
    try {
      await notificationsApi.updateSettings(user.id, settings);
    } catch (err) {
      console.error('Грешка при обновяване на настройките за уведомления:', err);
      throw err;
    }
  }, [user]);

  return (
    <NotificationsContext.Provider value={{
      notifications, unreadCount, addNotification, replaceNotificationForMessage, markAsRead, markAsReadByMessage, markAllAsRead, markMultipleAsRead, deleteNotification, deleteNotifications, getUserNotifications, refreshNotifications, getSettings, updateSettings
    }}>
      {children}
    </NotificationsContext.Provider>
  );
};
