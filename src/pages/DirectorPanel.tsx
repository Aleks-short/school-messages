import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import { BarChart3, BookOpen, ClipboardList, Mail, Plus, ShieldCheck, Search, Settings, Trash2, UserCheck, UserX, Users, RotateCcw, Clock, LogIn, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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

const STATUS_COLORS = {
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
  rejected: 'bg-rose-500/15 text-rose-600 border-rose-500/20',
} as const;

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  director: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  teacher: 'bg-primary/10 text-primary border-primary/20',
  student: 'bg-success/15 text-success border-success/20',
};

const MANAGEABLE_ROLES: UserRole[] = ['teacher', 'student'];
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

const formatDate = (value?: string) => {
  if (!value) return '—';
  return format(new Date(value), 'd MMM yyyy, HH:mm', { locale: bg });
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
  setting: 'НАСТРОЙКА',
  draft: 'ЧЕРНОВА',
  archive: 'АРХИВ',
};

const InfoBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-primary/10 bg-muted/20 p-4 min-w-0">
    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="mt-2 text-sm font-medium text-foreground break-all">{value}</p>
  </div>
);

const getAuditValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Не';
  return String(value);
};

const getMessageTitleFromDetails = (details: string) => details.match(/"([^"]+)"/)?.[1] || '';

const getPublishedMessageFallbackSnapshot = (details: string) => ({
  title: getMessageTitleFromDetails(details) || '(Без заглавие)',
  content: 'Пълното съдържание не е запазено в този стар журнален запис.',
  category: details.match(/Категория:\s*([^|]+)/)?.[1]?.trim() || '—',
  importance: details.match(/Важност:\s*([^|]+)/)?.[1]?.trim() || '—',
  authorName: '—',
});

const getDeletedMessageFallbackSnapshot = (details: string, sourceDetails?: string) => ({
  title: getMessageTitleFromDetails(details) || '(Без заглавие)',
  content: 'Пълното съдържание не е запазено в този стар журнален запис.',
  category: (sourceDetails || details).match(/Категория:\s*([^|]+)/)?.[1]?.trim() || '—',
  importance: (sourceDetails || details).match(/Важност:\s*([^|]+)/)?.[1]?.trim() || '—',
  authorName: '—',
});

const StatCard: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <Card className={`rounded-3xl border-none shadow-sm transition-all hover:shadow-md ${accent ? 'bg-primary text-white' : 'bg-muted/30 text-foreground'}`}>
    <CardContent className="p-6">
      <p className={`text-xs font-black uppercase tracking-widest ${accent ? 'text-white/70' : 'text-muted-foreground'}`}>{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </CardContent>
  </Card>
);

const DirectorPanel: React.FC = () => {
  const { user, allUsers } = useAuth();
  const { entries: auditEntries, deleteEntry, addEntry } = useAuditLog();
  const { messages, getVisibleMessages, deleteMessage, deleteComment } = useMessages();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const auditSearch = searchParams.get('auditSearch') || '';
  const setAuditSearch = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set('auditSearch', val);
    else newParams.delete('auditSearch');
    setSearchParams(newParams, { replace: true });
  };
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<AuditLogEntry | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const auditTargetTypeFilter = searchParams.get('auditTargetType') || 'all';
  const setAuditTargetTypeFilter = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val !== 'all') newParams.set('auditTargetType', val);
    else newParams.delete('auditTargetType');
    newParams.delete('auditAction'); // Reset variant action when type changes
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
  const [deleteCandidate, setDeleteCandidate] = useState<User | null>(null);
  const [logAndContentDeletionCandidate, setLogAndContentDeletionCandidate] = useState<AuditLogEntry | null>(null);
  const [restoredEntries, setRestoredEntries] = useState<string[]>([]);
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
  const activeTab = searchParams.get('tab') || 'users';
  const auditUserId = searchParams.get('userId');
  const { data: schoolClasses = [] } = useQuery({
    queryKey: ['schoolClasses', user?.school],
    queryFn: () => metadataApi.getClasses(user?.school),
    enabled: !!user,
  });

  const sortedClasses = useMemo(() => {
    const parseClass = (c: string | undefined) => {
      if (!c) return { num: 0, suffix: '' };
      const match = c.match(/^(\d+)(.*)$/);
      if (!match) return { num: 0, suffix: c };
      return { num: parseInt(match[1], 10), suffix: match[2] };
    };

    return [...schoolClasses].sort((a, b) => {
      const classA = parseClass(a.name);
      const classB = parseClass(b.name);

      if (classA.num !== classB.num) return classB.num - classA.num;
      return classA.suffix.localeCompare(classB.suffix, 'bg');
    });
  }, [schoolClasses]);

  const { data: systemInfo } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: () => metadataApi.getSystemInfo(),
  });

  const manageableUsers = useMemo(
    () => allUsers.filter(candidate => MANAGEABLE_ROLES.includes(candidate.role)),
    [allUsers],
  );

  const stats = useMemo(() => {
    const pending = manageableUsers.filter(u => u.registrationStatus === 'pending').length;
    const approved = manageableUsers.filter(u => u.registrationStatus === 'approved').length;
    const rejected = manageableUsers.filter(u => u.registrationStatus === 'rejected').length;
    const teachers = manageableUsers.filter(u => u.role === 'teacher').length;
    const students = manageableUsers.filter(u => u.role === 'student').length;

    // School-specific metrics
    const schoolMessages = getVisibleMessages().filter(m => m.authorSchool === user?.school);
    const totalMessages = schoolMessages.length;
    const publishedMessages = schoolMessages.filter(m => m.status === 'published').length;
    const draftMessages = schoolMessages.filter(m => m.status === 'draft').length;
    const personalMessages = schoolMessages.filter(m => isPersonalMessage(m.targetAudience, m.category)).length;
    const totalComments = schoolMessages.reduce((sum, m) => sum + (m.comments?.length || 0), 0);

    const schoolAudit = auditEntries.filter(e => e.performedBySchool === user?.school);
    const auditActions = schoolAudit.length;
    const todayActions = schoolAudit.filter(e => {
      const d = new Date(e.createdAt);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length;

    return {
      pending, approved, rejected, teachers, students,
      totalMessages, publishedMessages, draftMessages, personalMessages,
      totalComments, auditActions, todayActions
    };
  }, [manageableUsers, getVisibleMessages, auditEntries, user?.school]);

  const selectedUser = manageableUsers.find(candidate => candidate.id === selectedUserId) ?? null;

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = manageableUsers.filter(candidate => {
      if (roleFilter !== 'all' && candidate.role !== roleFilter) return false;
      if (statusFilter !== 'all' && candidate.registrationStatus !== statusFilter) return false;
      if (classFilter !== 'all' && candidate.class !== classFilter) return false;
      if (!query) return true;

      return [candidate.firstName, candidate.lastName, candidate.email, candidate.class, candidate.subject, candidate.pendingSubject, candidate.pendingTeacherType]
        .some(value => value?.toLowerCase().includes(query));
    });

    return [...filtered].sort((a, b) => {
      const rolePriority: Record<string, number> = { admin: 0, director: 1, teacher: 2, student: 3 };
      const roleA = rolePriority[a.role] ?? 99;
      const roleB = rolePriority[b.role] ?? 99;
      if (roleA !== roleB) return roleA - roleB;

      const schoolA = a.school || '';
      const schoolB = b.school || '';
      const schoolCmp = schoolA.localeCompare(schoolB, 'bg');
      if (schoolCmp !== 0) return schoolCmp;

      const parseClass = (c: string | undefined) => {
        if (!c) return { num: 0, suffix: '' };
        const match = c.match(/^(\d+)(.*)$/);
        if (!match) return { num: 0, suffix: c };
        return { num: parseInt(match[1], 10), suffix: match[2] };
      };

      const classA = parseClass(a.class);
      const classB = parseClass(b.class);
      if (classA.num !== classB.num) return classA.num - classB.num;
      const suffixCmp = classA.suffix.localeCompare(classB.suffix, 'bg');
      if (suffixCmp !== 0) return suffixCmp;

      const nameA = `${a.firstName} ${a.lastName}`;
      const nameB = `${b.firstName} ${b.lastName}`;
      return nameA.localeCompare(nameB, 'bg');
    });
  }, [manageableUsers, search, statusFilter, roleFilter, classFilter]);

  const filteredAudit = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    const now = new Date();

    return auditEntries
      .filter(entry => !auditUserId || entry.performedBy === auditUserId)
      .filter(entry => auditTargetTypeFilter === 'all' || entry.targetType === auditTargetTypeFilter)
      .filter(entry => auditActionFilter === 'all' || entry.action === auditActionFilter)
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
      .filter(entry => !query || entry.action.toLowerCase().includes(query) || entry.details.toLowerCase().includes(query) || entry.performedByName.toLowerCase().includes(query))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [auditSearch, auditUserId, auditTargetTypeFilter, auditActionFilter, auditDateFilter, auditEntries]);



  if (!user || user.role !== 'director') {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <ShieldCheck className="mx-auto mb-3 h-12 w-12 opacity-40" />
        <p>Нямате достъп до директорския панел</p>
      </div>
    );
  }

  const refreshUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] }),
      queryClient.invalidateQueries({ queryKey: ['messages'] }),
    ]);
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

  const handleApprove = async (target: User) => {
    await updateUser(
      target,
      {
        registrationStatus: 'approved',
        registrationReviewNote: reviewNote.trim() || '',
        ...(target.role === 'teacher' && target.pendingSubject
          ? { subject: target.pendingSubject, pendingSubject: '' }
          : {}),
      },
      'Регистрацията е одобрена.',
      `approve-${target.id}`,
    );
  };

  const handleReject = async (target: User, note: string) => {
    await updateUser(
      target,
      { registrationStatus: 'rejected', registrationReviewNote: note.trim() || '' },
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
      performedBy: user!.id,
      performedByName: `${user!.firstName} ${user!.lastName}`,
      performedBySchool: user!.school,
      targetType: 'user',
      targetId: target.id,
      details: `Отхвърлена смяна на типа на учител за ${target.firstName} ${target.lastName}`,
    });
  };

  const handleRoleChange = async (target: User, nextRole: UserRole) => {
    if (!MANAGEABLE_ROLES.includes(nextRole)) return;

    await updateUser(
      target,
      {
        role: nextRole,
        managementPosition: null as never,
        teacherType: nextRole === 'teacher' ? target.teacherType : null as never,
        class: nextRole === 'student' || nextRole === 'teacher' ? target.class : null as never,
      },
      'Ролята е обновена.',
      `role-${target.id}`,
    );
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
        const { messageExists, editHistory, targetUser, targetUsers, authorRole, authorClass, authorTeacherType, authorSubject, ...rest } = data;
        await messagesApi.create(rest);
      } else if (entry.targetType === 'comment') {
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
        performedBy: user!.id,
        performedByName: `${user!.firstName} ${user!.lastName}`,
        performedBySchool: user!.school,
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
        if (messages.some(m => m.id === entry.targetId)) {
          await deleteMessage(entry.targetId);
        }
      } else if (entry.targetType === 'user' && entry.targetId) {
        if (allUsers.some(u => u.id === entry.targetId)) {
          await usersApi.delete(entry.targetId);
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
      await messagesApi.delete(messageId);
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

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    setBusyAction('create-class');
    try {
      await metadataApi.createClass({ name: newClassName });
      await queryClient.invalidateQueries({ queryKey: ['schoolClasses', user.school] });
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
        details: `Създаден нов клас "${newClassName}" в училище "${user.school}"`,
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
        queryClient.invalidateQueries({ queryKey: ['schoolClasses', user.school] }),
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
        details: `Изтрит клас "${classDeletePreview.className}". Премахнати ${classDeletePreview.studentsCount} ученици.`,
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
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight text-foreground">Директорски панел</h1>
          <p className="font-medium text-muted-foreground">Локално управление на учители и ученици за {user.school}</p>
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

          {/* ═══════ TAB: ПОТРЕБИТЕЛИ ═══════ */}
          <TabsContent value="users" className="outline-none">
            <Card className="overflow-hidden rounded-[2.5rem] border-primary/5 bg-card shadow-xl">
              <CardHeader className="space-y-6 border-b border-primary/5 bg-gradient-to-r from-violet-500/5 to-transparent p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="font-heading text-2xl font-black">Управление на потребители</CardTitle>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">Учители и ученици от Вашето училище ({filteredUsers.length})</p>
                  </div>
                  <div className="relative w-full lg:w-80">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Търсене по име, имейл, клас..."
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      className="h-11 rounded-xl border-none bg-background/50 pl-10 font-medium shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 whitespace-nowrap">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/70 font-medium">
                      <SelectValue placeholder="Роля" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всички роли</SelectItem>
                      {Object.entries(ROLE_LABELS).filter(([role]) => ['teacher', 'student'].includes(role)).map(([role, label]) => (
                        <SelectItem key={role} value={role}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/70 font-medium">
                      <SelectValue placeholder="Статус" />
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
                      <SelectValue placeholder="Клас" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всички класове</SelectItem>
                      {sortedClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center rounded-xl border border-primary/10 bg-background/70 px-4 text-xs font-black uppercase tracking-widest text-muted-foreground/60 overflow-hidden text-ellipsis h-11">
                    {user.school}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="border-b-2 border-primary/20 hover:bg-transparent text-[10px]">
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Име</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Роля</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Статус</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Клас</TableHead>
                        <TableHead className="px-4 font-black uppercase tracking-widest text-center border-r border-primary/10">Предмети</TableHead>
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
                          <TableCell className="py-4 text-[11px] font-bold border-r border-primary/5 text-center">{candidate.class || '—'}</TableCell>
                          <TableCell className="py-4 text-[11px] font-medium border-r border-primary/5 text-center">{candidate.subject || '—'}</TableCell>
                          <TableCell className="py-4 text-[11px] font-medium text-muted-foreground border-r border-primary/5 text-center">{candidate.email}</TableCell>
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

          {/* ═══════ TAB: ЖУРНАЛ ═══════ */}
          <TabsContent value="audit" className="outline-none">
            <Card className="overflow-hidden rounded-[2.5rem] border-primary/5 bg-card shadow-xl">
              <CardHeader className="border-b border-primary/5 bg-gradient-to-r from-violet-500/5 to-transparent p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-md">
                    <CardTitle className="font-heading text-2xl font-black">Журнал на училището</CardTitle>
                    <p className="mt-1 text-sm font-medium text-muted-foreground leading-relaxed">
                      {auditUserId ? 'История на избрания потребител' : `Действия само на потребители от ${user.school} (${filteredAudit.length})`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 items-center flex-1 justify-end">
                    <Select value={auditDateFilter} onValueChange={setAuditDateFilter}>
                      <SelectTrigger className="h-11 w-40 rounded-xl bg-background/70 font-medium">
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
                      <SelectTrigger className="h-11 w-40 rounded-xl bg-background/70 font-medium">
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
                      <Input value={auditSearch} onChange={event => setAuditSearch(event.target.value)} placeholder="Търсене..." className="h-11 rounded-xl border-none bg-background/50 pl-10 font-medium shadow-inner" />
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
                    <div key={entry.id} className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-primary/5 bg-card/50 p-5 cursor-pointer hover:bg-muted/30 transition-all duration-300" onClick={() => setSelectedAuditEntry(entry)}>
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



          {/* ═══════ TAB: КЛАСОВЕ ═══════ */}
          <TabsContent value="classes" className="outline-none">
            <Card className="overflow-hidden rounded-[2.5rem] border-primary/5 bg-card shadow-xl">
              <CardHeader className="border-b border-primary/5 bg-gradient-to-r from-violet-500/5 to-transparent p-8">
                <div>
                  <CardTitle className="font-heading text-2xl font-black">Училищна структура</CardTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">Създаване и изтриване на класове само за {user.school}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <div className="flex flex-col gap-4">
                  {!isCreatingClass ? (
                    <div className="flex justify-start">
                      <Button
                        onClick={() => setIsCreatingClass(true)}
                        className="h-11 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-all duration-300"
                        variant="ghost"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Добави нов клас
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10 animate-in fade-in zoom-in-95 duration-300">
                      <div className="flex-1">
                        <Input
                          autoFocus
                          value={newClassName}
                          onChange={event => setNewClassName(event.target.value)}
                          placeholder="Име на новия клас (напр. 8А)..."
                          className="h-11 rounded-xl border-primary/10 bg-background"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateClass();
                            if (e.key === 'Escape') setIsCreatingClass(false);
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCreateClass}
                          disabled={busyAction === 'create-class' || !newClassName.trim()}
                          className="h-11 rounded-xl shadow-lg shadow-primary/20"
                        >
                          Запази
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsCreatingClass(false);
                            setNewClassName('');
                          }}
                          className="h-11 rounded-xl text-muted-foreground"
                        >
                          Отказ
                        </Button>
                      </div>
                    </div>
                  )}
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
                      <p className="text-sm font-bold">Няма създадени класове</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ═══════ DIALOG: Потребител ═══════ */}
          <Dialog open={Boolean(selectedUser)} onOpenChange={open => {
            if (!open) {
              setSelectedUserId(null);
              setReviewNote('');
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-[2rem] border-primary/10 p-0 transition-all duration-500">
              {selectedUser && (
                <>
                  <DialogHeader className="border-b border-primary/10 p-8 pb-6 flex-shrink-0">
                    <DialogTitle className="text-2xl font-black">{selectedUser.firstName} {selectedUser.lastName}</DialogTitle>
                    <DialogDescription>
                      Верификация на регистрацията и локално управление на потребителя.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-8 pt-6 space-y-8">
                      {/* Секция: Обща информация */}
                      <section>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4 pb-2 border-b border-primary/5">Обща информация</h3>
                        <div className="grid gap-6 md:grid-cols-2">
                          <InfoBlock label="Имейл" value={selectedUser.email} />
                          <InfoBlock label="Роля" value={ROLE_LABELS[selectedUser.role]} />
                          <InfoBlock label="Училище" value={selectedUser.school} />
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
                        <div className="space-y-2 col-span-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Промяна на роля</p>
                          <Select value={selectedUser.role} onValueChange={value => handleRoleChange(selectedUser, value as UserRole)}>
                            <SelectTrigger className="h-11 rounded-xl font-medium bg-background/50">
                              <SelectValue placeholder="Изберете роля" />
                            </SelectTrigger>
                            <SelectContent>
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
                              onClick={() => handleApprove(selectedUser)}
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

          {/* ═══════ DIALOG: Confirm User Delete ═══════ */}
          <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={open => !open && setDeleteCandidate(null)}>
            <AlertDialogContent className="rounded-[2.5rem] border-primary/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading text-2xl font-black text-rose-600 flex items-center gap-3">
                  <div className="p-3 bg-rose-500/10 rounded-2xl">
                    <Trash2 size={24} />
                  </div>
                  Окончателно изтриване
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base pt-4">
                  {deleteCandidate && (
                    <>
                      Сигурни ли сте, че искате да изтриете профила на <span className="font-bold text-foreground">{deleteCandidate.firstName} {deleteCandidate.lastName}</span>?
                      <br /><br />
                      <span className="text-rose-600 font-bold">Внимание:</span> Това действие ще премахне всички данни, съобщения и коментари свързани с този потребител. ТОВА НЕ МОЖЕ ДА БЪДЕ ОТМЕНЕНО.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="pt-6">
                <AlertDialogCancel className="rounded-xl h-12 font-bold px-8">Отказ</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={busyAction === `delete-${deleteCandidate?.id}`}
                  className="rounded-xl h-12 font-black px-8 bg-rose-500 text-white hover:bg-rose-600 shadow-xl shadow-rose-500/20"
                >
                  {busyAction === `delete-${deleteCandidate?.id}` ? "Изтриване..." : "Да, изтрий профила"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ═══════ DIALOG: Audit Log Detail ═══════ */}
          <Dialog open={Boolean(selectedAuditEntry)} onOpenChange={open => !open && setSelectedAuditEntry(null)}>
            <DialogContent className="max-w-2xl rounded-[2rem] border-primary/10 p-0">
              {selectedAuditEntry && (() => {
                const entry = selectedAuditEntry;
                let snapshotData: any = null;
                if (entry.targetData) {
                  try { snapshotData = JSON.parse(entry.targetData); } catch (e) { }
                }

                const targetMessageId = entry.targetType === 'message' ? entry.targetId : (entry.targetType === 'comment' ? snapshotData?.messageId : null);
                const targetMessage = targetMessageId ? getVisibleMessages().find(m => m.id === String(targetMessageId)) : null;
                const targetUser = entry.targetType === 'user' ? allUsers.find(u => u.id === entry.targetId) : null;
                const targetClass = entry.targetType === 'class' ? schoolClasses.find(c => c.id === entry.targetId) : null;
                const isMessageEditAction = entry.action === 'Редакция на съобщение' && entry.targetType === 'message';
                const isMessagePublishAction = entry.action === 'Публикуване на съобщение' && entry.targetType === 'message';
                const isMessageDeleteAction = entry.action === 'Изтриване на съобщение' && entry.targetType === 'message';
                const isAddedCommentAction = entry.action === 'Добавен коментар' && entry.targetType === 'comment';
                const editPrevious = isMessageEditAction ? snapshotData?.previous : null;
                const editCurrent = isMessageEditAction ? (snapshotData?.current || targetMessage) : null;
                const editChanges = isMessageEditAction && snapshotData?.changes && typeof snapshotData.changes === 'object'
                  ? Object.entries(snapshotData.changes as Record<string, { label?: string; from?: unknown; to?: unknown }>)
                  : [];
                const publishFallback = isMessagePublishAction ? getPublishedMessageFallbackSnapshot(entry.details) : null;
                const publishMessage = isMessagePublishAction ? (targetMessage || snapshotData || publishFallback) : null;
                const publishTitle = publishMessage?.title || getMessageTitleFromDetails(entry.details) || `(Съобщение #${entry.targetId})`;
                const canOpenPublishedMessage = Boolean(targetMessage || snapshotData?.messageExists);
                const relatedPublishEntry = isMessageDeleteAction
                  ? auditEntries.find(item => item.action === 'Публикуване на съобщение' && item.targetType === 'message' && item.targetId === entry.targetId)
                  : null;
                const deleteFallback = isMessageDeleteAction ? getDeletedMessageFallbackSnapshot(entry.details, relatedPublishEntry?.details) : null;
                const deletedMessage = isMessageDeleteAction ? (snapshotData || deleteFallback) : null;
                const deletedTitle = deletedMessage?.title || getMessageTitleFromDetails(entry.details) || `(Съобщение #${entry.targetId})`;
                const commentMessageTitle = targetMessage?.title || snapshotData?.messageTitle || getMessageTitleFromDetails(entry.details) || 'Свързано съобщение';
                const canOpenCommentMessage = Boolean(snapshotData?.messageId && (targetMessage || snapshotData?.messageExists));

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

                      {isMessageEditAction && (
                        <div className="space-y-5 border-t border-primary/10 pt-6">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-foreground">Редакция на съобщение</h3>
                              <p className="mt-1 text-sm font-medium text-muted-foreground">Сравнение между предишното и новото съдържание.</p>
                            </div>
                            <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/10">Преди / След</Badge>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedAuditEntry(null);
                              navigate(`/messages/${entry.targetId}`);
                            }}
                            className="block w-full text-left group/link"
                          >
                            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-5 transition-all hover:border-primary/30 hover:bg-primary/10">
                              <div className="flex items-center justify-between mb-3 border-b border-primary/10 pb-2">
                                <p className="text-xs font-black uppercase tracking-widest text-primary">Към редактираното съобщение</p>
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover/link:opacity-100 transition-opacity">Прегледай съобщението →</span>
                              </div>
                              <h4 className="text-base font-black text-foreground group-hover/link:text-primary transition-colors">
                                {editCurrent?.title || targetMessage?.title || getMessageTitleFromDetails(entry.details) || `(Съобщение #${entry.targetId})`}
                              </h4>
                            </div>
                          </button>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-5">
                              <p className="text-xs font-black uppercase tracking-widest text-amber-600">Преди редакцията</p>
                              <h4 className="mt-3 text-base font-black text-foreground">{editPrevious?.title || 'Няма запазено старо заглавие'}</h4>
                              <p className="mt-2 text-sm font-medium text-muted-foreground line-clamp-6">
                                {editPrevious?.content ? getContentPreview(editPrevious.content) : 'Няма запазено старо съдържание.'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5">
                              <p className="text-xs font-black uppercase tracking-widest text-emerald-600">След редакцията</p>
                              <h4 className="mt-3 text-base font-black text-foreground">{editCurrent?.title || targetMessage?.title || getMessageTitleFromDetails(entry.details) || 'Без заглавие'}</h4>
                              <p className="mt-2 text-sm font-medium text-muted-foreground line-clamp-6">
                                {editCurrent?.content ? getContentPreview(editCurrent.content) : 'Няма запазено ново съдържание.'}
                              </p>
                            </div>
                          </div>

                          
                        </div>
                      )}

                      {isMessagePublishAction && (
                        <div className="space-y-4 border-t border-primary/10 pt-6">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-foreground">Публикувано съобщение</h3>
                              <p className="mt-1 text-sm font-medium text-muted-foreground">Информация за съобщението от journal записа.</p>
                            </div>
                            <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">Публикувано</Badge>
                          </div>

                          {canOpenPublishedMessage ? (
                            <button
                              onClick={() => {
                                setSelectedAuditEntry(null);
                                navigate(`/messages/${entry.targetId}`);
                              }}
                              className="block w-full text-left group/link"
                            >
                              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/10">
                                <div className="flex items-center justify-between mb-3 border-b border-emerald-500/10 pb-2">
                                  <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Към публикуваното съобщение</p>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 opacity-0 group-hover/link:opacity-100 transition-opacity">Прегледай съобщението →</span>
                                </div>
                                <h4 className="text-base font-black text-foreground group-hover/link:text-emerald-600 transition-colors mb-2">{publishTitle}</h4>
                                <p className="text-sm font-medium text-muted-foreground line-clamp-4 group-hover/link:text-foreground transition-colors">
                                  {publishMessage?.content ? getContentPreview(publishMessage.content) : entry.details}
                                </p>
                              </div>
                            </button>
                          ) : (
                            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5">
                              <div className="flex items-center justify-between mb-3 border-b border-emerald-500/10 pb-2">
                                <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Преглед на публикуваното съобщение</p>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Само за четене</span>
                              </div>
                              <h4 className="text-base font-black text-foreground mb-2">{publishTitle}</h4>
                              <p className="text-sm font-medium text-muted-foreground line-clamp-4">
                                {publishMessage?.content ? getContentPreview(publishMessage.content) : entry.details}
                              </p>
                            </div>
                          )}

                          {publishMessage && (
                            <div className="grid gap-4 md:grid-cols-2">
                              <InfoBlock label="Категория" value={CATEGORY_LABELS[publishMessage.category] || publishMessage.category || '—'} />
                              <InfoBlock label="Аудитория" value={publishMessage.targetAudience ? getAudiencePreview(publishMessage.targetAudience, allUsers) : '—'} />
                            </div>
                          )}
                        </div>
                      )}

                      {isMessageDeleteAction && deletedMessage && (
                        <div className="space-y-4 border-t border-primary/10 pt-6">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-foreground">Изтрито съобщение</h3>
                              <p className="mt-1 text-sm font-medium text-muted-foreground">Информацията е запазена от journal записа за изтриването.</p>
                            </div>
                            <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/10">Изтрито</Badge>
                          </div>

                          <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-5">
                            <div className="flex items-center justify-between mb-3 border-b border-rose-500/10 pb-2">
                              <p className="text-xs font-black uppercase tracking-widest text-rose-600">Преглед на изтритото съобщение</p>
                              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Само за четене</span>
                            </div>
                            <h4 className="text-base font-black text-foreground mb-2">{deletedTitle}</h4>
                            <p className="text-sm font-medium text-muted-foreground line-clamp-4">
                              {deletedMessage?.content ? getContentPreview(deletedMessage.content) : entry.details}
                            </p>
                          </div>

                          <div className="grid gap-4">
                            <InfoBlock label="Категория" value={CATEGORY_LABELS[deletedMessage.category] || deletedMessage.category || '—'} />
                          </div>
                        </div>
                      )}

                      {targetMessage && entry.targetType === 'message' && !isMessageEditAction && !isMessagePublishAction && !isMessageDeleteAction && (
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
                              <InfoBlock label="Аудитория" value={getAudiencePreview(targetMessage.targetAudience, allUsers)} />
                            </div>
                          </div>
                        </div>
                      )}

                      {!targetMessage && entry.targetType === 'message' && snapshotData && !isMessageEditAction && !isMessagePublishAction && !isMessageDeleteAction && (
                        <div className="space-y-4 border-t border-primary/10 pt-6">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-foreground">Свързано съобщение</h3>
                            <Badge variant="outline" className="text-[10px]">Snapshot</Badge>
                          </div>
                          <div className="grid gap-4">
                            <div className="rounded-2xl border border-primary/10 bg-muted/20 p-5">
                              <div className="flex items-center justify-between mb-3 border-b border-primary/5 pb-2">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Преглед на съдържанието</p>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Само за четене</span>
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

                      {entry.targetType === 'draft' && snapshotData && (
                        <div className="space-y-4 border-t border-primary/10 pt-6">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-foreground">Свързана чернова</h3>
                            <Badge variant="outline" className="text-[10px]">Чернова</Badge>
                          </div>
                          <div className="grid gap-4">
                            <div className="rounded-2xl border border-primary/10 bg-muted/20 p-5">
                              <div className="flex items-center justify-between mb-3 border-b border-primary/5 pb-2">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Преглед на съдържанието</p>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Само за четене</span>
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

                      {entry.targetType === 'archive' && snapshotData && (
                        <div className="space-y-4 border-t border-primary/10 pt-6">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-foreground">Свързан архив</h3>
                            <Badge variant="outline" className="text-[10px]">Архив</Badge>
                          </div>
                          <div className="grid gap-4">
                            <div className="rounded-2xl border border-primary/10 bg-muted/20 p-5">
                              <div className="flex items-center justify-between mb-3 border-b border-primary/5 pb-2">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Преглед на съдържанието</p>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Само за четене</span>
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

                  {isAddedCommentAction && snapshotData && (
                        <div className="space-y-4 border-t border-primary/10 pt-6">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-foreground">Добавен коментар</h3>
                              <p className="mt-1 text-sm font-medium text-muted-foreground">Коментарът е записан към съобщение в системата.</p>
                            </div>
                            <Badge className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/10">Коментар</Badge>
                          </div>

                          <div className="rounded-2xl border border-sky-500/15 bg-sky-500/5 p-5">
                            <div className="flex items-center justify-between mb-3 border-b border-sky-500/10 pb-2">
                              <p className="text-xs font-black uppercase tracking-widest text-sky-600">Съдържание на коментара</p>
                              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Само за четене</span>
                            </div>
                            <p className="text-sm font-medium text-foreground italic">"{snapshotData.content || 'Няма запазено съдържание.'}"</p>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <InfoBlock label="Автор на коментара" value={snapshotData.authorName || entry.performedByName || '—'} />
                            <InfoBlock label="Свързано съобщение" value={commentMessageTitle} />
                          </div>

                          {canOpenCommentMessage && (
                            <button
                              onClick={() => {
                                setSelectedAuditEntry(null);
                                navigate(`/messages/${snapshotData.messageId}`);
                              }}
                              className="block w-full text-left group/msg-link"
                            >
                              <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/10 bg-primary/5 hover:border-primary/30 transition-all">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                  <Mail size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Към съобщението</p>
                                  <p className="text-sm font-bold text-foreground truncate">{commentMessageTitle}</p>
                                </div>
                                <span className="text-xs font-black text-primary">Виж съобщението →</span>
                              </div>
                            </button>
                          )}
                        </div>
                      )}

                  {entry.targetType === 'comment' && snapshotData && !isAddedCommentAction && (
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

                      {!targetUser && entry.targetType === 'user' && snapshotData && (
                        <div className="space-y-4 border-t border-primary/10 pt-6">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-foreground">Свързан потребител (Изтрит)</h3>
                            <Badge variant="destructive" className="text-[10px]">Изтрит</Badge>
                          </div>
                          <div className="grid gap-4">
                            <div className="rounded-2xl border border-destructive/10 bg-destructive/5 p-5 opacity-80">
                              <div className="flex items-center justify-between mb-3 border-b border-destructive/5 pb-2">
                                <p className="text-xs font-black uppercase tracking-widest text-destructive/70">Преглед на профила</p>
                                <span className="text-[10px] font-black uppercase tracking-widest text-destructive">Недостъпен</span>
                              </div>
                              <h4 className="text-base font-black text-foreground mb-2">{snapshotData.firstName} {snapshotData.lastName}</h4>
                              <p className="text-sm font-medium text-muted-foreground">{snapshotData.email}</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <InfoBlock label="Роля" value={ROLE_LABELS[snapshotData.role] || snapshotData.role} />
                              <InfoBlock label="Училище" value={snapshotData.school} />
                            </div>
                          </div>
                        </div>
                      )}

                      {!targetClass && entry.targetType === 'class' && snapshotData && (
                        <div className="space-y-4 border-t border-primary/10 pt-6">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-foreground">Свързан клас (Изтрит)</h3>
                            <Badge variant="destructive" className="text-[10px]">Изтрит</Badge>
                          </div>
                          <div className="grid gap-4">
                            <div className="rounded-2xl border border-destructive/10 bg-destructive/5 p-5 opacity-80">
                              <div className="flex items-center justify-between mb-3 border-b border-destructive/5 pb-2">
                                <p className="text-xs font-black uppercase tracking-widest text-destructive/70">Детайли за класа</p>
                                <span className="text-[10px] font-black uppercase tracking-widest text-destructive">Недостъпен</span>
                              </div>
                              <h4 className="text-base font-black text-foreground mb-2">{snapshotData.name}</h4>
                              <p className="text-sm font-medium text-muted-foreground">{snapshotData.school}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {isDeleted && !isMessageEditAction && !isMessagePublishAction && !isMessageDeleteAction && !(snapshotData && (entry.targetType === 'message' || entry.targetType === 'comment' || entry.targetType === 'user' || entry.targetType === 'class' || entry.targetType === 'draft' || entry.targetType === 'archive')) && (
                        <div className="space-y-4 border-t border-primary/10 pt-6">
                          <h3 className="font-bold text-foreground">
                            {(() => {
                              const linkedLabels: Record<string, string> = { message: 'съобщение', user: 'потребител', comment: 'коментар', class: 'клас', setting: 'настройка', draft: 'чернова', archive: 'архив' };
                              return `Свързан ${linkedLabels[entry.targetType] || 'обект'}`;
                            })()}
                          </h3>
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                            <div className="flex items-center justify-between mb-3 border-b border-amber-500/10 pb-2">
                              <p className="text-xs font-black uppercase tracking-widest text-amber-600">
                                {(() => {
                                  const detailLabels: Record<string, string> = { message: 'съобщението', user: 'потребителя', comment: 'коментара', class: 'класа', setting: 'настройката', draft: 'черновата', archive: 'архива' };
                                  return `Детайли за ${detailLabels[entry.targetType] || 'обекта'}`;
                                })()}
                              </p>
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Недостъпно</span>
                            </div>
                            <p className="text-sm font-medium text-amber-600">
                              {(() => {
                                const typeName: Record<string, string> = { message: 'Съобщението', user: 'Потребителят', comment: 'Коментарът', class: 'Класът', setting: 'Настройката', draft: 'Черновата', archive: 'Архивът' };
                                const typeLabel = typeName[entry.targetType] || 'Обектът';
                                let objName = null;
                                if (snapshotData) {
                                  if ((entry.targetType === 'message' || entry.targetType === 'draft' || entry.targetType === 'archive') && snapshotData.title) objName = `„${snapshotData.title}“`;
                                  else if (entry.targetType === 'user' && (snapshotData.firstName || snapshotData.lastName)) {
                                    const name = `${snapshotData.firstName || ''} ${snapshotData.lastName || ''}`.trim();
                                    objName = `„${name}“`;
                                  }
                                  else if (entry.targetType === 'class' && snapshotData.name) objName = `„${snapshotData.name}“`;
                                  else if (entry.targetType === 'comment') {
                                    if (snapshotData.authorName && snapshotData.content) objName = `от ${snapshotData.authorName} („${snapshotData.content.length > 40 ? snapshotData.content.slice(0, 40) + '...' : snapshotData.content}“)`;
                                    else if (snapshotData.authorName) objName = `от ${snapshotData.authorName}`;
                                    else if (snapshotData.content) objName = `„${snapshotData.content.length > 40 ? snapshotData.content.slice(0, 40) + '...' : snapshotData.content}“`;
                                  }
                                }
                                if (!objName && entry.details) {
                                  const match = entry.details.match(/"([^"]+)"/);
                                  if (match) objName = `„${match[1]}“`;
                                }
                                const genderPhrase: Record<string, string> = { message: 'вероятно е било изтрито', user: 'вероятно е бил изтрит', comment: 'вероятно е бил изтрит', class: 'вероятно е бил изтрит', setting: 'вероятно е била изтрита', draft: 'вероятно е била изтрита', archive: 'вероятно е бил изтрит' };
                                if (objName) {
                                  return `${typeLabel} ${objName} вече не съществува в системата (${genderPhrase[entry.targetType] || 'вероятно е бил изтрит'}).`;
                                }
                                return `${typeLabel} (ID: ${entry.targetId}) вече не съществува в системата (${genderPhrase[entry.targetType] || 'вероятно е бил изтрит'}).`;
                              })()}
                            </p>
                          </div>
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
              })()}
            </DialogContent>
          </Dialog>

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

          {/* ═══════ TAB: НАСТРОЙКИ ═══════ */}
          <TabsContent value="settings" className="outline-none">
            <Card className="overflow-hidden rounded-[2.5rem] border-primary/5 bg-card shadow-xl">
              <CardHeader className="border-b border-primary/5 bg-gradient-to-r from-primary/5 to-transparent p-8">
                <CardTitle className="font-heading text-2xl font-black">Настройки и мониторинг</CardTitle>
                <p className="text-sm font-medium text-muted-foreground">Статистики и системен преглед за {user.school}</p>
              </CardHeader>
              <CardContent className="space-y-8 p-8">
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-foreground">
                    <BarChart3 className="h-5 w-5 text-primary" /> Обобщена статистика
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                    <StatCard label="Потребители" value={String(manageableUsers.length)} />
                    <StatCard label="Класове" value={String(schoolClasses.length)} />
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
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
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
    </>
  );
};



export default DirectorPanel;
