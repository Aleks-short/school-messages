import React, { useMemo, useState, useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Bell, BellOff, Mail, Edit, AlertTriangle, CheckCheck,
  ArrowUpDown, MessageSquare, Settings, Sliders, Save, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
import { NotificationSettings } from '@/types';
import { toast } from 'sonner';
import { Trash2, X } from 'lucide-react';

import ScrollToTop from '@/components/ScrollToTop';

const Notifications: React.FC = () => {
  const { 
    getUserNotifications, markAsRead, markAllAsRead, markMultipleAsRead, 
    deleteNotification, deleteNotifications, unreadCount, getSettings, updateSettings 
  } = useNotifications();
  const notifications = getUserNotifications();
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, [getSettings]);

  const sorted = useMemo(() => {
    let result = [...notifications];
    
    // Apply read filter
    if (readFilter === 'unread') result = result.filter(n => !n.read);
    else if (readFilter === 'read') result = result.filter(n => n.read);

    return result.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? db - da : da - db;
    });
  }, [notifications, sortOrder, readFilter]);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'new_message': return <Mail className="h-4 w-4 text-primary" />;
      case 'edited_message': return <Edit className="h-4 w-4 text-accent" />;
      case 'new_comment': return <MessageSquare className="h-4 w-4 text-success" />;
      case 'reminder': return <AlertTriangle className="h-4 w-4 text-importance-high" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const handleToggleSetting = (key: keyof Omit<NotificationSettings, 'userId'>) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);

    // Auto-save setting
    setIsSaving(true);
    updateSettings(newSettings)
      .then(() => toast.success('Настройките са обновени'))
      .catch(() => toast.error('Грешка при запис'))
      .finally(() => setIsSaving(false));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(sorted.map(n => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkMarkRead = async () => {
    if (selectedIds.length === 0) return;
    setIsActionInProgress(true);
    try {
      await markMultipleAsRead(selectedIds);
      toast.success(`${selectedIds.length} уведомления са отбелязани като прочетени`);
      setSelectedIds([]);
    } catch (e) {
      toast.error('Грешка при операцията');
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsActionInProgress(true);
    try {
      await deleteNotifications(selectedIds);
      toast.success(`${selectedIds.length} уведомления са изтрити`);
      setSelectedIds([]);
    } catch (e) {
      toast.error('Грешка при изтриването');
    } finally {
      setIsActionInProgress(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight flex items-center gap-2">
            Уведомления
            <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full text-sm font-bold bg-primary text-primary-foreground shadow-md shadow-primary/30 tabular-nums">
              {sorted.length}
            </span>
          </h1>
          <p className="text-muted-foreground font-medium">Управлявайте вашите известия и настройки</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showSettings ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-xl font-bold gap-2"
          >
            <Settings className={`h-4 w-4 ${showSettings ? 'animate-spin-slow' : ''}`} />
            Настройки
          </Button>
          {notifications.length > 0 && unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="rounded-xl font-bold gap-2">
              <CheckCheck className="h-4 w-4" /> Прочети всички
            </Button>
          )}
        </div>
      </div>

      {showSettings && (
        <Card className="border-primary/10 bg-gradient-to-br from-card to-secondary/30 rounded-[2rem] overflow-hidden animate-in zoom-in-95 duration-300 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-heading font-black">Предпочитания за известия</CardTitle>
                <CardDescription className="font-medium mt-1">Изберете за какви събития искате да получавате системни уведомления</CardDescription>
              </div>
              {isSaving && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-8">
            {[
              { id: 'newMessage', label: 'Нови съобщения', desc: 'При публикуване на ново съобщение за вашата аудитория', key: 'newMessage', icon: Mail, color: 'text-primary' },
              { id: 'newComment', label: 'Коментари', desc: 'При нов коментар под ваше съобщение или отговор на ваш коментар', key: 'newComment', icon: MessageSquare, color: 'text-success' },
              { id: 'edited_message', label: 'Редактирани съобщения', desc: 'При промяна на съдържанието на вече публикувано съобщение', key: 'editedMessage', icon: Edit, color: 'text-accent' },
              { id: 'reminder', label: 'Напомняния', desc: 'За важни съобщения, които все още не сте потвърдили', key: 'reminder', icon: AlertTriangle, color: 'text-importance-high' },
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-transparent hover:border-primary/10 transition-all group min-h-[90px]">
                <div className="flex gap-4">
                  <div className={`mt-0.5 p-2 rounded-xl bg-card border ${item.color} group-hover:scale-110 transition-transform shrink-0 h-fit`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <Label htmlFor={item.id} className="font-black text-sm cursor-pointer">{item.label}</Label>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 max-w-[210px]">{item.desc}</p>
                  </div>
                </div>
                <Switch
                  id={item.id}
                  checked={settings ? (!!(settings[item.key as keyof NotificationSettings] ?? settings[item.id as keyof NotificationSettings])) : true}
                  onCheckedChange={() => handleToggleSetting(item.key as any || item.id as any)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {notifications.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-xl shadow-sm border border-primary/5">
              <Checkbox 
                id="select-all" 
                checked={selectedIds.length === sorted.length && sorted.length > 0} 
                onCheckedChange={handleSelectAll}
                className="rounded-md border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <label htmlFor="select-all" className="text-xs font-black text-muted-foreground uppercase tracking-widest leading-none cursor-pointer">Избери всички</label>
            </div>
            
            <div className="h-6 w-px bg-primary/10 hidden sm:block" />
            
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest leading-none">Филтри</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-2">
            {/* Status Filter */}
            <Select value={readFilter} onValueChange={(value: 'all' | 'read' | 'unread') => setReadFilter(value)}>
              <SelectTrigger className="h-9 w-full sm:w-[160px] rounded-xl font-bold text-xs border-none bg-card hover:bg-secondary transition-colors shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10">
                <SelectItem value="all" className="font-bold text-xs py-2.5">Всички статуси</SelectItem>
                <SelectItem value="read" className="font-bold text-xs py-2.5">Прочетени</SelectItem>
                <SelectItem value="unread" className="font-bold text-xs py-2.5">Непрочетени</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Sort */}
            <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
              <SelectTrigger className="h-9 w-full sm:w-[200px] rounded-xl font-bold text-xs border-none bg-card hover:bg-secondary transition-colors shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10">
                <SelectItem value="newest" className="font-bold text-xs py-2.5">Най-нови уведомления</SelectItem>
                <SelectItem value="oldest" className="font-bold text-xs py-2.5">Най-стари уведомления</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <Card className="rounded-[2.5rem] border-dashed border-2 bg-transparent">
          <CardContent className="p-16 text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl" />
              <BellOff className="h-16 w-16 mx-auto opacity-30 relative z-10" />
            </div>
            <h3 className="text-xl font-bold mb-2">Нямате нови уведомления</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">Тук ще виждате всички важни новини и коментари, свързани с Вашата училищна дейност.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map(n => (
            <Link
              key={n.id}
              to={`/messages/${n.messageId}`}
              onClick={() => markAsRead(n.id)}
              className={`flex items-center p-5 rounded-[1.75rem] border transition-all duration-300 hover:scale-[1.01] hover:shadow-xl active:scale-95 ${
                selectedIds.includes(n.id)
                  ? 'bg-primary/5 border-primary/20 shadow-lg'
                  : !n.read
                    ? 'bg-card border-primary/10 shadow-md ring-1 ring-primary/5'
                    : 'bg-card/40 border-transparent text-muted-foreground grayscale-[0.3]'
              }`}
            >
              <div className="flex items-center gap-5 w-full">
                <div className="shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <Checkbox 
                    checked={selectedIds.includes(n.id)} 
                    onCheckedChange={() => toggleSelect(n.id)}
                    className="h-6 w-6 rounded-lg border-2 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-sm"
                  />
                </div>
                <div className={`shrink-0 p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-transparent transition-transform ${!n.read ? 'border-primary/5' : ''}`}>
                  {typeIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <p className={`text-sm leading-snug ${!n.read ? 'font-black text-foreground' : 'font-bold'} ${selectedIds.includes(n.id) ? 'opacity-80' : ''}`}>
                      {n.text}
                    </p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-lg whitespace-nowrap">
                      {format(new Date(n.createdAt), 'd MMM, HH:mm', { locale: bg })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-muted-foreground/80 truncate flex-1">{n.messageTitle}</p>
                    {!n.read && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-[9px] font-black uppercase tracking-tighter">Ново</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 inset-x-0 md:pl-64 flex justify-center z-50 pointer-events-none px-4">
          <div className="w-full max-w-2xl pointer-events-auto animate-in slide-in-from-bottom-10 duration-500">
            <Card className="rounded-[2rem] bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 pl-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                    <span className="text-lg font-black">{selectedIds.length}</span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-white font-black text-sm leading-tight">Избрани уведомления</p>
                    <button 
                      onClick={() => setSelectedIds([])}
                      className="text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white transition-colors flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Отказ
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleBulkMarkRead}
                    className="rounded-2xl bg-white text-slate-900 hover:bg-white/90 font-black h-12 px-6 flex items-center gap-2 shadow-xl shadow-white/5 transition-all active:scale-95"
                  >
                    <CheckCheck className="h-5 w-5" />
                    <span className="hidden sm:inline">Прочети избраните</span>
                    <span className="sm:hidden">Прочети</span>
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive"
                        className="rounded-2xl font-black h-12 px-6 flex items-center gap-2 shadow-xl shadow-destructive/20 transition-all active:scale-95"
                      >
                        <Trash2 className="h-5 w-5" />
                        <span className="hidden sm:inline">Изтрий избраните</span>
                        <span className="sm:hidden">Изтрий</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] border-primary/10 md:left-[calc(50%+128px)]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-heading font-black text-2xl">Изтриване на {selectedIds.length} уведомления</AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-medium">
                          Сигурни ли сте? Това действие ще премахне избраните известия от вашия списък.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-2xl h-12 font-bold px-6">Отказ</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleBulkDelete}
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

export default Notifications;
