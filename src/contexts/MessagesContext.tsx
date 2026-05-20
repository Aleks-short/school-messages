import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Message, ReadStatus, MessageStatus, Comment, Attachment } from '@/types';
import { messagesApi, readStatusesApi } from '@/lib/api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationsContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface MessagesContextType {
  messages: Message[];
  readStatuses: ReadStatus[];
  createMessage: (msg: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string | undefined>;
  updateMessage: (id: string, data: Partial<Message>) => Promise<boolean>;
  deleteMessage: (id: string) => Promise<void>;
  deleteMessages: (ids: string[]) => Promise<void>;
  setMessageStatus: (id: string, status: MessageStatus) => Promise<void>;
  markAsRead: (messageId: string) => void;
  markAllAsRead: (messageIds: string[]) => Promise<void>;
  confirmRead: (messageId: string) => void;
  isRead: (messageId: string) => boolean;
  isConfirmed: (messageId: string) => boolean;
  getVisibleMessages: () => Message[];
  getReadersForMessage: (messageId: string) => ReadStatus[];
  getUserDrafts: () => Message[];
  getUserSentMessages: () => Message[];
  getUserArchivedMessages: () => Message[];
  toggleArchive: (messageId: string, force?: boolean) => Promise<{ alreadyArchived?: boolean; success: boolean }>;
  unarchiveMessage: (messageId: string) => Promise<void>;
  isArchived: (messageId: string) => boolean;
  getArchivedAt: (messageId: string) => string | undefined;
  addComment: (messageId: string, content: string, attachments?: Attachment[], links?: string[]) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  updateComment: (commentId: string, content: string) => Promise<void>;
  refreshMessages: () => Promise<void>;
  refreshArchives: () => Promise<void>;
}

const MessagesContext = createContext<MessagesContextType | null>(null);

export const useMessages = () => {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used within MessagesProvider');
  return ctx;
};

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [archivedSnapshots, setArchivedSnapshots] = useState<Message[]>([]);
  const [readStatuses, setReadStatuses] = useState<ReadStatus[]>([]);
  const { user, activeSchoolScope, isGlobalAdmin } = useAuth();
  const { refreshNotifications } = useNotifications();
  const queryClient = useQueryClient();

  // ─── Зареждане на съобщения чрез React Query ────────────────────────────
  const { data: fetchedMessages, refetch: refetchMessagesQuery } = useQuery({
    queryKey: ['messages'],
    queryFn: () => messagesApi.getAll(),
  });

  const { data: fetchedReadStatuses, refetch: refetchReadStatusesQuery } = useQuery({
    queryKey: ['readStatuses', user?.id],
    queryFn: () => user ? readStatusesApi.getByUser(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: fetchedArchives, refetch: refetchArchivesQuery } = useQuery({
    queryKey: ['archives', user?.id],
    queryFn: () => user ? messagesApi.getArchives(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  useEffect(() => {
    if (fetchedMessages) setMessages(fetchedMessages);
  }, [fetchedMessages]);

  useEffect(() => {
    if (fetchedReadStatuses) setReadStatuses(fetchedReadStatuses);
  }, [fetchedReadStatuses]);

  useEffect(() => {
    if (fetchedArchives) setArchivedSnapshots(fetchedArchives);
  }, [fetchedArchives]);

  const refreshMessages = useCallback(async () => {
    await refetchMessagesQuery();
  }, [refetchMessagesQuery]);

  const refreshReadStatuses = useCallback(async () => {
    await refetchReadStatusesQuery();
  }, [refetchReadStatusesQuery]);

  const refreshArchives = useCallback(async () => {
    await refetchArchivesQuery();
  }, [refetchArchivesQuery]);

  // ─── CRUD операции ────────────────────────────────────────────────

  const createMessage = useCallback(async (msg: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const res = await messagesApi.create({
        title: msg.title,
        content: msg.content,
        category: msg.category,
        status: msg.status,
        importance: msg.importance,
        targetAudience: msg.targetAudience,
        authorId: msg.authorId,
        authorSchool: msg.authorSchool,
        commentsEnabled: msg.commentsEnabled,
        attachments: msg.attachments,
        links: msg.links,
      });
      await refreshMessages();
      await refreshReadStatuses();
      await refreshNotifications();
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      return res.id;
    } catch (err) {
      console.error('Грешка при създаване на съобщение:', err);
      return undefined;
    }
  }, [queryClient, refreshMessages, refreshReadStatuses, refreshNotifications]);

  const updateMessage = useCallback(async (id: string, data: Partial<Message>) => {
    try {
      await messagesApi.update(id, {
        title: data.title,
        content: data.content,
        category: data.category,
        status: data.status,
        importance: data.importance,
        targetAudience: data.targetAudience,
        commentsEnabled: data.commentsEnabled,
        attachments: data.attachments,
        links: data.links,
      });
      await refreshMessages();
      await refreshReadStatuses();
      await refreshNotifications();
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      return true;
    } catch (err) {
      console.error('Грешка при обновяване на съобщение:', err);
      return false;
    }
  }, [queryClient, refreshMessages, refreshReadStatuses, refreshNotifications]);

  const deleteMessage = useCallback(async (id: string) => {
    try {
      await messagesApi.delete(id);
      setMessages(prev => prev.filter(message => message.id !== id));
      setArchivedSnapshots(prev => prev.filter(message => message.id !== id));
      await refreshMessages();
      await refreshNotifications();
    } catch (err) {
      console.error('Грешка при изтриване на съобщение:', err);
      throw err;
    }
  }, [refreshMessages, refreshNotifications]);

  const deleteMessages = useCallback(async (ids: string[]) => {
    try {
      await messagesApi.deleteMultiple(ids);
      setMessages(prev => prev.filter(message => !ids.includes(message.id)));
      setArchivedSnapshots(prev => prev.filter(message => !ids.includes(message.id)));
      await refreshMessages();
      await refreshNotifications();
    } catch (err) {
      console.error('Грешка при изтриване на съобщения:', err);
      throw err;
    }
  }, [refreshMessages, refreshNotifications]);

  const setMessageStatus = useCallback(async (id: string, status: MessageStatus) => {
    await updateMessage(id, { status });
  }, [updateMessage]);

  const toggleArchive = useCallback(async (messageId: string, force: boolean = false) => {
    if (!user) return { success: false };
    
    try {
      const currentlyArchived = archivedSnapshots.some(m => m.id === messageId);
      
      if (currentlyArchived && !force) {
        return { alreadyArchived: true, success: false };
      }

      await messagesApi.archive(messageId, force);
      await refreshArchives();
      return { success: true };
    } catch (err: any) {
      if (err.message.includes('409') || err.message.includes('вече е архивирано')) {
        return { alreadyArchived: true, success: false };
      }
      console.error('Грешка при архивиране:', err);
      return { success: false };
    }
  }, [user, archivedSnapshots, refreshArchives]);

  const unarchiveMessage = useCallback(async (messageId: string) => {
    if (!user) return;
    try {
      await messagesApi.unarchive(messageId);
      await refreshArchives();
    } catch (err) {
      console.error('Грешка при премахване от архива:', err);
    }
  }, [user, refreshArchives]);

  const isArchived = useCallback((messageId: string) => {
    if (!user) return false;
    return archivedSnapshots.some(m => m.id === messageId);
  }, [user, archivedSnapshots]);

  const getArchivedAt = useCallback((messageId: string) => {
    if (!user) return undefined;
    const archived = archivedSnapshots.find(m => m.id === messageId);
    return archived?.archivedAt;
  }, [user, archivedSnapshots]);

  // ─── Статус за прочитане ──────────────────────────────────────────

  const markAsRead = useCallback(async (messageId: string) => {
    if (!user) return;
    try {
      await readStatusesApi.markAsRead(messageId, user.id);
      setReadStatuses(prev => {
        if (prev.find(r => r.messageId === messageId && r.userId === user.id)) return prev;
        return [...prev, { messageId, userId: user.id, readAt: new Date().toISOString() }];
      });
    } catch (err) {
      console.error('Грешка при маркиране като прочетено:', err);
    }
  }, [user]);

  const markAllAsRead = useCallback(async (messageIds: string[]) => {
    if (!user) return;
    try {
      await readStatusesApi.markAllAsRead(messageIds, user.id);
      const now = new Date().toISOString();
      setReadStatuses(prev => {
        const newStatuses = [...prev];
        for (const messageId of messageIds) {
          if (!newStatuses.find(r => r.messageId === messageId && r.userId === user.id)) {
            newStatuses.push({ messageId, userId: user.id, readAt: now });
          }
        }
        return newStatuses;
      });
    } catch (err) {
      console.error('Грешка при маркиране на всички като прочетени:', err);
    }
  }, [user]);

  const confirmRead = useCallback(async (messageId: string) => {
    if (!user) return;
    try {
      await readStatusesApi.confirm(messageId, user.id);
      setReadStatuses(prev => {
        const existing = prev.find(r => r.messageId === messageId && r.userId === user.id);
        if (existing) {
          return prev.map(r => r.messageId === messageId && r.userId === user.id ? { ...r, confirmed: true } : r);
        }
        return [...prev, { messageId, userId: user.id, readAt: new Date().toISOString(), confirmed: true }];
      });
    } catch (err) {
      console.error('Грешка при потвърждение:', err);
    }
  }, [user]);

  const isRead = useCallback((messageId: string) => {
    if (!user) return false;
    // Авторът винаги се счита за прочел собственото си съобщение
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.authorId === user.id) return true;
    
    return readStatuses.some(r => r.messageId === messageId && r.userId === user.id);
  }, [user, readStatuses, messages]);

  const isConfirmed = useCallback((messageId: string) => {
    if (!user) return false;
    // Авторът не трябва да потвърждава собственото си съобщение
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.authorId === user.id) return true;

    return readStatuses.some(r => r.messageId === messageId && r.userId === user.id && r.confirmed);
  }, [user, readStatuses, messages]);

  const getReadersForMessage = useCallback((messageId: string) => {
    return readStatuses.filter(r => r.messageId === messageId);
  }, [readStatuses]);

  // ─── Филтриране ───────────────────────────────────────────────────

  const getVisibleMessages = useCallback(() => {
    if (!user) return [];
    return messages.filter(m => {
      // ПРИНЦИП НА ПЪЛНО РАЗДЕЛЕНИЕ НА УЧИЛИЩАТА:
      // Потребителите виждат само съобщения от тяхното училище.
      // Глобалните админи виждат всичко. Потребителите виждат съобщения от собственото училище ИЛИ от глобален админ.
      const isGlobalAdminUser = isGlobalAdmin;
      const isMessageFromGlobalAdmin = m.authorRole === 'admin' && !m.authorSchool;
      const sameSchool = m.authorSchool === user.school;
      const inAdminScope = !activeSchoolScope || m.authorSchool === activeSchoolScope;

      if (isGlobalAdminUser) {
        if (!inAdminScope && !isMessageFromGlobalAdmin) return false;
      } else if (!sameSchool && !isMessageFromGlobalAdmin) {
        return false;
      }

      // Авторите винаги виждат своите съобщения
      const isAuthor = m.authorId === user.id;

      if (m.status === 'draft' && !isAuthor) return false;
      
      // Глобално архивираните съобщения се крият за всички
      if (m.status === 'archived') return false;

      if (isGlobalAdminUser) {
        return true;
      }
      
      // Публикувани съобщения - филтриране по аудитория
      if (m.status === 'published') {
        if (isAuthor) return true;
        if (m.targetAudience === 'all') return true;
        if (m.targetAudience === 'admin' && user.role === 'admin') return true;
        if (m.targetAudience === 'students' && user.role === 'student') return true;
        if (m.targetAudience === 'teachers' && user.role === 'teacher') return true;
        if (m.targetAudience === 'director' && ['admin', 'director'].includes(user.role)) return true;
        if (m.targetAudience === user.class) return true;
        if (m.targetAudience === `class:${user.class}`) return true;
        if (m.targetAudience === `user:${user.id}`) return true;
        
        if (m.targetAudience.startsWith('users:')) {
          const userIds = m.targetAudience.replace('users:', '').split(',');
          if (userIds.includes(user.id)) return true;
        }
        
        if (m.targetAudience.startsWith('subject:') && user.role === 'teacher') {
          const targetSubj = m.targetAudience.replace('subject:', '');
          if (user.subject?.split(', ')?.includes(targetSubj)) return true;
        }
      }

      return false;
    });
  }, [activeSchoolScope, isGlobalAdmin, user, messages]);

  const getUserDrafts = useCallback(() => {
    if (!user) return [];
    return messages.filter(m => {
      const sameSchool = m.authorSchool === user.school;
      return m.status === 'draft' && m.authorId === user.id && (isGlobalAdmin || sameSchool);
    });
  }, [isGlobalAdmin, user, messages]);

  const getUserSentMessages = useCallback(() => {
    if (!user) return [];
    return messages.filter(m => {
      const sameSchool = m.authorSchool === user.school;
      return m.authorId === user.id && m.status === 'published' && (isGlobalAdmin || sameSchool);
    });
  }, [isGlobalAdmin, user, messages]);

  const getUserArchivedMessages = useCallback(() => {
    if (!user) return [];
    return archivedSnapshots;
  }, [user, archivedSnapshots]);

  // ─── Коментари ────────────────────────────────────────────────────

  const addComment = useCallback(async (messageId: string, content: string, attachments?: Attachment[], links?: string[]) => {
    if (!user) return;
    try {
      await messagesApi.addComment(messageId, user.id, content, attachments, links);
      await refreshMessages();
    } catch (err) {
      console.error('Грешка при добавяне на коментар:', err);
    }
  }, [user, refreshMessages]);

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      await messagesApi.deleteComment(commentId);
      await refreshMessages();
    } catch (err) {
      console.error('Грешка при изтриване на коментар:', err);
    }
  }, [refreshMessages]);

  const updateComment = useCallback(async (commentId: string, content: string) => {
    try {
      await messagesApi.updateComment(commentId, content);
      await refreshMessages();
    } catch (err) {
      console.error('Грешка при обновяване на коментар:', err);
    }
  }, [refreshMessages]);

  return (
    <MessagesContext.Provider value={{
      messages, readStatuses, createMessage, updateMessage, deleteMessage, deleteMessages,
      setMessageStatus, markAsRead, markAllAsRead, confirmRead, isRead, isConfirmed,
      getVisibleMessages, getReadersForMessage, getUserDrafts, getUserSentMessages, getUserArchivedMessages, toggleArchive, unarchiveMessage, isArchived, getArchivedAt, addComment,
      deleteComment, updateComment,
      refreshMessages, refreshArchives
    }}>
      {children}
    </MessagesContext.Provider>
  );
};
