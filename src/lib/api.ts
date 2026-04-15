// ─── API клиент за връзка с backend ─────────

import type {
  User,
  Message,
  ReadStatus,
  Notification,
  AuditLogEntry,
  Attachment,
  NotificationSettings,
  MessageCategoryOption,
  SchoolClassOption,
} from '@/types';

export interface AuthResponse {
  user: User;
  token: string;
}

export type UserCreatePayload = Omit<User, 'id' | 'registrationStatus' | 'registrationReviewNote' | 'registrationReviewedAt'> & {
  password: string;
};

export interface UserCreateResponse {
  id: string;
  message: string;
  registrationStatus: User['registrationStatus'];
}

export const SERVER_URL = 'http://localhost:3001';
const API_BASE = `${SERVER_URL}/api`;

// ─── Помощна функция ────────────────────────────────────────────────

let apiToken: string | null = localStorage.getItem('school-connect-token');

export const setApiToken = (token: string | null) => {
  apiToken = token;
  if (token) {
    localStorage.setItem('school-connect-token', token);
  } else {
    localStorage.removeItem('school-connect-token');
  }
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════
// Автентикация
// ═══════════════════════════════════════════════════════════════════════

export const authApi = {
  async login(email: string, password: string): Promise<User> {
    const { user, token } = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setApiToken(token);
    return user;
  },

  me(): Promise<User> {
    return request<User>('/auth/me');
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Потребители
// ═══════════════════════════════════════════════════════════════════════

export const usersApi = {
  getAll(): Promise<User[]> {
    return request<User[]>('/users');
  },

  getById(id: string): Promise<User> {
    return request<User>(`/users/${id}`);
  },

  create(data: UserCreatePayload): Promise<UserCreateResponse> {
    return request<UserCreateResponse>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<User>): Promise<void> {
    return request<void>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<void> {
    return request<void>(`/users/${id}`, { method: 'DELETE' });
  },

  changePassword(id: string, password: string): Promise<void> {
    return request<void>(`/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Съобщения
// ═══════════════════════════════════════════════════════════════════════

export interface MessageFilters {
  status?: string;
  category?: string;
  importance?: string;
  audience?: string;
  authorId?: string;
  search?: string;
}

export const messagesApi = {
  getAll(filters?: MessageFilters): Promise<Message[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.set(key, val);
      });
    }
    const qs = params.toString();
    return request<Message[]>(`/messages${qs ? `?${qs}` : ''}`);
  },

  getById(id: string): Promise<Message> {
    return request<Message>(`/messages/${id}`);
  },

  create(data: {
    title: string;
    content: string;
    category: string;
    status?: string;
    importance?: string;
    targetAudience?: string;
    authorId: string;
    authorSchool?: string;
    commentsEnabled?: boolean;
    attachments?: Attachment[];
    links?: string[];
  }): Promise<{ id: string }> {
    return request<{ id: string }>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: {
    title?: string;
    content?: string;
    category?: string;
    status?: string;
    importance?: string;
    targetAudience?: string;
    commentsEnabled?: boolean;
    editedBy?: string;
    changes?: string;
    attachments?: Attachment[];
    links?: string[];
  }): Promise<void> {
    return request<void>(`/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<void> {
    return request<void>(`/messages/${id}`, { method: 'DELETE' });
  },

  deleteMultiple(ids: string[]): Promise<void> {
    return request<void>('/messages/delete-multiple', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  addComment(messageId: string, authorId: string, content: string, attachments?: Attachment[], links?: string[]): Promise<{ id: string }> {
    return request<{ id: string }>(`/messages/${messageId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ authorId, content, attachments, links }),
    });
  },

  deleteComment(commentId: string): Promise<void> {
    return request<void>(`/messages/comments/${commentId}`, { method: 'DELETE' });
  },

  updateComment(commentId: string, content: string): Promise<void> {
    return request<void>(`/messages/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  getArchives(userId: string): Promise<Message[]> {
    return request<Message[]>(`/messages/archives/${userId}`);
  },

  archive(id: string, force: boolean = false): Promise<void> {
    return request<void>(`/messages/${id}/archive${force ? '?force=true' : ''}`, {
      method: 'POST',
    });
  },

  unarchive(id: string): Promise<void> {
    return request<void>(`/messages/${id}/archive`, {
      method: 'DELETE',
    });
  },

  bulkArchive(ids: string[]): Promise<void> {
    return request<void>('/messages/bulk-archive', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Качване на файлове
// ═══════════════════════════════════════════════════════════════════════

export const uploadsApi = {
  async uploadFiles(files: File[]): Promise<Attachment[]> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: {
        'Authorization': apiToken ? `Bearer ${apiToken}` : '',
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    return res.json();
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Уведомления
// ═══════════════════════════════════════════════════════════════════════

export const notificationsApi = {
  getByUser(userId: string): Promise<Notification[]> {
    return request<Notification[]>(`/notifications/${userId}`);
  },

  getUnreadCount(userId: string): Promise<{ count: number }> {
    return request<{ count: number }>(`/notifications/${userId}/unread-count`);
  },

  markAsRead(id: string): Promise<void> {
    return request<void>(`/notifications/${id}/read`, { method: 'PUT' });
  },

  markAllAsRead(userId: string): Promise<void> {
    return request<void>(`/notifications/${userId}/read-all`, { method: 'PUT' });
  },

  markByMessage(userId: string, messageId: string): Promise<void> {
    return request<void>(`/notifications/${userId}/read-by-message/${messageId}`, { method: 'PUT' });
  },

  delete(id: string): Promise<void> {
    return request<void>(`/notifications/${id}`, { method: 'DELETE' });
  },

  deleteMultiple(ids: string[]): Promise<void> {
    return request<void>('/notifications/delete-multiple', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  getSettings(userId: string): Promise<NotificationSettings> {
    return request<NotificationSettings>(`/notifications/settings/${userId}`);
  },

  updateSettings(userId: string, settings: NotificationSettings): Promise<void> {
    return request<void>(`/notifications/settings/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Статус за прочитане
// ═══════════════════════════════════════════════════════════════════════

export const readStatusesApi = {
  getByMessage(messageId: string): Promise<ReadStatus[]> {
    return request<ReadStatus[]>(`/read-statuses/${messageId}`);
  },

  getByUser(userId: string): Promise<ReadStatus[]> {
    return request<ReadStatus[]>(`/read-statuses/user/${userId}`);
  },

  markAsRead(messageId: string, userId: string): Promise<void> {
    return request<void>('/read-statuses', {
      method: 'POST',
      body: JSON.stringify({ messageId, userId }),
    });
  },

  confirm(messageId: string, userId: string): Promise<void> {
    return request<void>(`/read-statuses/${messageId}/${userId}/confirm`, {
      method: 'PUT',
    });
  },

  markAllAsRead(messageIds: string[], userId: string): Promise<void> {
    return request<void>('/read-statuses/mark-all', {
      method: 'POST',
      body: JSON.stringify({ messageIds, userId }),
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Одитен дневник
// ═══════════════════════════════════════════════════════════════════════

export const auditApi = {
  getAll(filters?: { targetType?: string; limit?: number }): Promise<AuditLogEntry[]> {
    const params = new URLSearchParams();
    if (filters?.targetType) params.set('targetType', filters.targetType);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return request<AuditLogEntry[]>(`/audit-log${qs ? `?${qs}` : ''}`);
  },

  delete(id: string): Promise<void> {
    return request<void>(`/audit-log/${id}`, { method: 'DELETE' });
  },
};

export const metadataApi = {
  getCategories(): Promise<MessageCategoryOption[]> {
    return request<MessageCategoryOption[]>('/metadata/categories');
  },

  createCategory(data: { key: string; label: string }): Promise<{ id: string }> {
    return request<{ id: string }>('/metadata/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCategory(id: string, data: { key?: string; label?: string }): Promise<void> {
    return request<void>(`/metadata/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteCategory(id: string): Promise<void> {
    return request<void>(`/metadata/categories/${id}`, { method: 'DELETE' });
  },

  getClasses(school?: string): Promise<SchoolClassOption[]> {
    const params = new URLSearchParams();
    if (school) params.set('school', school);
    return request<SchoolClassOption[]>(`/metadata/classes${params.toString() ? `?${params.toString()}` : ''}`);
  },

  createClass(data: { school?: string; name: string }): Promise<{ id: string }> {
    return request<{ id: string }>('/metadata/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getClassPreview(id: string): Promise<{
    className: string;
    school: string;
    studentsCount: number;
    students: { id: string; name: string; email: string }[];
    classTeachersCount: number;
    classTeachers: { id: string; name: string; email: string }[];
    messagesCount: number;
    commentsCount: number;
  }> {
    return request(`/metadata/classes/${id}/preview`);
  },

  deleteClass(id: string): Promise<void> {
    return request<void>(`/metadata/classes/${id}`, { method: 'DELETE' });
  },

  getSystemInfo(): Promise<{ dbSizeKB: number }> {
    return request<{ dbSizeKB: number }>('/metadata/system-info');
  },
};
