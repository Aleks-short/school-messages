import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMessages } from '@/contexts/MessagesContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_LABELS, IMPORTANCE_LABELS, MessageCategory, MessageImportance } from '@/types';
import { metadataApi } from '@/lib/api';
import { RotateCcw, Search, Sliders, SortAsc, SortDesc, CheckCircle2 } from 'lucide-react';
import ScrollToTop from '@/components/ScrollToTop';
import { Button } from '@/components/ui/button';
import MessageCard from '@/components/MessageCard';
import { CheckCheck } from 'lucide-react';

const DEFAULT_CATEGORY = 'all';
const DEFAULT_IMPORTANCE = 'all';
const DEFAULT_READ = 'all';
const DEFAULT_SORT = 'desc';

const Messages: React.FC = () => {
  const { getVisibleMessages, isRead, markAllAsRead } = useMessages();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [importanceFilter, setImportanceFilter] = useState<string>(DEFAULT_IMPORTANCE);
  const [readFilter, setReadFilter] = useState<string>(DEFAULT_READ);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>(DEFAULT_SORT);
  const [markingAll, setMarkingAll] = useState(false);

  const visible = getVisibleMessages();
  const { data: categoryOptions = [] } = useQuery({
    queryKey: ['messageCategories'],
    queryFn: () => metadataApi.getCategories(),
  });

  // ── Per-category counts (from ALL visible messages, not filtered) ──
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of visible) {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    }
    return counts;
  }, [visible]);

  // ── Per-importance counts ──
  const importanceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of visible) {
      counts[m.importance] = (counts[m.importance] ?? 0) + 1;
    }
    return counts;
  }, [visible]);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    let result = [...visible];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)
      );
    }
    if (category !== 'all') result = result.filter(m => m.category === category);
    if (importanceFilter !== 'all') result = result.filter(m => m.importance === importanceFilter);
    if (readFilter === 'unread') result = result.filter(m => !isRead(m.id));
    else if (readFilter === 'read') result = result.filter(m => isRead(m.id));

    result.sort((a, b) => {
      // 1. Grouping: High priority is 0, others are 1
      const pa = a.importance === 'high' ? 0 : 1;
      const pb = b.importance === 'high' ? 0 : 1;

      if (pa !== pb) return pa - pb;

      const getLatestTime = (m: any) => {
        const cRow = m.createdAt || '0';
        const uRow = m.updatedAt || '0';
        const c = new Date(cRow).getTime();
        const u = new Date(uRow).getTime();
        return Math.max(isNaN(c) ? 0 : c, isNaN(u) ? 0 : u);
      };

      const ta = getLatestTime(a);
      const tb = getLatestTime(b);

      return sortDir === 'desc' ? tb - ta : ta - tb;
    });

    return result;
  }, [visible, search, category, importanceFilter, readFilter, sortDir, isRead]);

  const unreadCount = useMemo(() => visible.filter(m => !isRead(m.id)).length, [visible, isRead]);
  const readCount   = useMemo(() => visible.filter(m =>  isRead(m.id)).length, [visible, isRead]);

  const hasActiveFilters =
    search.trim() !== '' ||
    category !== DEFAULT_CATEGORY ||
    importanceFilter !== DEFAULT_IMPORTANCE ||
    readFilter !== DEFAULT_READ ||
    sortDir !== DEFAULT_SORT;

  const resetFilters = useCallback(() => {
    setSearch('');
    setCategory(DEFAULT_CATEGORY);
    setImportanceFilter(DEFAULT_IMPORTANCE);
    setReadFilter(DEFAULT_READ);
    setSortDir(DEFAULT_SORT);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = visible
      .filter(m => !isRead(m.id) && m.status === 'published')
      .map(m => m.id);
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    await markAllAsRead(unreadIds);
    setMarkingAll(false);
  }, [visible, isRead, markAllAsRead]);

  // Helper: small count pill
  const CountPill = ({ n, color = 'muted' }: { n: number; color?: string }) =>
    n > 0 ? (
      <span className={`ml-auto rounded-full px-1.5 text-[10px] font-bold ${color}`}>{n}</span>
    ) : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight flex items-center gap-2">
            Съобщения
            <span
              className={`
                inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2
                rounded-full text-sm font-bold tabular-nums transition-all duration-300
                bg-primary text-primary-foreground shadow-md shadow-primary/30
              `}
            >
              {filtered.length}
            </span>
          </h1>
          <p className="text-muted-foreground font-medium">Прегледайте и филтрирайте всички важни новини</p>
        </div>

        {/* Mark all as read */}
        <Button
          variant="outline"
          size="sm"
          className={`
            gap-2 rounded-xl h-10 px-4 font-semibold text-xs
            border-primary/20 hover:bg-primary/10 hover:border-primary/40
            transition-all duration-200
            ${unreadCount === 0 ? 'opacity-40 pointer-events-none' : ''}
          `}
          onClick={handleMarkAllRead}
          disabled={markingAll || unreadCount === 0}
          title={unreadCount === 0 ? 'Всички съобщения са прочетени' : `Маркирай ${unreadCount} непрочетени като прочетени`}
        >
          <CheckCheck className={`h-4 w-4 ${markingAll ? 'animate-pulse' : ''}`} />
          Маркирай всички като прочетени
          {unreadCount > 0 && (
            <span className="bg-primary/15 text-primary rounded-full px-1.5 py-0 text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-col gap-3 bg-card/50 p-4 rounded-[2rem] border border-primary/5 shadow-sm">

        {/* Row 1: Search input (full width) + reset button on the right */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Търсене по заглавие или ключова дума..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 bg-background/50 border-none rounded-xl font-medium focus-visible:ring-primary/20 shadow-inner"
            />
          </div>

          {/* Reset — top right, always visible */}
          <Button
            variant="ghost"
            size="icon"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className={`
              h-11 w-11 rounded-xl bg-background/50 shrink-0
              hover:bg-destructive/10 hover:text-destructive
              text-muted-foreground transition-all duration-200
              ${hasActiveFilters ? 'opacity-100' : 'opacity-25 pointer-events-none'}
            `}
            title="Нулирай всички филтри"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Row 2: Dropdowns + sort */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Category */}
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="flex-1 min-w-[150px] h-10 rounded-xl font-bold text-xs border-none bg-background/50 hover:bg-secondary transition-colors">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-primary/10">
              <SelectItem value="all" className="font-bold text-xs py-2.5">
                <span className="flex items-center gap-2 w-full">
                  Всички категории
                  <CountPill n={visible.length} color="bg-muted text-muted-foreground" />
                </span>
              </SelectItem>
              {categoryOptions.map(({ id, key, label }) => (
                <SelectItem key={id} value={key} className="font-bold text-xs py-2.5">
                  <span className="flex items-center gap-2 w-full">
                    {label || CATEGORY_LABELS[key] || key}
                    <CountPill n={categoryCounts[key] ?? 0} color="bg-primary/10 text-primary" />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Importance */}
          <Select value={importanceFilter} onValueChange={setImportanceFilter}>
            <SelectTrigger className="flex-1 min-w-[150px] h-10 rounded-xl font-bold text-xs border-none bg-background/50 hover:bg-secondary transition-colors">
              <SelectValue placeholder="Важност" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-primary/10">
              <SelectItem value="all" className="font-bold text-xs py-2.5">
                <span className="flex items-center gap-2 w-full">
                  Всички по важност
                  <CountPill n={visible.length} color="bg-muted text-muted-foreground" />
                </span>
              </SelectItem>
              {(Object.entries(IMPORTANCE_LABELS) as [MessageImportance, string][]).map(([k, v]) => {
                const importancePillColors: Record<string, string> = {
                  high:   'bg-importance-high/15 text-importance-high',
                  normal: 'bg-primary/10 text-primary',
                  low:    'bg-muted text-muted-foreground',
                };
                return (
                  <SelectItem key={k} value={k} className="font-bold text-xs py-2.5">
                    <span className="flex items-center gap-2 w-full">
                      {v}
                      <CountPill n={importanceCounts[k] ?? 0} color={importancePillColors[k]} />
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Read / Unread */}
          <Select value={readFilter} onValueChange={setReadFilter}>
            <SelectTrigger className="flex-1 min-w-[150px] h-10 rounded-xl font-bold text-xs border-none bg-background/50 hover:bg-secondary transition-colors">
              <SelectValue placeholder="Прочетени" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-primary/10">
              <SelectItem value="all" className="font-bold text-xs py-2.5">
                <span className="flex items-center gap-2 w-full">
                  Всички съобщения
                  <CountPill n={visible.length} color="bg-muted text-muted-foreground" />
                </span>
              </SelectItem>
              <SelectItem value="unread" className="font-bold text-xs py-2.5">
                <span className="flex items-center gap-2 w-full">
                  Непрочетени
                  <CountPill n={unreadCount} color="bg-unread/20 text-unread" />
                </span>
              </SelectItem>
              <SelectItem value="read" className="font-bold text-xs py-2.5">
                <span className="flex items-center gap-2 w-full">
                  Прочетени
                  <CountPill n={readCount} color="bg-muted text-muted-foreground" />
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Sort direction */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="h-10 w-10 rounded-xl bg-background/50 hover:bg-secondary text-primary shrink-0"
            title={sortDir === 'desc' ? 'Сортиране: Най-нови' : 'Сортиране: Най-стари'}
          >
            {sortDir === 'desc' ? <SortDesc className="h-5 w-5" /> : <SortAsc className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* ── Message list ── */}
      {filtered.length === 0 ? (
        <div className="bg-card/30 rounded-[2.5rem] border-dashed border-2 p-16 text-center animate-in zoom-in-95 duration-500">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl" />
            <Search className="h-16 w-16 mx-auto opacity-20 relative z-10" />
          </div>
          <h3 className="text-xl font-bold mb-2">Няма намерени съобщения</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">Опитайте да промените критериите за търсене или филтрите.</p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              className="mt-6 gap-2 rounded-xl"
              onClick={resetFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Нулирай филтрите
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(m => (
            <MessageCard key={m.id} message={m} isRead={isRead(m.id)} />
          ))}
        </div>
      )}
      <ScrollToTop />
    </div>
  );
};

export default Messages;
