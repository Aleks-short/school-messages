import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/contexts/MessagesContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAuditLog } from '@/contexts/AuditLogContext';
import { ROLE_LABELS, CATEGORY_LABELS } from '@/types';
import {
  Mail, Send, FileText, PlusCircle, Archive, Bell, ArrowRight, History,
  Sparkles, MessageSquare, Clock, Lightbulb, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Trash2, X
} from 'lucide-react';
import MessageCard from '@/components/MessageCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { bg } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import ScrollToTop from '@/components/ScrollToTop';
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

const EDU_TIPS = [
  {
    title: "Табло за управление",
    text: "Вашето табло е организирано в интуитивна 'Bento Grid' структура, която Ви дава бърз преглед на всичко най-важно на един екран.",
    icon: Sparkles
  },
  {
    title: "Вашата активност",
    text: "Следете хронологията на Вашите действия в реално време – изпратени съобщения, коментари и взаимодействия са видими в долната секция.",
    icon: History
  },
  {
    title: "Важни съобщения",
    text: "Системата автоматично филтрира най-критичните съобщения. Те се появяват в таблото Ви 6 часа след публикуване, за да ви гарантират актуална информация.",
    icon: Bell
  },
  {
    title: "Бързо търсене",
    text: "Използвайте интелигентната търсачка в секция 'Съобщения', за да филтрирате по заглавие, категория или съдържание за броени секунди.",
    icon: FileText
  },
  {
    title: "Потвърждение",
    text: "Не забравяйте да използвате бутона 'Потвърди прочитане' за важните съобщения. Това е ключов начин да уведомите подателя, че сте запознати.",
    icon: Mail
  },
  {
    title: "Прикачени файлове",
    text: "Няма ограничение за броя на прикачените файлове към всяко съобщение. Поддържаме голямо разнообразие от формати с размер до 500 MB на файл.",
    icon: Archive
  },
  {
    title: "Лични чернови",
    text: "Ако не сте завършили съобщението си, то автоматично се запазва в секция 'Чернови', откъдето можете да го довършите по-късно.",
    icon: FileText
  },
  {
    title: "Нотификации",
    text: "Следете оранжевия индикатор в страничното меню. Той Ви сигнализира за нови събития, изискващи Вашето незабавно внимание.",
    icon: Bell
  },
  {
    title: "Персонализация",
    text: "Превключете към тъмна или светла тема за максимален комфорт при работа, независимо от времето на денонощието.",
    icon: Sparkles
  }
];

const ACTIVITY_PAGE_SIZE = 4;

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { messages, getVisibleMessages, getUserSentMessages, getUserArchivedMessages, getUserDrafts, isRead, isConfirmed, deleteMessages, deleteComment, refreshMessages } = useMessages();
  const { unreadCount } = useNotifications();
  const { addEntry } = useAuditLog();

  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const [fadeTip, setFadeTip] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const tipIndexRef = useRef(0);
  const [activityPage, setActivityPage] = useState(() => {
    const saved = localStorage.getItem('dashboard_activity_page');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    localStorage.setItem('dashboard_activity_page', activityPage.toString());
  }, [activityPage]);

  const visible = getVisibleMessages();
  const published = visible.filter(m => m.status === 'published');

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000); // Refresh every 30s for better accuracy
    return () => clearInterval(timer);
  }, []);

  // Important messages: (Not confirmed AND High importance AND > 2 mins old) AND NOT sent by current user
  const importantMessages = useMemo(() => {
    return published
      .filter(m => {
        // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" which JS interprets as local time.
        // We append 'Z' and replace space with 'T' to ensure UTC interpretation.
        const publishTime = new Date(m.createdAt).getTime();
        const sixHours = 6 * 60 * 60 * 1000;
        const reachedReminderTime = now.getTime() - publishTime >= sixHours;

        return !isConfirmed(m.id) &&
          m.importance === 'high' &&
          m.authorId !== user?.id &&
          reachedReminderTime
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [published, isConfirmed, user?.id, now]);

  const archivedCount = getUserArchivedMessages().length;
  const drafts = getUserDrafts();
  const draftsCount = drafts.length;

  // Tip navigation
  const changeTip = useCallback((newIndex: number) => {
    setFadeTip(false);
    setTimeout(() => {
      tipIndexRef.current = newIndex;
      setActiveTipIndex(newIndex);
      setFadeTip(true);
    }, 400);
  }, []);

  const prevTip = useCallback(() => {
    const newIdx = (tipIndexRef.current - 1 + EDU_TIPS.length) % EDU_TIPS.length;
    changeTip(newIdx);
  }, [changeTip]);

  const nextTip = useCallback(() => {
    const newIdx = (tipIndexRef.current + 1) % EDU_TIPS.length;
    changeTip(newIdx);
  }, [changeTip]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      setFadeTip(false);
      setTimeout(() => {
        const next = (tipIndexRef.current + 1) % EDU_TIPS.length;
        tipIndexRef.current = next;
        setActiveTipIndex(next);
        setFadeTip(true);
      }, 500);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Combined Activity: Sent messages + Comments
  const allActivities = useMemo(() => {
    const list: Array<{ type: 'sent' | 'comment', date: string, data: any }> = [];
    const sent = getUserSentMessages();

    sent.forEach(m => {
      list.push({ type: 'sent', date: m.createdAt, data: m });
    });

    messages.forEach(m => {
      m.comments.forEach(c => {
        if (c.authorId === user?.id) {
          list.push({ type: 'comment', date: c.createdAt, data: { ...c, messageTitle: m.title } });
        }
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [getUserSentMessages, messages, user?.id]);

  // Activity stats
  const sentCount = allActivities.filter(a => a.type === 'sent').length;
  const commentCount = allActivities.filter(a => a.type === 'comment').length;

  const activitySpanDays = useMemo(() => {
    if (allActivities.length === 0) return 0;
    const oldest = new Date(allActivities[allActivities.length - 1].date);
    return differenceInDays(new Date(), oldest);
  }, [allActivities]);

  const visibleActivities = allActivities.slice(0, activityPage * ACTIVITY_PAGE_SIZE);
  const hasMoreActivities = visibleActivities.length < allActivities.length;

  const handleSelectActivity = (id: string) => {
    setSelectedActivityIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllActivities = (checked: boolean) => {
    if (checked) {
      setSelectedActivityIds(visibleActivities.map(a => `${a.type}-${a.data.id}`));
    } else {
      setSelectedActivityIds([]);
    }
  };

  const handleBulkActivityDelete = async () => {
    if (selectedActivityIds.length === 0) return;
    setIsDeleting(true);
    try {
      const messageIdsToDelete: string[] = [];
      const commentIdsToDelete: string[] = [];

      selectedActivityIds.forEach(id => {
        const [type, actualId] = id.split('-');
        if (type === 'sent') messageIdsToDelete.push(actualId);
        else if (type === 'comment') commentIdsToDelete.push(actualId);
      });

      if (messageIdsToDelete.length > 0) {
        messageIdsToDelete.forEach(mid => {
          const msg = messages.find(m => m.id === mid);
          if (msg) {
            addEntry({
              action: 'Изтриване на съобщение',
              performedBy: user!.id,
              performedByName: `${user!.firstName} ${user!.lastName}`,
              performedBySchool: user!.school,
              targetType: 'message',
              targetId: mid,
              details: `Изтрито от таблото: "${msg.title}"`,
              targetData: JSON.stringify({ ...msg, comments: [] })
            });
          }
        });
        await deleteMessages(messageIdsToDelete);
      }

      if (commentIdsToDelete.length > 0) {
        for (const cid of commentIdsToDelete) {
          // Find comment in all messages
          let foundComment = null;
          for (const m of messages) {
            const c = m.comments?.find(cc => cc.id === cid);
            if (c) {
              foundComment = c;
              break;
            }
          }
          
          if (foundComment) {
            addEntry({
              action: 'Изтриване на коментар',
              performedBy: user!.id,
              performedByName: `${user!.firstName} ${user!.lastName}`,
              performedBySchool: user!.school,
              targetType: 'comment',
              targetId: cid,
              details: `Изтрит коментар от таблото`,
              targetData: JSON.stringify(foundComment)
            });
          }
          await deleteComment(cid);
        }
      }

      toast.success('Избраните активности бяха изтрити');
      setSelectedActivityIds([]);
      await refreshMessages();
    } catch (e) {
      toast.error('Грешка при изтриването');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper function to safely strip HTML and get a text preview
  const getContentPreview = (content: string) => {
    if (!content) return 'Няма съдържание';
    return content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim();
  };

  return (
    <div className={`space-y-6 animate-in fade-in duration-1000 transition-all duration-500 ${selectedActivityIds.length > 0 ? 'pb-32' : ''}`}>
      {/* Bento Grid Header / Banner */}
      <div className="overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary via-primary/95 to-accent p-8 md:p-12 text-white shadow-2xl relative group">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/25 text-xs font-bold uppercase tracking-[0.2em] mb-2 transform group-hover:translate-x-1 transition-transform">
              <Sparkles className="h-4 w-4" />
              Добре дошли отново
            </div>
            <h1 className="text-4xl md:text-6xl font-black font-heading tracking-tight leading-none mb-2">
              Здравейте, {user?.firstName}{user?.lastName ? ` ${user.lastName}` : ''}!
            </h1>
            <p className="text-white/80 font-medium text-lg md:text-xl max-w-2xl leading-relaxed">
              {user ? ROLE_LABELS[user.role] : ''}{user?.role !== 'admin' && user?.school ? ` ${(user.school.trim().toLowerCase().startsWith('в') || user.school.trim().toLowerCase().startsWith('ф')) ? 'във' : 'в'} ${user.school}` : ''}. Радваме се да Ви видим отново.
            </p>
          </div>
          <div className="flex flex-shrink-0 self-end md:self-center">
            <Link to="/create">
              <Button size="lg" className="bg-white dark:bg-slate-900 dark:text-white dark:border dark:border-white/10 text-primary hover:bg-white/90 dark:hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all font-black px-10 h-16 rounded-[1.5rem] shadow-2xl flex items-center gap-3 text-lg">
                <PlusCircle className="h-7 w-7" />
                Ново съобщение
              </Button>
            </Link>
          </div>
        </div>
        {/* Abstract background graphics */}
        <div className="absolute -top-12 -right-12 h-64 w-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 h-32 w-1/2 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-12 h-48 w-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bento Tile: Important Messages */}
        <div className="md:col-span-2 md:row-span-2 p-8 rounded-[2rem] border bg-card shadow-lg border-primary/5 flex flex-col hover:border-primary/20 transition-colors duration-500 relative group">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-importance-high/10 text-importance-high transform group-hover:rotate-6 transition-transform">
                <Mail className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black font-heading flex items-center gap-3">
                  Важни съобщения
                  {importantMessages.length > 0 && (
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-importance-high text-white text-sm font-black shadow-lg shadow-importance-high/30">
                      {importantMessages.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider decoration-primary/30 decoration-2">Показват се само непотвърдени съобщения, публикувани преди поне 6 часа!</p>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[520px] pr-2 p-1 relative z-10 space-y-4 custom-scrollbar">
            {importantMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                <div className="p-6 rounded-full bg-success/5 text-success mb-6 border border-success/10">
                  <Sparkles className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold mb-2">Всичко е прочетено!</h3>
                <p className="text-muted-foreground max-w-sm text-sm">В момента няма нови съобщения с голяма важност за Вашето внимание.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {importantMessages.map(m => (
                  <MessageCard key={m.id} message={m} isRead={isRead(m.id)} />
                ))}
              </div>
            )}
          </div>

          <Link
            to="/messages"
            className="mt-8 flex items-center justify-center gap-2 p-4 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors font-bold text-sm text-primary group/link"
          >
            Към всички съобщения <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Bento Tile: Quick Access */}
        <div className="md:col-span-1 p-8 rounded-[2rem] border bg-gradient-to-br from-secondary/40 to-card shadow-lg border-primary/5 hover:border-primary/20 transition-colors duration-500 overflow-hidden relative group">
          <h3 className="text-xl font-black font-heading mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Бърз достъп
          </h3>
          <div className="space-y-3 relative z-10">
            {[
              { label: 'Чернови', to: '/drafts', icon: FileText, count: draftsCount, color: 'text-yellow-500' },
              { label: 'Личен архив', to: '/archived', icon: Archive, count: archivedCount, color: 'text-purple-500' },
              { label: 'Нотификации', to: '/notifications', icon: Bell, count: unreadCount, color: 'text-red-500' },
            ].map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-card/40 hover:bg-card dark:hover:bg-card/60 transition-colors border border-transparent hover:border-primary/10 shadow-sm group/item"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-muted/50 ${link.color} group-hover/item:rotate-12 transition-transform`}>
                    <link.icon className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-sm">{link.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {link.count !== undefined && link.count > 0 && (
                    <Badge className="bg-primary text-white border-none font-black text-xs h-6 min-w-[1.5rem] px-1.5 flex items-center justify-center rounded-full shadow-md shadow-primary/20">
                      {link.count}
                    </Badge>
                  )}
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0 -translate-x-2 transition-all text-primary" />
                </div>
              </Link>
            ))}
          </div>
          {/* Background decoration */}
          <div className="absolute -top-4 -right-4 h-24 w-24 bg-primary/5 rounded-full blur-xl" />
        </div>

        {/* Bento Tile: Edu Tip */}
        <div
          className="md:col-span-1 p-8 rounded-[2rem] border bg-accent/5 dark:bg-accent/10 shadow-lg border-accent/20 hover:border-accent/40 transition-colors duration-500 overflow-hidden relative group min-h-[300px] flex flex-col"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className={`relative z-10 flex flex-col flex-1 transition-all duration-700 ease-in-out ${fadeTip ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}>
            <div className="p-4 rounded-[1.25rem] bg-white dark:bg-slate-800 shadow-xl shadow-accent/10 dark:shadow-accent/5 w-fit mb-6 transform group-hover:-rotate-3 transition-transform">
              {React.createElement(EDU_TIPS[activeTipIndex].icon, { className: "h-8 w-8 text-accent" })}
            </div>
            <h4 className="font-black text-xl mb-3 font-heading tracking-tight leading-tight text-foreground">Училищни съобщения Съвет</h4>
            <div className="text-[10px] font-black text-accent/80 dark:text-accent uppercase tracking-[0.2em] mb-2">{EDU_TIPS[activeTipIndex].title}</div>
            <p className="text-sm text-muted-foreground dark:text-slate-300 leading-relaxed font-medium flex-1">
              {EDU_TIPS[activeTipIndex].text}
            </p>
          </div>

          {/* Navigation row: prev/next buttons + dots */}
          <div className="flex items-center justify-between mt-auto pt-6 relative z-10 gap-2">
            <button
              onClick={prevTip}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 border border-accent/20 hover:border-accent/50 shadow-sm transition-all hover:scale-110 active:scale-95 text-accent"
              aria-label="Предишен съвет"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5">
              {EDU_TIPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => changeTip(idx)}
                  className={`h-1.5 transition-all duration-500 rounded-full ${activeTipIndex === idx
                    ? 'w-6 bg-accent shadow-sm shadow-accent/50'
                    : 'w-1.5 bg-accent/20 hover:bg-accent/40'
                    }`}
                  aria-label={`Съвет ${idx + 1}`}
                />
              ))}
            </div>
            <button
              onClick={nextTip}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 border border-accent/20 hover:border-accent/50 shadow-sm transition-all hover:scale-110 active:scale-95 text-accent"
              aria-label="Следващ съвет"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Background graphical element */}
          <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-accent/10 rounded-full blur-xl" />
        </div>

        {/* Bento Tile: Recent Activity */}
        <div className="md:col-span-3 p-8 rounded-[2rem] border bg-card shadow-lg hover:border-primary/10 transition-colors duration-500 relative group">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-primary/10 text-primary transform group-hover:-rotate-6 transition-transform">
                <History className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black font-heading">Вашата активност</h2>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider underline decoration-primary/30 decoration-2 underline-offset-4">
                  Хронология на вашите действия
                </p>
              </div>
            </div>
            {/* Activity summary stats */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {allActivities.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-xl shadow-sm border border-primary/5">
                  <Checkbox 
                    id="select-all-activities" 
                    checked={selectedActivityIds.length === visibleActivities.length && visibleActivities.length > 0} 
                    onCheckedChange={handleSelectAllActivities}
                    className="rounded-md border-primary/30"
                  />
                  <label htmlFor="select-all-activities" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none cursor-pointer">Избери всички</label>
                </div>
              )}
              {allActivities.length > 0 && (
                <>
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/8 border border-success/10 text-xs font-bold text-success">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>{commentCount} {commentCount === 1 ? 'коментар' : 'коментара'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/8 border border-primary/10 text-xs font-bold text-primary">
                      <Send className="h-3.5 w-3.5" />
                      <span>{sentCount} {sentCount === 1 ? 'изпратено съобщение' : 'изпратени съобщения'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            {allActivities.length === 0 ? (
              <div className="col-span-full py-10 text-center text-muted-foreground font-medium italic">
                Все още нямате регистрирана активност. Започнете да комуникирате сега!
              </div>
            ) : (
              visibleActivities.map((item, idx) => {
                const activityId = `${item.type}-${item.data.id}`;
                const isSelected = selectedActivityIds.includes(activityId);
                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border transition-all duration-300 group/item flex flex-col justify-between relative ${
                      isSelected 
                        ? 'bg-primary/5 border-primary/20 shadow-lg' 
                        : 'bg-white/50 dark:bg-card/40 hover:bg-white dark:hover:bg-card/60 hover:shadow-xl'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="relative group/tooltip flex items-center">
                          <div 
                            className={`p-2 rounded-lg cursor-help transition-all ${
                            item.type === 'sent' 
                              ? (item.data.category === 'system' ? 'bg-red-500/10 text-red-500' :
                                 item.data.category === 'administrative' ? 'bg-blue-500/10 text-blue-500' :
                                 item.data.category === 'academic' ? 'bg-green-500/10 text-green-600' :
                                 item.data.category === 'personal' ? 'bg-purple-500/10 text-purple-600' :
                                 'bg-primary/10 text-primary')
                              : 'bg-success/10 text-success'
                          }`}>
                            {item.type === 'sent' ? <Send className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                          </div>
                        </div>
                        <div className="text-[9px] font-black tracking-tighter text-muted-foreground uppercase flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.date), 'd MMM, HH:mm', { locale: bg })}
                        </div>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">
                        {item.type === 'sent' ? 'Изпратено' : 'Коментирано'}
                      </div>
                      <div className="font-bold text-sm leading-tight mb-2 truncate w-full" title={item.type === 'sent' ? item.data.title : item.data.messageTitle}>
                        {item.type === 'sent' ? item.data.title : item.data.messageTitle}
                      </div>
                      {item.type === 'sent' ? (
                        <p className="text-[11px] text-muted-foreground truncate w-full leading-relaxed border-l-2 border-primary/10 pl-2 mb-3" title={getContentPreview(item.data.content)}>
                          {getContentPreview(item.data.content)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic truncate w-full leading-relaxed border-l-2 border-success/20 pl-2 mb-3" title={getContentPreview(item.data.content)}>
                          "{getContentPreview(item.data.content)}"
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4 mt-auto pt-2">
                      <Link
                        to={`/messages/${item.type === 'sent' ? item.data.id : item.data.messageId}`}
                        className="flex items-center gap-1 text-[10px] font-extrabold text-primary hover:text-primary/70 transition-colors uppercase tracking-widest"
                      >
                        Преглед <ArrowRight className="h-3 w-3 group-hover/item:translate-x-1 transition-transform" />
                      </Link>
                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <Checkbox 
                          checked={isSelected} 
                          onCheckedChange={() => handleSelectActivity(activityId)}
                          className="h-6 w-6 rounded-lg border-2 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-xl bg-card/80 backdrop-blur-sm transition-transform hover:scale-110 active:scale-90"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Show More / Show Less for activity */}
          {allActivities.length > 0 && (
            <div className="mt-6 flex justify-center gap-3">
              {hasMoreActivities && (
                <button
                  onClick={() => setActivityPage(p => p + 1)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl border border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-all font-bold text-sm group/more"
                >
                  <ChevronDown className="h-4 w-4 group-hover/more:translate-y-0.5 transition-transform" />
                  Още ({allActivities.length - visibleActivities.length})
                </button>
              )}
              {activityPage > 1 && (
                <button
                  onClick={() => setActivityPage(1)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl border border-dashed border-muted-foreground/20 text-muted-foreground hover:bg-muted/30 transition-all font-bold text-sm"
                >
                  <ChevronUp className="h-4 w-4" />
                  Скрий
                </button>
              )}
            </div>
          )}

          {/* Background decorative path */}
          <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Floating Action Bar for Activity */}
      {selectedActivityIds.length > 0 && (
        <div className="fixed bottom-8 inset-x-0 md:pl-64 flex justify-center z-50 pointer-events-none px-4">
          <div className="w-full max-w-2xl pointer-events-auto animate-in slide-in-from-bottom-10 duration-500">
            <Card className="rounded-[2rem] bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 pl-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                    <span className="text-lg font-black">{selectedActivityIds.length}</span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-white font-black text-sm leading-tight">Избрани активности</p>
                    <button 
                      onClick={() => setSelectedActivityIds([])}
                      className="text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white transition-colors flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Отказ
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive"
                        className="rounded-2xl font-black h-12 px-8 flex items-center gap-2 shadow-xl shadow-destructive/20 transition-all active:scale-95"
                      >
                        <Trash2 className="h-5 w-5" />
                        Изтрий избраните
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] border-primary/10 md:left-[calc(50%+128px)]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-heading font-black text-2xl">Изтриване на {selectedActivityIds.length} активности</AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-medium">
                          Сигурни ли сте? Това действие ще изтрие окончателно съответните съобщения или коментари.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-2xl h-12 font-bold px-6">Отказ</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleBulkActivityDelete}
                          className="rounded-2xl h-12 font-black px-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Да, изтрий ги
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
      <ScrollToTop />
    </div>
  );
};

export default Dashboard;
