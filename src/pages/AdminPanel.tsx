import React, { useMemo, useState, useCallback } from 'react';
import ScrollToTop from '@/components/ScrollToTop';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import { BarChart3, BookOpen, ClipboardList, Mail, Pencil, Plus, Search, Settings, Shield, Trash2, UserCheck, UserX, Users, RotateCcw, Clock, LogIn, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/contexts/AuditLogContext';
import { useMessages } from '@/contexts/MessagesContext';
import { REGISTRATION_STATUS_LABELS, ROLE_LABELS, User, UserRole, AuditLogEntry, CATEGORY_LABELS, AUDIENCE_LABELS } from '@/types';
import { messagesApi, metadataApi, usersApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type UserSortKey = 'name' | 'role' | 'registrationStatus' | 'school' | 'class' | 'email';

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-importance-high/15 text-importance-high border-importance-high/20',
  director: 'bg-importance-high/15 text-importance-high border-importance-high/20',
  teacher: 'bg-primary/10 text-primary border-primary/20',
  student: 'bg-success/15 text-success border-success/20',
};

const STATUS_COLORS = {
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
  rejected: 'bg-rose-500/15 text-rose-600 border-rose-500/20',
} as const;

const formatDate = (value?: string) => {
  if (!value) return '—';
  return format(new Date(value), 'd MMM yyyy, HH:mm', { locale: bg });
};

const isPersonalMessage = (targetAudience: string, category?: string) => category === 'personal' || targetAudience.startsWith('user:') || targetAudience.startsWith('users:');

const getContentPreview = (content: string) => {
  if (!content) return '—';
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200) + (content.length > 200 ? '...' : '');
};

const getAudiencePreview = (targetAudience: string, users: User[]) => {
  if (targetAudience.startsWith('user:')) {
    const target = users.find(user => user.id === targetAudience.replace('user:', ''));
    return target ? `${target.firstName} ${target.lastName}` : targetAudience;
  }
  if (targetAudience.startsWith('users:')) {
    return targetAudience.replace('users:', '').split(',').map((id) => {
      const target = users.find(user => user.id === id);
      return target ? `${target.firstName} ${target.lastName}` : id;
    }).join(', ');
  }
  return AUDIENCE_LABELS[targetAudience] || targetAudience;
};

const ACTION_COLORS: Record<string, string> = {
  'Публикуване на съобщение': 'bg-emerald-500/10 text-emerald-600',
  'Редакция на съобщение': 'bg-blue-500/10 text-blue-600',
  'Изтриване на съобщение': 'bg-rose-500/10 text-rose-600',
  'Потвърждаване на важно съобщение': 'bg-indigo-500/10 text-indigo-600',
  'Регистриране на профил': 'bg-amber-500/10 text-amber-600',
  'Вход в системата': 'bg-blue-500/10 text-blue-600',
  'Промяна по профил': 'bg-fuchsia-500/10 text-fuchsia-600',
  'Административна промяна': 'bg-violet-500/10 text-violet-600',
  'Добавен коментар': 'bg-sky-500/10 text-sky-600',
  'Изтрит коментар': 'bg-rose-500/10 text-rose-600',
};

const TARGET_TYPE_ACTIONS: Record<string, string[]> = {
  message: ['Публикуване на съобщение', 'Редакция на съобщение', 'Изтриване на съобщение', 'Потвърждаване на важно съобщение'],
  user: ['Регистриране на профил', 'Вход в системата', 'Промяна по профил', 'Административна промяна'],
  comment: ['Добавен коментар', 'Изтрит коментар'],
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  message: 'СЪОБЩЕНИЕ',
  user: 'ПОТРЕБИТЕЛ',
  comment: 'КОМЕНТАР',
  class: 'КЛАС',
  school: 'УЧИЛИЩЕ',
  category: 'КАТЕГОРИЯ',
};

const InfoBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-primary/10 bg-muted/20 p-4 min-w-0">
    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="mt-2 text-sm font-medium text-foreground break-all">{value}</p>
  </div>
);

const AdminPanel: React.FC = () => {
  const { user, systemUsers, isGlobalAdmin, activeSchoolScope } = useAuth();
  const { entries: auditEntries, deleteEntry, addEntry } = useAuditLog();
  const { messages: allVisibleMessages, createMessage, deleteMessage, deleteComment } = useMessages();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchUser, setSearchUser] = useState('');
  const navigate = useNavigate();

  const auditSearch = searchParams.get('auditSearch') || '';
  const setAuditSearch = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set('auditSearch', val);
    else newParams.delete('auditSearch');
    setSearchParams(newParams, { replace: true });
  };
  const [roleFilter, setRoleFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<UserSortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<User | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [categoryKey, setCategoryKey] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<AuditLogEntry | null>(null);
  const auditTargetTypeFilter = searchParams.get('auditTargetType') || 'all';
  const setAuditTargetTypeFilter = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val !== 'all') newParams.set('auditTargetType', val);
    else newParams.delete('auditTargetType');
    newParams.delete('auditAction'); // Reset action when type changes
    setSearchParams(newParams, { replace: true });
  };

  const auditActionFilter = searchParams.get('auditAction') || 'all';
  const setAuditActionFilter = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val !== 'all') newParams.set('auditAction', val);
    else newParams.delete('auditAction');
    setSearchParams(newParams, { replace: true });
  };

  const auditDateFilter = searchParams.get('auditDate') || 'all';
  const setAuditDateFilter = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val !== 'all') newParams.set('auditDate', val);
    else newParams.delete('auditDate');
    setSearchParams(newParams, { replace: true });
  };
  const [newClassName, setNewClassName] = useState('');
  const [classDeletePreview, setClassDeletePreview] = useState<{
    classId: string;
    className: string;
    school: string;
    studentsCount: number;
    students: { id: string; name: string; email: string }[];
    classTeachersCount: number;
    classTeachers: { id: string; name: string; email: string }[];
    messagesCount: number;
    commentsCount: number;
  } | null>(null);
  const [rejectionCandidate, setRejectionCandidate] = useState<User | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [logAndContentDeletionCandidate, setLogAndContentDeletionCandidate] = useState<AuditLogEntry | null>(null);
  const [restoredEntries, setRestoredEntries] = useState<string[]>([]);

  const activeTab = searchParams.get('tab') || 'users';
  const auditUserId = searchParams.get('userId');
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const { data: categoryOptions = [] } = useQuery({
    queryKey: ['messageCategories'],
    queryFn: () => metadataApi.getCategories(),
  });

  const { data: rawSchoolClasses = [] } = useQuery({
    queryKey: ['schoolClasses', activeSchoolScope],
    queryFn: () => metadataApi.getClasses(activeSchoolScope || undefined),
  });

  const sortedClasses = useMemo(() => {
    const parseClass = (c: string | undefined) => {
      if (!c) return { num: 0, suffix: '' };
      const match = c.match(/^(\d+)(.*)$/);
      if (!match) return { num: 0, suffix: c };
      return { num: parseInt(match[1], 10), suffix: match[2] };
    };

    return [...rawSchoolClasses].sort((a, b) => {
      // First sort by school name if they are from different schools and no scope is active
      if (!activeSchoolScope && a.school !== b.school) {
        return a.school.localeCompare(b.school, 'bg');
      }

      const classA = parseClass(a.name);
      const classB = parseClass(b.name);

      if (classA.num !== classB.num) return classB.num - classA.num;
      return classA.suffix.localeCompare(classB.suffix, 'bg');
    });
  }, [rawSchoolClasses, activeSchoolScope]);

  const { data: systemInfo } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: () => metadataApi.getSystemInfo(),
  });

  const selectedUser = systemUsers.find(candidate => candidate.id === selectedUserId) ?? null;
  const schools = useMemo(
    () => [...new Set(systemUsers.map(candidate => candidate.school).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'bg')),
    [systemUsers],
  );

  const filteredUsers = useMemo(() => {
    const query = searchUser.trim().toLowerCase();

    const filtered = systemUsers.filter(candidate => {
      if (activeSchoolScope && candidate.school !== activeSchoolScope) return false;
      if (roleFilter !== 'all' && candidate.role !== roleFilter) return false;
      if (statusFilter !== 'all' && candidate.registrationStatus !== statusFilter) return false;
      if (classFilter !== 'all' && candidate.class !== classFilter) return false;
      if (!query) return true;

      return [
        candidate.firstName,
        candidate.lastName,
        candidate.email,
        candidate.school,
        candidate.class,
        candidate.subject,
        candidate.pendingSubject,
        candidate.pendingTeacherType,
      ].some(value => value?.toLowerCase().includes(query));
    });

    const sorted = [...filtered].sort((a, b) => {
      // 1. Role priority
      const rolePriority: Record<string, number> = { admin: 0, director: 1, teacher: 2, student: 3 };
      const roleA = rolePriority[a.role] ?? 99;
      const roleB = rolePriority[b.role] ?? 99;
      if (roleA !== roleB) return roleA - roleB;

      // 2. School
      const schoolA = a.school || '';
      const schoolB = b.school || '';
      const schoolCmp = schoolA.localeCompare(schoolB, 'bg');
      if (schoolCmp !== 0) return schoolCmp;

      // 3. Grade (Class number)
      const parseClass = (c: string | undefined) => {
        if (!c) return { num: 0, suffix: '' };
        const match = c.match(/^(\d+)(.*)$/);
        if (!match) return { num: 0, suffix: c };
        return { num: parseInt(match[1], 10), suffix: match[2] };
      };

      const classA = parseClass(a.class);
      const classB = parseClass(b.class);
      if (classA.num !== classB.num) return classA.num - classB.num;
      const suffixCmp = (classA.suffix || '').localeCompare(classB.suffix || '', 'bg');
      if (suffixCmp !== 0) return suffixCmp;

      // 4. Alphabetical Name
      const nameA = `${a.firstName} ${a.lastName}`;
      const nameB = `${b.firstName} ${b.lastName}`;
      return nameA.localeCompare(nameB, 'bg');
    });

    return sorted;
  }, [activeSchoolScope, roleFilter, classFilter, searchUser, statusFilter, systemUsers]);

  const filteredAudit = useMemo(() => {
    const query = auditSearch.toLowerCase();
    const now = new Date();

    return auditEntries
      .filter(entry => !auditUserId || entry.performedBy === auditUserId)
      .filter(entry => auditTargetTypeFilter === 'all' || entry.targetType === auditTargetTypeFilter)
      .filter(entry => auditActionFilter === 'all' || entry.action === auditActionFilter)
      .filter(entry => !activeSchoolScope || entry.performedBySchool === activeSchoolScope)
      .filter(entry => {
        if (auditDateFilter === 'all') return true;
        const entryDate = new Date(entry.createdAt);
        const diffDays = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24);

        if (auditDateFilter === 'today') {
          return entryDate.toDateString() === now.toDateString();
        }
        if (auditDateFilter === 'week') {
          return diffDays <= 7;
        }
        if (auditDateFilter === 'month') {
          return diffDays <= 30;
        }
        return true;
      })
      .filter(entry => {
        if (!auditSearch.trim()) return true;
        return entry.action.toLowerCase().includes(query)
          || entry.performedByName.toLowerCase().includes(query)
          || entry.details.toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [auditSearch, auditUserId, auditTargetTypeFilter, auditActionFilter, activeSchoolScope, auditDateFilter, auditEntries]);

  const stats = useMemo(() => {
    const scopeUsers = activeSchoolScope
      ? systemUsers.filter(u => u.school === activeSchoolScope)
      : systemUsers;

    const scopeMessages = activeSchoolScope
      ? allVisibleMessages.filter(m => m.authorSchool === activeSchoolScope)
      : allVisibleMessages;

    const scopeAudit = activeSchoolScope
      ? auditEntries.filter(e => e.performedBySchool === activeSchoolScope)
      : auditEntries;

    const pending = scopeUsers.filter(c => c.registrationStatus === 'pending').length;
    const approved = scopeUsers.filter(c => c.registrationStatus === 'approved').length;
    const rejected = scopeUsers.filter(c => c.registrationStatus === 'rejected').length;
    const totalMessages = scopeMessages.length;
    const personalMessages = scopeMessages.filter(m => isPersonalMessage(m.targetAudience, m.category)).length;
    const publishedMessages = scopeMessages.filter(m => m.status === 'published').length;
    const draftMessages = scopeMessages.filter(m => m.status === 'draft').length;
    const totalComments = scopeMessages.reduce((sum, m) => sum + (m.comments?.length || 0), 0);
    const uniqueSchools = activeSchoolScope ? 1 : new Set(systemUsers.map(u => u.school).filter(Boolean)).size;
    const teachers = scopeUsers.filter(u => u.role === 'teacher').length;
    const students = scopeUsers.filter(u => u.role === 'student').length;
    const directors = scopeUsers.filter(u => u.role === 'director').length;
    const auditActions = scopeAudit.length;
    const todayActions = scopeAudit.filter(e => {
      const d = new Date(e.createdAt);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length;

    return {
      pending, approved, rejected, totalMessages, personalMessages, publishedMessages,
      draftMessages, totalComments, uniqueSchools, teachers, students, directors,
      auditActions, todayActions
    };
  }, [systemUsers, allVisibleMessages, auditEntries, activeSchoolScope]);

  if (!user || !isGlobalAdmin) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Shield className="mx-auto mb-3 h-12 w-12 opacity-40" />
        <p>Нямате достъп до глобалния администраторски панел</p>
      </div>
    );
  }

  const refreshUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] }),
      queryClient.invalidateQueries({ queryKey: ['preferences'] }),
    ]);
  };

  const updateSorting = (key: UserSortKey) => {
    if (sortBy === key) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(key);
    setSortDirection('asc');
  };

  const updateUser = async (target: User, payload: Partial<User>, successMessage: string, actionKey: string) => {
    setBusyAction(actionKey);
    try {
      await usersApi.update(target.id, payload);
      await refreshUsers();
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неуспешно обновяване на потребителя');
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async (target: User, note?: string) => {
    await updateUser(
      target,
      {
        registrationStatus: 'approved',
        registrationReviewNote: note?.trim() ?? '',
        ...(target.role === 'teacher' && target.pendingSubject
          ? { subject: target.pendingSubject, pendingSubject: '' }
          : {}),
      },
      'Регистрацията е одобрена.',
      `approve-${target.id}`,
    );
  };

  const handleReject = async (target: User, note?: string) => {
    await updateUser(
      target,
      { registrationStatus: 'rejected', registrationReviewNote: note?.trim() ?? '' },
      'Регистрацията е отхвърлена.',
      `reject-${target.id}`,
    );
  };

  const handleApproveSubjects = async (target: User) => {
    if (!target.pendingSubject) return;

    await updateUser(
      target,
      { subject: target.pendingSubject, pendingSubject: '', registrationReviewNote: reviewNote.trim() || '' },
      'Предметите са одобрени.',
      `approve-subjects-${target.id}`,
    );
  };

  const handleRejectSubjects = async (target: User) => {
    await updateUser(
      target,
      { pendingSubject: '', registrationReviewNote: reviewNote.trim() || '' },
      'Заявката за предмети е отхвърлена.',
      `reject-subjects-${target.id}`,
    );
  };

  const handleApproveTeacherType = async (target: User) => {
    if (!target.pendingTeacherType) return;

    await updateUser(
      target,
      { teacherType: target.pendingTeacherType, pendingTeacherType: null as any, registrationReviewNote: reviewNote.trim() || '' },
      'Промяната на типа учител е одобрена.',
      `approve-type-${target.id}`,
    );
    addEntry({
      action: 'Промяна по профил',
      performedBy: user.id,
      performedByName: `${user.firstName} ${user.lastName}`,
      performedBySchool: user.school,
      targetType: 'user',
      targetId: target.id,
      details: `Одобрена смяна на типа на учител за ${target.firstName} ${target.lastName} на "${target.pendingTeacherType === 'class' ? 'Класен' : 'Редовен'}"`,
    });
  };

  const handleRejectTeacherType = async (target: User) => {
    await updateUser(
      target,
      { pendingTeacherType: null as any, registrationReviewNote: reviewNote.trim() || '' },
      'Заявката за промяна на тип учител е отхвърлена.',
      `reject-type-${target.id}`,
    );
    addEntry({
      action: 'Промяна по профил',
      performedBy: user.id,
      performedByName: `${user.firstName} ${user.lastName}`,
      performedBySchool: user.school,
      targetType: 'user',
      targetId: target.id,
      details: `Отхвърлена смяна на типа на учител за ${target.firstName} ${target.lastName}`,
    });
  };

  const handleRoleChange = async (target: User, nextRole: UserRole) => {
    const payload: Partial<User> = {
      role: nextRole,
      managementPosition: nextRole === 'director' ? 'director' : null as never,
      teacherType: nextRole === 'teacher' ? target.teacherType : null as never,
      class: nextRole === 'student' || nextRole === 'teacher' ? target.class : null as never,
    };

    await updateUser(target, payload, 'Ролята е обновена.', `role-${target.id}`);
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;

    setBusyAction(`delete-${deleteCandidate.id}`);
    try {
      await usersApi.delete(deleteCandidate.id);
      if (selectedUserId === deleteCandidate.id) {
        setSelectedUserId(null);
      }
      setDeleteCandidate(null);
      await refreshUsers();
      toast.success('Потребителят е изтрит.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неуспешно изтриване на потребителя');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestore = async (entry: AuditLogEntry) => {
    if (!entry.targetData) return;
    try {
      setBusyAction(`restore-${entry.id}`);
      const data = JSON.parse(entry.targetData);

      if (entry.targetType === 'message') {
        const { id, createdAt, updatedAt, ...rest } = data;
        await createMessage(rest);
      } else if (entry.targetType === 'comment') {
        // We restore comment to the same message if it exists
        if (data.messageId) {
          await messagesApi.addComment(data.messageId, data.authorId, data.content, data.attachments, data.links);
        }
      } else if (entry.targetType === 'user') {
        const { id, registrationStatus, registrationReviewedAt, ...rest } = data;
        await usersApi.create({ ...rest, password: 'restored-password-123' });
      } else if (entry.targetType === 'class') {
        await metadataApi.createClass({ school: data.school, name: data.name });
      }

      // Create a NEW audit entry for restoration
      addEntry({
        action: 'Възстановяване на обект',
        performedBy: user.id,
        performedByName: `${user.firstName} ${user.lastName}`,
        performedBySchool: user.school,
        targetType: entry.targetType,
        targetId: entry.targetId,
        details: `Възстановен обект от тип ${entry.targetType} от запис в журнала`,
      });

      setRestoredEntries(prev => [...prev, entry.id]);
      toast.success('Обектът беше успешно възстановен');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
        queryClient.invalidateQueries({ queryKey: ['auditLogs'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['schoolClasses'] }),
      ]);

      setSelectedAuditEntry(null);
    } catch (e) {
      console.error('Restore error:', e);
      toast.error('Грешка при възстановяване');
    } finally {
      setBusyAction(null);
    }
  };

  const handleLogAndContentDelete = async (entry: AuditLogEntry) => {
    setBusyAction(`full-delete-${entry.id}`);
    try {
      if (entry.targetType === 'message' && entry.targetId) {
        if (allVisibleMessages.some(m => m.id === entry.targetId)) {
          await deleteMessage(entry.targetId);
        }
      } else if (entry.targetType === 'user' && entry.targetId) {
        if (systemUsers.some(u => u.id === entry.targetId)) {
          await usersApi.delete(entry.targetId as any);
        }
      } else if (entry.targetType === 'comment' && entry.targetId) {
        await deleteComment(entry.targetId);
      } else if (entry.targetType === 'class' && entry.targetId) {
        await metadataApi.deleteClass(entry.targetId);
      }

      deleteEntry(entry.id);
      toast.success('Записът и съответното съдържание бяха изтрити');
      setLogAndContentDeletionCandidate(null);
      setSelectedAuditEntry(null);
    } catch (e) {
      toast.error('Грешка при изтриване на съдържанието');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePermanentDelete = async (entryId: string) => {
    const entry = auditEntries.find(e => e.id === entryId);
    if (!entry) return;

    setBusyAction(`perm-delete-${entryId}`);
    try {
      // If the target message still exists in DB, delete it first
      if (entry.targetType === 'message') {
        const msgExists = allVisibleMessages.some(m => m.id === entry.targetId);
        if (msgExists) {
          await deleteMessage(entry.targetId);
        }
      }

      deleteEntry(entryId);
      toast.success('Обектът и записът бяха премахнати окончателно');
      setSelectedAuditEntry(null);
    } catch (e) {
      toast.error('Грешка при окончателното изтриване');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setBusyAction(`delete-message-${messageId}`);
    try {
      await deleteMessage(messageId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
        queryClient.invalidateQueries({ queryKey: ['auditLogs'] }),
      ]);
      toast.success('Съобщението е изтрито.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неуспешно изтриване на съобщението');
    } finally {
      setBusyAction(null);
    }
  };

  const openUserAudit = (target: User) => {
    setSelectedUserId(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', 'audit');
    newParams.set('userId', target.id);
    setSearchParams(newParams);
  };

  const handleCreateCategory = async () => {
    if (!categoryKey.trim() || !categoryLabel.trim()) return;
    setBusyAction('create-category');
    try {
      await metadataApi.createCategory({ key: categoryKey, label: categoryLabel });
      await queryClient.invalidateQueries({ queryKey: ['messageCategories'] });
      setCategoryKey('');
      setCategoryLabel('');
      toast.success('Категорията е добавена.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неуспешно добавяне на категория');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setBusyAction(`delete-category-${id}`);
    try {
      await metadataApi.deleteCategory(id);
      await queryClient.invalidateQueries({ queryKey: ['messageCategories'] });
      toast.success('Категорията е изтрита.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неуспешно изтриване на категория');
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId || !categoryKey.trim() || !categoryLabel.trim()) return;
    setBusyAction(`update-category-${editingCategoryId}`);
    try {
      await metadataApi.updateCategory(editingCategoryId, { key: categoryKey, label: categoryLabel });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messageCategories'] }),
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
      ]);
      setEditingCategoryId(null);
      setCategoryKey('');
      setCategoryLabel('');
      toast.success('Категорията е редактирана.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неуспешна редакция на категория');
    } finally {
      setBusyAction(null);
    }
  };

  const startEditingCategory = (id: string, key: string, label: string) => {
    setEditingCategoryId(id);
    setCategoryKey(key);
    setCategoryLabel(label);
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    if (!activeSchoolScope) {
      toast.error('Моля, изберете училище от страничното меню преди да създадете клас.');
      return;
    }
    setBusyAction('create-class');
    try {
      await metadataApi.createClass({ school: activeSchoolScope, name: newClassName });
      await queryClient.invalidateQueries({ queryKey: ['schoolClasses', activeSchoolScope] });
      setNewClassName('');
      setIsCreatingClass(false);
      toast.success('Класът е създаден успешно.');
      addEntry({
        action: 'Административна промяна',
        performedBy: user.id,
        performedByName: `${user.firstName} ${user.lastName}`,
        performedBySchool: user.school,
        targetType: 'class',
        targetId: 'new',
        details: `Създаден нов клас "${newClassName}" в училище "${activeSchoolScope}"`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неуспешно създаване на клас');
    } finally {
      setBusyAction(null);
    }
  };

  const requestDeleteClass = async (classId: string) => {
    setBusyAction(`preview-class-${classId}`);
    try {
      const preview = await metadataApi.getClassPreview(classId);
      setClassDeletePreview({ classId, ...preview });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неуспешно зареждане на информация за класа');
    } finally {
      setBusyAction(null);
    }
  };

  const confirmDeleteClass = async () => {
    if (!classDeletePreview) return;
    const { classId } = classDeletePreview;
    setBusyAction(`delete-class-${classId}`);
    try {
      await metadataApi.deleteClass(classId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['schoolClasses', activeSchoolScope] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
        queryClient.invalidateQueries({ queryKey: ['auditLogs'] }),
      ]);
      toast.success(`Клас ${classDeletePreview.className} е изтрит заедно с ${classDeletePreview.studentsCount} ученика.`);
      addEntry({
        action: 'Административна промяна',
        performedBy: user.id,
        performedByName: `${user.firstName} ${user.lastName}`,
        performedBySchool: user.school,
        targetType: 'class',
        targetId: classDeletePreview.classId,
        details: `Изтрит клас "${classDeletePreview.className}" от училище "${classDeletePreview.school}". Премахнати ${classDeletePreview.studentsCount} ученици.`,
      });
      setClassDeletePreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неуспешно изтриване на клас');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight text-foreground">Глобален администраторски панел</h1>
          <p className="font-medium text-muted-foreground">
            Управление на потребители, одобрения и системни действия за {activeSchoolScope || 'всички училища'}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('tab', value);
          setSearchParams(newParams);
        }} className="space-y-8">
          <TabsList className="inline-flex h-14 w-full flex-wrap gap-1 rounded-2xl border border-primary/5 bg-card/50 p-1 shadow-sm sm:w-auto">
            <TabsTrigger value="users" className="flex items-center gap-2 rounded-xl px-5 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <Users className="h-4 w-4" /> Потребители
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 rounded-xl px-5 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <ClipboardList className="h-4 w-4" /> Журнал
            </TabsTrigger>
            <TabsTrigger value="classes" className="flex items-center gap-2 rounded-xl px-5 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <BookOpen className="h-4 w-4" /> Класове
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 rounded-xl px-5 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <Settings className="h-4 w-4" /> Настройки и мониторинг
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="outline-none">
            <Card className="overflow-hidden rounded-[2.5rem] border-primary/5 bg-card shadow-xl">
              <CardHeader className="space-y-6 border-b border-primary/5 bg-gradient-to-r from-primary/5 to-transparent p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="font-heading text-2xl font-black">Управление на потребители</CardTitle>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">Пълен контрол върху регистрации, роли и профили ({filteredUsers.length})</p>
                  </div>
                  <div className="relative w-full lg:w-80">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Търсене по име, имейл, училище..."
                      value={searchUser}
                      onChange={event => setSearchUser(event.target.value)}
                      className="h-11 rounded-xl border-none bg-background/50 pl-10 font-medium shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/70 font-medium">
                      <SelectValue placeholder="Филтър по роля" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всички роли</SelectItem>
                      {Object.entries(ROLE_LABELS).map(([role, label]) => (
                        <SelectItem key={role} value={role}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/70 font-medium">
                      <SelectValue placeholder="Филтър по статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всички статуси</SelectItem>
                      <SelectItem value="pending">Чака одобрение</SelectItem>
                      <SelectItem value="approved">Одобрени</SelectItem>
                      <SelectItem value="rejected">Отхвърлени</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/70 font-medium">
                      <SelectValue placeholder="Филтър по клас" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всички класове</SelectItem>
                      {sortedClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.name}>{cls.name} {!activeSchoolScope ? `(${cls.school})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="border-b-2 border-primary/20 hover:bg-transparent text-[10px]">
                        <TableHead className="px-4 font-black uppercase tracking-widest h-14 text-center border-r border-primary/10">Име</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Роля</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Статус</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Училище</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Клас</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Имейл</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map(candidate => (
                        <TableRow
                          key={candidate.id}
                          className="cursor-pointer border-primary/5 transition-colors hover:bg-muted/20"
                          onClick={() => {
                            setSelectedUserId(candidate.id);
                            setReviewNote(candidate.registrationReviewNote || '');
                          }}
                        >
                          <TableCell className="px-4 py-4 font-bold text-[13px] border-r border-primary/5 text-center">{candidate.firstName} {candidate.lastName}</TableCell>
                          <TableCell className="py-4 text-center border-r border-primary/5">
                            <Badge variant="outline" className={`text-[10px] py-0 h-5 ${ROLE_COLORS[candidate.role]}`}>{ROLE_LABELS[candidate.role]}</Badge>
                          </TableCell>
                          <TableCell className="py-4 text-center border-r border-primary/5">
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="outline" className={`text-[10px] py-0.5 px-2 h-auto leading-tight whitespace-nowrap inline-flex items-center justify-center ${STATUS_COLORS[candidate.registrationStatus]}`}>
                                {REGISTRATION_STATUS_LABELS[candidate.registrationStatus]}
                              </Badge>
                              <div className="flex flex-col items-center gap-1">
                                {candidate.role === 'teacher' && candidate.pendingSubject && (
                                  <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600 text-[9px] py-0.5 px-2 h-auto leading-tight whitespace-nowrap inline-flex items-center justify-center">
                                    Чакащи предмети
                                  </Badge>
                                )}
                                {candidate.role === 'teacher' && candidate.pendingTeacherType && (
                                  <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600 text-[9px] py-0.5 px-2 h-auto leading-tight whitespace-nowrap inline-flex items-center justify-center">
                                    Чакащ тип
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-[11px] font-medium border-r border-primary/5 text-center">{candidate.school}</TableCell>
                          <TableCell className="py-4 text-[11px] font-bold border-r border-primary/5 text-center">{candidate.class || '—'}</TableCell>
                          <TableCell className="px-4 py-4 text-[11px] font-medium text-muted-foreground border-r border-primary/5 text-center">{candidate.email}</TableCell>
                          <TableCell className="px-4 py-4 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl border-primary/10 bg-primary/5 font-bold text-primary hover:bg-primary hover:text-white"
                              onClick={() => {
                                setSelectedUserId(candidate.id);
                                setReviewNote(candidate.registrationReviewNote || '');
                              }}
                            >
                              <ClipboardList className="mr-2 h-4 w-4" /> Преглед
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                            Няма потребители по зададените филтри.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="outline-none">
            <Card className="overflow-hidden rounded-[2.5rem] border-primary/5 bg-card shadow-xl">
              <CardHeader className="border-b border-primary/5 bg-gradient-to-r from-primary/5 to-transparent p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-md">
                    <CardTitle className="font-heading text-2xl font-black">Журнал на действията</CardTitle>
                    <p className="mt-1 text-sm font-medium text-muted-foreground leading-relaxed">{auditUserId ? 'История на избрания потребител' : `Пълна история на действия по цялата система (${filteredAudit.length})`}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 items-center flex-1 justify-end">
                    {/* Removed auditSchoolFilter select as it's now sitewide */}

                    <Select value={auditDateFilter} onValueChange={setAuditDateFilter}>
                      <SelectTrigger className="h-11 w-44 rounded-xl bg-background/70 font-medium">
                        <SelectValue placeholder="Период" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Всичко</SelectItem>
                        <SelectItem value="today">Днес</SelectItem>
                        <SelectItem value="week">Последна седмица</SelectItem>
                        <SelectItem value="month">Последен месец</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={auditTargetTypeFilter} onValueChange={setAuditTargetTypeFilter}>
                      <SelectTrigger className="h-11 w-40 rounded-xl bg-background/70 font-medium">
                        <SelectValue placeholder="Тип обект" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Всички типове</SelectItem>
                        <SelectItem value="message">Съобщения</SelectItem>
                        <SelectItem value="user">Потребители</SelectItem>
                        <SelectItem value="comment">Коментари</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                      <SelectTrigger className="h-11 w-44 rounded-xl bg-background/70 font-medium">
                        <SelectValue placeholder="Действие" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Всички действия</SelectItem>
                        {(auditTargetTypeFilter === 'all'
                          ? Object.keys(ACTION_COLORS)
                          : TARGET_TYPE_ACTIONS[auditTargetTypeFilter] || []
                        ).map(action => (
                          <SelectItem key={action} value={action}>{action}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="relative w-full lg:w-48 xl:w-64">
                      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Търсене..."
                        value={auditSearch}
                        onChange={event => setAuditSearch(event.target.value)}
                        className="h-11 rounded-xl border-none bg-background/50 pl-10 font-medium shadow-inner"
                      />
                    </div>
                  </div>
                </div>
                {auditUserId && (
                  <div className="flex justify-end">
                    <Button variant="outline" className="rounded-xl" onClick={() => setSearchParams({ tab: 'audit' })}>
                      Покажи целия журнал
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="grid gap-4 p-8">
                {filteredAudit.map(entry => (
                  <div key={entry.id} className="flex items-start justify-between gap-5 rounded-[1.75rem] border border-primary/5 bg-card/50 p-6 transition-all duration-300 hover:shadow-lg cursor-pointer hover:bg-muted/30" onClick={() => setSelectedAuditEntry(entry)}>
                    <div className="mt-1.5 rounded-2xl bg-white p-3 text-primary shadow-sm dark:bg-slate-800">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${ACTION_COLORS[entry.action] || 'bg-secondary text-muted-foreground'}`}>{entry.action}</span>
                          <span className="rounded-lg bg-secondary px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">{TARGET_TYPE_LABELS[entry.targetType] || entry.targetType.toUpperCase()}</span>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">{formatDate(entry.createdAt)}</span>
                          <Button size="sm" variant="ghost" className="h-7 rounded-lg px-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary">
                            Преглед
                          </Button>
                        </div>
                      </div>
                      <p className="mb-3 text-sm font-medium italic text-muted-foreground">"{entry.details}"</p>
                      <span className="text-xs font-black uppercase tracking-tight text-muted-foreground">{entry.performedByName}</span>
                    </div>
                  </div>
                ))}
                {filteredAudit.length === 0 && (
                  <div className="py-20 text-center opacity-20">
                    <Search className="mx-auto mb-4 h-16 w-16" />
                    <p className="text-xl font-bold">Няма намерени записи</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="classes" className="outline-none">
            <Card className="overflow-hidden rounded-[2.5rem] border-primary/5 bg-card shadow-xl">
              <CardHeader className="border-b border-primary/5 bg-gradient-to-r from-primary/5 to-transparent p-8">
                <div>
                  <CardTitle className="font-heading text-2xl font-black">Управление на класове</CardTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">Създаване и изтриване на класове за всяко училище</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4 h-11">
                    {!isCreatingClass ? (
                      <Button
                        onClick={() => setIsCreatingClass(true)}
                        disabled={!activeSchoolScope}
                        className="h-11 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-all duration-300"
                        variant="ghost"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Добави нов клас
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-left-2 duration-300">
                        <Input
                          autoFocus
                          value={newClassName}
                          onChange={event => setNewClassName(event.target.value)}
                          placeholder="Име на новия клас..."
                          className="h-11 rounded-xl border-primary/10 bg-primary/5 flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateClass();
                            if (e.key === 'Escape') setIsCreatingClass(false);
                          }}
                        />
                        <Button
                          onClick={handleCreateClass}
                          disabled={busyAction === 'create-class' || !newClassName.trim()}
                          size="sm"
                          className="h-9 rounded-lg"
                        >
                          Запази
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsCreatingClass(false);
                            setNewClassName('');
                          }}
                          size="sm"
                          className="h-9 rounded-lg text-muted-foreground"
                        >
                          Отказ
                        </Button>
                      </div>
                    )}

                    {/* School filter removed from here - using sitewide filter */}
                  </div>
                </div>

                <div className="grid gap-3">
                  {sortedClasses.map(classOption => (
                    <div key={classOption.id} className="flex items-center justify-between rounded-xl border border-primary/5 bg-background/70 p-4">
                      <div>
                        <p className="text-sm font-black text-foreground">{classOption.name}</p>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">{classOption.school}</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl" disabled={busyAction === `delete-class-${classOption.id}` || busyAction === `preview-class-${classOption.id}`} onClick={() => requestDeleteClass(classOption.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Изтрий
                      </Button>
                    </div>
                  ))}
                  {sortedClasses.length === 0 && (
                    <div className="py-12 text-center opacity-30">
                      <BookOpen className="mx-auto mb-3 h-12 w-12" />
                      <p className="text-sm font-bold">{activeSchoolScope ? 'Няма класове за това училище' : 'Изберете училище от страничното меню'}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="outline-none">
            <Card className="overflow-hidden rounded-[2.5rem] border-primary/5 bg-card shadow-xl">
              <CardHeader className="border-b border-primary/5 bg-gradient-to-r from-primary/5 to-transparent p-8">
                <CardTitle className="font-heading text-2xl font-black">Настройки и мониторинг</CardTitle>
                <p className="text-sm font-medium text-muted-foreground">Статистики, категории за съобщения и системен преглед</p>
              </CardHeader>
              <CardContent className="space-y-8 p-8">
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-foreground">
                    <BarChart3 className="h-5 w-5 text-primary" /> Обобщена статистика
                  </h3>
                  <div className={`grid gap-4 ${activeSchoolScope ? 'grid-cols-1 md:grid-cols-2' : 'sm:grid-cols-2 md:grid-cols-3'}`}>
                    <StatCard label={activeSchoolScope ? "Училище" : "Училища"} value={activeSchoolScope ? activeSchoolScope : String(stats.uniqueSchools)} />
                    <StatCard label="Потребители" value={String(stats.teachers + stats.students + stats.directors)} />
                    {!activeSchoolScope && <StatCard label="Размер на базата (КБ)" value={String(systemInfo?.dbSizeKB ?? '...')} accent />}
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-foreground">
                    <UserCheck className="h-5 w-5 text-primary" /> Статус на профилите
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-3">
                    <StatCard label="Одобрени" value={String(stats.approved)} />
                    <StatCard label="Отхвърлени" value={String(stats.rejected)} />
                    <StatCard label="Чакащи" value={String(stats.pending)} accent />
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-foreground">
                    <Users className="h-5 w-5 text-primary" /> Потребители по роли
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    <StatCard label="Директори" value={String(stats.directors)} />
                    <StatCard label="Учители" value={String(stats.teachers)} />
                    <StatCard label="Ученици" value={String(stats.students)} />
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-foreground">
                    <Mail className="h-5 w-5 text-primary" /> Съобщения и активност
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                    <StatCard label="Всички съобщения" value={String(stats.totalMessages)} />
                    <StatCard label="Публикувани" value={String(stats.publishedMessages)} />
                    <StatCard label="Чернови" value={String(stats.draftMessages)} />
                    <StatCard label="Лични (1→1)" value={String(stats.personalMessages)} />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    <StatCard label="Коментари" value={String(stats.totalComments)} />
                    <StatCard label="Журнал: Общо записи" value={String(stats.auditActions)} />
                    <StatCard label="Журнал: Днешни действия" value={String(stats.todayActions)} accent />
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                  <div className="space-y-4 rounded-[1.75rem] border border-primary/10 bg-muted/20 p-6">
                    <div>
                      <h3 className="text-lg font-black text-foreground">Категории за съобщения</h3>
                      <p className="text-sm font-medium text-muted-foreground">Глобални категории за цялата платформа</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                      <Input value={categoryKey} onChange={event => setCategoryKey(event.target.value)} placeholder="Ключ, напр. discipline" className="h-11 rounded-xl" />
                      <Input value={categoryLabel} onChange={event => setCategoryLabel(event.target.value)} placeholder="Етикет, напр. Дисциплина" className="h-11 rounded-xl" />
                      <Button onClick={editingCategoryId ? handleUpdateCategory : handleCreateCategory} disabled={busyAction === 'create-category' || busyAction === `update-category-${editingCategoryId}`} className="h-11 rounded-xl">
                        {editingCategoryId ? <><Pencil className="mr-2 h-4 w-4" /> Запази</> : <><Plus className="mr-2 h-4 w-4" /> Добави</>}
                      </Button>
                      {editingCategoryId && (
                        <Button variant="outline" onClick={() => { setEditingCategoryId(null); setCategoryKey(''); setCategoryLabel(''); }} className="h-11 rounded-xl">
                          Отказ
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3">
                      {categoryOptions.map(category => (
                        <div key={category.id} className="flex items-center justify-between rounded-xl border border-primary/5 bg-background/70 p-4">
                          <div>
                            <p className="text-sm font-black text-foreground">{category.label}</p>
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">{category.key}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => startEditingCategory(category.id, category.key, category.label)}>
                              <Pencil className="mr-2 h-4 w-4" /> Редакция
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-xl" disabled={busyAction === `delete-category-${category.id}` || ['system', 'general', 'administrative', 'academic', 'personal'].includes(category.key)} onClick={() => handleDeleteCategory(category.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Изтрий
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 rounded-[1.75rem] border border-primary/10 bg-muted/20 p-6">
                    <h3 className="text-lg font-black text-foreground">Системна информация</h3>
                    <div className="grid gap-3">
                      <div className="rounded-xl border border-primary/5 bg-background/70 p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Платформа</p>
                        <p className="mt-1 text-sm font-medium text-foreground">SchoolConnect Hub</p>
                      </div>
                      <div className="rounded-xl border border-primary/5 bg-background/70 p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Общо категории</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{categoryOptions.length}</p>
                      </div>
                      <div className="rounded-xl border border-primary/5 bg-background/70 p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Общо класове</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{sortedClasses.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* ═══════ DIALOG: Перманентно изтриване на запис и съдържание ═══════ */}
          <AlertDialog open={Boolean(logAndContentDeletionCandidate)} onOpenChange={open => !open && setLogAndContentDeletionCandidate(null)}>
            <AlertDialogContent className="rounded-[2.5rem] border-primary/10 max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading text-2xl font-black text-destructive flex items-center gap-3">
                  <div className="p-3 bg-destructive/10 rounded-2xl">
                    <Trash2 size={24} />
                  </div>
                  Изтриване на запис и съдържание
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base pt-4 space-y-4">
                  <div className="rounded-2xl border-2 border-destructive/20 bg-destructive/5 p-6 space-y-3">
                    <p className="font-black text-destructive leading-tight">ВНИМАНИЕ: Това действие ще изтрие ОКОНЧАТЕЛНО:</p>
                    <ul className="list-disc pl-5 space-y-1.5 font-bold text-foreground">
                      <li>Записа в системния журнал (Одит запис)</li>
                      {logAndContentDeletionCandidate?.targetType === 'message' && <li>Самото съобщение и всички негови коментари</li>}
                      {logAndContentDeletionCandidate?.targetType === 'user' && <li>Профила на потребителя и всички негови лични данни</li>}
                      {logAndContentDeletionCandidate?.targetType === 'comment' && <li>Съответния коментар</li>}
                      {logAndContentDeletionCandidate?.targetType === 'class' && <li>Класа и всички връзки към него</li>}
                    </ul>
                  </div>

                  <p className="text-sm font-medium text-muted-foreground leading-relaxed italic">
                    Избраното действие в журнала ({logAndContentDeletionCandidate?.action}) ще бъде премахнато автоматично след изтриването.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="pt-6">
                <AlertDialogCancel className="rounded-xl h-12 font-bold px-8">Отказ</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (logAndContentDeletionCandidate) {
                      handleLogAndContentDelete(logAndContentDeletionCandidate);
                    }
                  }}
                  className="rounded-xl h-12 font-black px-8 bg-destructive text-white hover:bg-destructive/90 shadow-xl shadow-destructive/20"
                >
                  Да, изтрий всичко окончателно
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Tabs>
      </div>

      <Dialog
        open={Boolean(selectedUser)}
        onOpenChange={open => {
          if (!open) {
            setSelectedUserId(null);
            setReviewNote('');
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-[2rem] border-primary/10 p-0 transition-all duration-500">
          {selectedUser && (
            <>
              <DialogHeader className="border-b border-primary/10 p-8 pb-6 flex-shrink-0">
                <DialogTitle className="text-2xl font-black">{selectedUser.firstName} {selectedUser.lastName}</DialogTitle>
                <DialogDescription>
                  Подробни регистрационни данни, промяна на роля и одобрение на профила.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-8 pt-6 space-y-8">
                  {/* Секция: Обща информация */}
                  <section>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4 pb-2 border-b border-primary/5">Обща информация</h3>
                    <div className="grid gap-6 md:grid-cols-2">
                      <InfoBlock label="Имейл" value={selectedUser.email} />
                      <InfoBlock label="Училище" value={selectedUser.school} />
                      <InfoBlock label="Роля" value={ROLE_LABELS[selectedUser.role]} />
                      <InfoBlock label="Клас" value={selectedUser.class || '—'} />
                      <InfoBlock label="Статус" value={REGISTRATION_STATUS_LABELS[selectedUser.registrationStatus]} />
                      <InfoBlock label="Прегледано на" value={formatDate(selectedUser.registrationReviewedAt)} />
                    </div>
                  </section>

                  {/* Секция: Активни данни */}
                  <section>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4 pb-2 border-b border-primary/5">Активни настройки</h3>
                    <div className="grid gap-6 md:grid-cols-2">
                      <InfoBlock label="Одобрени предмети" value={selectedUser.subject || '—'} />
                      <InfoBlock label="Тип учител" value={selectedUser.teacherType === 'class' ? 'Класен ръководител' : (selectedUser.teacherType === 'regular' ? 'Редовен учител' : '—')} />
                    </div>
                  </section>

                  {/* Секция: Чакащи промени */}
                  {(selectedUser.pendingSubject || selectedUser.pendingTeacherType || selectedUser.pendingClass) && (
                    <section className="bg-amber-500/5 rounded-[1.5rem] border border-amber-500/10 p-6 space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/70 mb-2">Чакащи промени за одобрение</h3>

                      <div className="space-y-3">
                        {selectedUser.pendingSubject && (
                          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-background/50 border border-amber-500/10">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Заявка за нови предмети</p>
                              <p className="font-bold text-amber-600">{selectedUser.pendingSubject}</p>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                className="h-8 rounded-lg text-[11px] font-black px-3"
                                disabled={busyAction === `approve-subjects-${selectedUser.id}`}
                                onClick={() => handleApproveSubjects(selectedUser)}
                              >
                                <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Одобри
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg text-[11px] font-black px-3 border-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white"
                                disabled={busyAction === `reject-subjects-${selectedUser.id}`}
                                onClick={() => handleRejectSubjects(selectedUser)}
                              >
                                <UserX className="mr-1.5 h-3.5 w-3.5" /> Откажи
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedUser.pendingTeacherType && (
                          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-background/50 border border-amber-500/10">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Заявка за тип учител</p>
                              <p className="font-bold text-amber-600">
                                {selectedUser.pendingTeacherType === 'class' ? 'Класен ръководител' : 'Редовен учител'}
                                {selectedUser.pendingTeacherType === 'class' && selectedUser.pendingClass && ` (Клас: ${selectedUser.pendingClass})`}
                              </p>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                className="h-8 rounded-lg text-[11px] font-black px-3"
                                disabled={busyAction === `approve-type-${selectedUser.id}`}
                                onClick={() => handleApproveTeacherType(selectedUser)}
                              >
                                <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Одобри
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg text-[11px] font-black px-3 border-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white"
                                disabled={busyAction === `reject-type-${selectedUser.id}`}
                                onClick={() => handleRejectTeacherType(selectedUser)}
                              >
                                <UserX className="mr-1.5 h-3.5 w-3.5" /> Откажи
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  <section className="space-y-4 pt-4 border-t border-primary/5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Управление на статус</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 col-span-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Промяна на роля</p>
                        <Select value={selectedUser.role} onValueChange={value => handleRoleChange(selectedUser, value as UserRole)} disabled={selectedUser.id === user.id}>
                          <SelectTrigger className="h-11 rounded-xl font-medium bg-background/50">
                            <SelectValue placeholder="Изберете роля" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                            <SelectItem value="director">{ROLE_LABELS.director}</SelectItem>
                            <SelectItem value="teacher">{ROLE_LABELS.teacher}</SelectItem>
                            <SelectItem value="student">{ROLE_LABELS.student}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 col-span-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Бележка към регистрацията</p>
                        {selectedUser.registrationStatus === 'pending' ? (
                          <Input
                            value={reviewNote}
                            onChange={event => setReviewNote(event.target.value)}
                            placeholder="Причина за решение или уточнение"
                            className="h-11 rounded-xl bg-background/50"
                          />
                        ) : (
                          <div className="h-11 flex items-center px-4 rounded-xl bg-muted/30 border border-primary/5 text-sm font-medium text-muted-foreground italic">
                            {selectedUser.registrationReviewNote || 'няма бележка'}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <DialogFooter className="border-t border-primary/10 p-6 flex-shrink-0">
                <div className="grid grid-cols-[1fr_auto_1fr] w-full items-center gap-4">
                  <div className="flex justify-start">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteCandidate(selectedUser)}
                      disabled={selectedUser.id === user.id}
                      className="rounded-xl border-rose-500/10 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white font-bold h-10 px-4"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Изтрий профил
                    </Button>
                  </div>

                  <div className="flex justify-center gap-2">
                    {selectedUser.registrationStatus === 'pending' && (
                      <>
                        <Button
                          disabled={busyAction === `approve-${selectedUser.id}`}
                          onClick={() => handleApprove(selectedUser, reviewNote)}
                          className="rounded-xl h-10 font-black px-6 shadow-lg shadow-primary/20"
                        >
                          <UserCheck className="mr-2 h-4 w-4" /> Одобри профила
                        </Button>
                        <Button
                          disabled={busyAction === `reject-${selectedUser.id}`}
                          variant="outline"
                          onClick={() => {
                            setRejectionCandidate(selectedUser);
                            setRejectNote(reviewNote);
                          }}
                          className="rounded-xl h-10 font-black px-6 border-rose-500/20 text-rose-600 hover:bg-rose-500 hover:text-white"
                        >
                          <UserX className="mr-2 h-4 w-4" /> Отхвърли профила
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl h-10 font-bold px-4" onClick={() => openUserAudit(selectedUser)}>
                      <ClipboardList className="mr-2 h-4 w-4" /> Журнал
                    </Button>
                    <Button variant="outline" className="rounded-xl h-10 font-bold px-4" onClick={() => setSelectedUserId(null)}>Затвори</Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedAuditEntry)} onOpenChange={open => !open && setSelectedAuditEntry(null)}>
        <DialogContent className="max-w-2xl rounded-[2rem] border-primary/10 p-0">
          {selectedAuditEntry ? (
            (() => {
              const entry = selectedAuditEntry;
              let snapshotData: any = null;
              if (entry.targetData) {
                try { snapshotData = JSON.parse(entry.targetData); } catch (e) { }
              }

              const targetMessageId = entry.targetType === 'message' ? entry.targetId : (entry.targetType === 'comment' ? snapshotData?.messageId : null);
              const targetMessage = targetMessageId ? allVisibleMessages.find(m => m.id === String(targetMessageId)) : null;
              const targetUser = entry.targetType === 'user' ? systemUsers.find(u => u.id === entry.targetId) : null;
              const targetClass = entry.targetType === 'class' ? sortedClasses.find(c => c.id === entry.targetId) : null;

              const isDeleted = !targetMessage && !targetUser && !targetClass && entry.targetId;

              return (
                <>
                  <DialogHeader className="border-b border-primary/10 p-8 pb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`rounded-lg px-3 py-1.5 text-xs font-black ${ACTION_COLORS[entry.action] || 'bg-secondary text-muted-foreground'}`}>{entry.action}</span>
                      <span className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground/80">{TARGET_TYPE_LABELS[entry.targetType] || entry.targetType.toUpperCase()}</span>
                    </div>
                    <DialogTitle className="text-xl font-black">Детайли за действие</DialogTitle>
                    <DialogDescription>Информация за записано действие в журнала на {formatDate(entry.createdAt)}</DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-6 p-8 overflow-y-auto max-h-[60vh]">
                    <div className="space-y-4">
                      <h3 className="font-bold text-foreground">Основна информация</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <InfoBlock label="Извършено от" value={entry.performedByName} />
                        <InfoBlock label="Училище на извършителя" value={entry.performedBySchool || '—'} />
                        <InfoBlock label="Системни детайли" value={entry.details} />
                        <InfoBlock label="Дата и час" value={formatDate(entry.createdAt)} />
                      </div>
                    </div>

                    {targetMessage && entry.targetType === 'message' && (
                      <div className="space-y-4 border-t border-primary/10 pt-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-foreground">Свързано съобщение</h3>
                        </div>
                        <div className="grid gap-4">
                          <button
                            onClick={() => {
                              setSelectedAuditEntry(null);
                              navigate(`/messages/${targetMessage.id}`);
                            }}
                            className="block w-full text-left group/link"
                          >
                            <div className="rounded-2xl border border-primary/10 bg-muted/20 p-5 transition-all hover:border-primary/30 hover:bg-primary/5">
                              <div className="flex items-center justify-between mb-3 border-b border-primary/5 pb-2">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Детайли за съобщението</p>
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover/link:opacity-100 transition-opacity">Прегледай съобщението →</span>
                              </div>
                              <h4 className="text-base font-black text-foreground group-hover/link:text-primary transition-colors mb-2">{targetMessage.title || '(Без заглавие)'}</h4>
                              <p className="text-sm font-medium text-muted-foreground line-clamp-4 group-hover/link:text-foreground transition-colors">
                                {getContentPreview(targetMessage.content)}
                              </p>
                            </div>
                          </button>
                          <div className="grid gap-4 md:grid-cols-2">
                            <InfoBlock label="Категория" value={CATEGORY_LABELS[targetMessage.category] || targetMessage.category} />
                            <InfoBlock label="Аудитория" value={getAudiencePreview(targetMessage.targetAudience, systemUsers)} />
                          </div>
                        </div>
                      </div>
                    )}

                    {!targetMessage && entry.targetType === 'message' && snapshotData && (
                      <div className="space-y-4 border-t border-primary/10 pt-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-foreground">Свързано съобщение (Изтрито)</h3>
                          <Badge variant="destructive" className="text-[10px]">Изтрито</Badge>
                        </div>
                        <div className="grid gap-4">
                          <div className="rounded-2xl border border-destructive/10 bg-destructive/5 p-5 opacity-80">
                            <div className="flex items-center justify-between mb-3 border-b border-destructive/5 pb-2">
                              <p className="text-xs font-black uppercase tracking-widest text-destructive/70">Преглед на съдържанието</p>
                              <span className="text-[10px] font-black uppercase tracking-widest text-destructive">Недостъпно</span>
                            </div>
                            <h4 className="text-base font-black text-foreground mb-2">{snapshotData.title || '(Без заглавие)'}</h4>
                            <p className="text-sm font-medium text-muted-foreground line-clamp-4">
                              {getContentPreview(snapshotData.content)}
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <InfoBlock label="Категория" value={CATEGORY_LABELS[snapshotData.category] || snapshotData.category} />
                            <InfoBlock label="Автор (Snapshot)" value={snapshotData.authorName} />
                          </div>
                        </div>
                      </div>
                    )}

                    {entry.action === 'Вход в системата' && (
                      <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-accent/10 p-12 flex flex-col items-center justify-center text-center border-2 border-primary/20 shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-bl-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                          <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/20 rounded-tr-full blur-2xl group-hover:scale-150 transition-transform duration-700" />

                          <div className="p-6 rounded-[2.5rem] bg-white dark:bg-slate-800 shadow-2xl mb-8 border-4 border-primary/20 transform group-hover:rotate-6 transition-transform duration-500">
                            <LogIn size={64} className="text-primary" />
                          </div>

                          <h3 className="text-3xl font-black mb-4 tracking-tight">Успешен вход в системата</h3>
                          <p className="text-lg text-muted-foreground font-medium max-w-sm leading-relaxed">
                            Потребителят <span className="text-foreground font-black">{entry.performedByName}</span> осъществи сигурен достъп до платформата.
                          </p>

                          <div className="mt-10 flex gap-4 w-full justify-center">
                            <div className="flex-1 max-w-[240px] p-6 rounded-3xl bg-white/50 dark:bg-card/40 border border-primary/20 backdrop-blur-md shadow-lg transform hover:scale-105 transition-transform duration-300">
                              <p className="text-[11px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Браузър / Платформа</p>
                              <p className="text-base font-black text-primary">Desktop App (Secure)</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {entry.targetType === 'comment' && snapshotData && (
                      <div className="space-y-4 border-t border-primary/10 pt-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-foreground">Свързан коментар</h3>
                        </div>
                        <div className="rounded-2xl border border-primary/10 bg-muted/20 p-5">
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Съдържание на коментара</p>
                          <p className="text-sm font-medium text-foreground italic">"{snapshotData.content}"</p>
                          <p className="mt-3 text-[10px] font-bold text-muted-foreground">Автор: {snapshotData.authorName || 'Потребител'}</p>
                        </div>

                        {/* Ако съобщението съществува, но типът е коментар, също показваме линк към съобщението */}
                        {targetMessage && (
                          <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                            <button
                              onClick={() => {
                                setSelectedAuditEntry(null);
                                navigate(`/messages/${targetMessage.id}`);
                              }}
                              className="block w-full text-left group/msg-link"
                            >
                              <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/10 bg-primary/5 hover:border-primary/30 transition-all">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                  <Mail size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Към оригиналното съобщение</p>
                                  <p className="text-sm font-bold text-foreground truncate">{targetMessage.title || '(Без заглавие)'}</p>
                                </div>
                                <span className="text-xs font-black text-primary">Виж съобщението →</span>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {targetUser && (
                      <div className="space-y-4 border-t border-primary/10 pt-6">
                        <h3 className="font-bold text-foreground">Свързан потребител</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <InfoBlock label="Име" value={`${targetUser.firstName} ${targetUser.lastName}`} />
                          <InfoBlock label="Имейл" value={targetUser.email} />
                          <InfoBlock label="Роля" value={ROLE_LABELS[targetUser.role]} />
                          <InfoBlock label="Училище" value={targetUser.school} />
                        </div>
                      </div>
                    )}

                    {targetClass && (
                      <div className="space-y-4 border-t border-primary/10 pt-6">
                        <h3 className="font-bold text-foreground">Свързан клас</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <InfoBlock label="Име на клас" value={targetClass.name} />
                          <InfoBlock label="Училище" value={targetClass.school} />
                        </div>
                      </div>
                    )}

                    {!targetMessage && !targetUser && !targetClass && entry.targetId && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mt-2">
                        <p className="text-sm font-medium text-amber-600">Обектът (ID: {entry.targetId}) вече не съществува в системата (вероятно е бил изтрит).</p>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="border-t border-primary/10 p-8 pt-6 flex-row justify-between sm:justify-between items-center gap-4">
                    <div className="flex flex-wrap gap-2">


                      {(entry.action.startsWith('Изтриване') || entry.action.includes('изтрит')) && isDeleted && snapshotData && (
                        <div className="flex items-center">
                          {restoredEntries.includes(entry.id) ? (
                            <div className="flex items-center gap-2 px-6 h-11 rounded-xl bg-success/10 text-success font-black text-sm border-2 border-success/20">
                              <Check className="h-4 w-4" />
                              Обектът е възстановен
                            </div>
                          ) : (
                            <Button
                              variant="default"
                              className="rounded-xl h-11 bg-success hover:bg-success/90 text-white shadow-xl shadow-success/20 font-black px-8"
                              disabled={busyAction === `restore-${entry.id}`}
                              onClick={() => handleRestore(entry)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" /> Възстанови съдържанието
                            </Button>
                          )}
                        </div>
                      )}

                      {(entry.targetType === 'comment' || !isDeleted) ? (
                        <Button
                          variant="outline"
                          className="rounded-xl h-11 border-destructive/20 text-destructive hover:bg-destructive hover:text-white font-black px-6 shadow-lg shadow-destructive/5"
                          disabled={busyAction === `full-delete-${entry.id}`}
                          onClick={() => setLogAndContentDeletionCandidate(entry)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Изтриване на запис и съдържание
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          className="rounded-xl h-11 bg-destructive hover:bg-destructive/90 text-white font-black px-6 shadow-xl shadow-destructive/20 transition-all duration-300"
                          disabled={busyAction === `perm-delete-${entry.id}`}
                          onClick={() => handlePermanentDelete(entry.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Перманентно изтриване на запис
                        </Button>
                      )}
                    </div>

                    <Button variant="outline" className="rounded-xl h-11 font-black px-8" onClick={() => setSelectedAuditEntry(null)}>Затвори</Button>
                  </DialogFooter>
                </>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={open => !open && setDeleteCandidate(null)}>
        <AlertDialogContent className="rounded-[2rem] border-primary/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Изтриване на потребител</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate ? `Ще бъде изтрит профилът на ${deleteCandidate.firstName} ${deleteCandidate.lastName}. Това действие не може да бъде отменено.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Отказ</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Изтрий
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════ DIALOG: Потвърждение за изтриване на клас ═══════ */}
      <AlertDialog open={Boolean(classDeletePreview)} onOpenChange={open => !open && setClassDeletePreview(null)}>
        <AlertDialogContent className="max-w-xl rounded-[2rem] border-primary/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-destructive">
              ⚠️ Изтриване на клас {classDeletePreview?.className}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm">
                <p className="font-bold text-foreground">
                  Това действие е необратимо и ще изтрие ВСИЧКИ данни, свързани с учениците от този клас!
                </p>

                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                  <p className="font-black text-destructive">Ще бъдат изтрити:</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li><span className="font-bold text-foreground">{classDeletePreview?.studentsCount || 0} ученика</span> — профили, съобщения, коментари</li>
                    <li><span className="font-bold text-foreground">{classDeletePreview?.messagesCount || 0} съобщения</span> от тези ученици</li>
                    <li><span className="font-bold text-foreground">{classDeletePreview?.commentsCount || 0} коментара</span> от тези ученици</li>
                    <li>Всички уведомления, статуси за прочитане и архиви</li>
                    <li>Записите от журнала на тези ученици</li>
                  </ul>
                </div>

                {(classDeletePreview?.studentsCount || 0) > 0 && (
                  <div className="rounded-xl border border-primary/10 bg-muted/30 p-4">
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Засегнати ученици:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {classDeletePreview?.students.map(s => (
                        <p key={s.id} className="text-sm font-medium text-foreground">{s.name} <span className="text-muted-foreground">({s.email})</span></p>
                      ))}
                    </div>
                  </div>
                )}

                {(classDeletePreview?.classTeachersCount || 0) > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-amber-600">Класни ръководители (НЕ се изтриват, стават редовни учители):</p>
                    <div className="space-y-1">
                      {classDeletePreview?.classTeachers.map(t => (
                        <p key={t.id} className="text-sm font-medium text-foreground">{t.name} <span className="text-muted-foreground">({t.email})</span></p>
                      ))}
                    </div>
                  </div>
                )}

                <p className="font-medium text-muted-foreground">
                  Училище: <span className="font-bold text-foreground">{classDeletePreview?.school}</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Отказ</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteClass}
              disabled={busyAction === `delete-class-${classDeletePreview?.classId}`}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Изтрий класа и {classDeletePreview?.studentsCount || 0} ученика
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════ DIALOG: Отхвърляне на регистрация ═══════ */}
      <AlertDialog open={Boolean(rejectionCandidate)} onOpenChange={open => !open && setRejectionCandidate(null)}>
        <AlertDialogContent className="rounded-[2.5rem] border-primary/10 max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-2xl font-black text-rose-600 flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 rounded-2xl">
                <UserX size={24} />
              </div>
              Отхвърляне на профил
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base pt-4 space-y-4">
              <p>Сигурни ли сте, че искате да отхвърлите регистрацията на <span className="font-bold text-foreground">{rejectionCandidate?.firstName} {rejectionCandidate?.lastName}</span>?</p>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Бележка към регистрацията (по избор)</p>
                <Input
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="Причина за отхвърляне..."
                  className="h-11 rounded-xl bg-background"
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="rounded-xl h-12 font-bold px-8">Отказ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rejectionCandidate) {
                  handleReject(rejectionCandidate, rejectNote);
                }
                setRejectionCandidate(null);
              }}
              className="rounded-xl h-12 font-black px-8 bg-rose-500 text-white hover:bg-rose-600 shadow-xl shadow-rose-500/20"
            >
              Потвърди отхвърлянето
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════ DIALOG: Перманентно изтриване на запис и съдържание ═══════ */}
      <AlertDialog open={Boolean(logAndContentDeletionCandidate)} onOpenChange={open => !open && setLogAndContentDeletionCandidate(null)}>
        <AlertDialogContent className="rounded-[2.5rem] border-primary/10 max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-2xl font-black text-destructive flex items-center gap-3">
              <div className="p-3 bg-destructive/10 rounded-2xl">
                <Trash2 size={24} />
              </div>
              Изтриване на запис и съдържание
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base pt-4 space-y-4">
              <div className="rounded-2xl border-2 border-destructive/20 bg-destructive/5 p-6 space-y-3">
                <p className="font-black text-destructive leading-tight">ВНИМАНИЕ: Това действие ще изтрие ОКОНЧАТЕЛНО:</p>
                <ul className="list-disc pl-5 space-y-1.5 font-bold text-foreground">
                  <li>Записа в системния журнал (Одит запис)</li>
                  {logAndContentDeletionCandidate?.targetType === 'message' && <li>Самото съобщение и всички негови коментари</li>}
                  {logAndContentDeletionCandidate?.targetType === 'user' && <li>Профила на потребителя и всички негови лични данни</li>}
                  {logAndContentDeletionCandidate?.targetType === 'comment' && <li>Съответния коментар</li>}
                  {logAndContentDeletionCandidate?.targetType === 'class' && <li>Класа и всички връзки към него</li>}
                </ul>
              </div>

              <p className="text-sm font-medium text-muted-foreground leading-relaxed italic">
                Избраното действие в журнала ({logAndContentDeletionCandidate?.action}) ще бъде премахнато автоматично след изтриването.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="rounded-xl h-12 font-bold px-8">Отказ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (logAndContentDeletionCandidate) {
                  handleLogAndContentDelete(logAndContentDeletionCandidate);
                }
              }}
              className="rounded-xl h-12 font-black px-8 bg-destructive text-white hover:bg-destructive/90 shadow-xl shadow-destructive/20"
            >
              Да, изтрий всичко окончателно
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ScrollToTop />
    </>
  );
};

const getSortValue = (user: User, key: UserSortKey) => {
  switch (key) {
    case 'name':
      return `${user.firstName} ${user.lastName}`;
    case 'role':
      return ROLE_LABELS[user.role];
    case 'registrationStatus':
      return REGISTRATION_STATUS_LABELS[user.registrationStatus];
    case 'school':
      return user.school || '';
    case 'class':
      return user.class || '';
    case 'email':
      return user.email;
    default:
      return '';
  }
};

const sortLabel = (key: UserSortKey) => {
  switch (key) {
    case 'name':
      return 'име';
    case 'role':
      return 'роля';
    case 'registrationStatus':
      return 'статус';
    case 'school':
      return 'училище';
    case 'class':
      return 'клас';
    case 'email':
      return 'имейл';
  }
};

const SortableHead: React.FC<{ title: string; onClick: () => void; centered?: boolean }> = ({ title, onClick, centered = false }) => (
  <TableHead className={`h-14 text-xs font-black uppercase tracking-widest ${centered ? 'text-center' : ''}`}>
    <button type="button" onClick={onClick} className="font-black uppercase tracking-widest text-inherit">
      {title}
    </button>
  </TableHead>
);

const StatCard: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => {
  const isLong = value.length > 20;
  return (
    <div className={`rounded-[1.5rem] border p-6 flex flex-col justify-center ${accent ? 'border-amber-500/20 bg-amber-500/5' : 'border-primary/10 bg-muted/30'}`}>
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-3 font-black leading-tight ${accent ? 'text-amber-600' : 'text-foreground'} ${isLong ? 'text-xl' : 'text-4xl'}`}>
        {value}
      </p>
    </div>
  );
};



export default AdminPanel;
