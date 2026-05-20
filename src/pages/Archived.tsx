import React, { useEffect } from 'react';
import { useMessages } from '@/contexts/MessagesContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArchiveRestore, Archive, Eye, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ArrowUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";

const Archived: React.FC = () => {
  const { getUserArchivedMessages, toggleArchive, unarchiveMessage, refreshMessages } = useMessages();
  const archived = getUserArchivedMessages();
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

  const handleToggleArchive = async (id: string, isRestoring: boolean, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isRestoring) {
      await unarchiveMessage(id);
      toast.success('Съобщението е разархивирано');
    } else {
      await toggleArchive(id);
      toast.success('Съобщението е добавено в архива');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(archived.map(m => m.id));
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

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    
    for (const id of selectedIds) {
      await unarchiveMessage(id);
    }

    toast.success(`${selectedIds.length} съобщения са разархивирани`);
    setSelectedIds([]);
  };

  const getContentPreview = (content: string) => {
    if (!content) return 'Няма съдържание';
    return content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight flex items-center gap-2">
            Личен архив
            <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full text-sm font-bold bg-primary text-primary-foreground shadow-md shadow-primary/30 tabular-nums">
              {archived.length}
            </span>
          </h1>
          <p className="text-muted-foreground font-medium">Вашите съхранени съобщения за по-късен преглед</p>
        </div>
        {archived.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-xl shadow-sm border border-primary/5">
              <Checkbox 
                id="select-all" 
                checked={selectedIds.length === archived.length && archived.length > 0} 
                onCheckedChange={handleSelectAll}
                className="rounded-md border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <label htmlFor="select-all" className="text-xs font-black text-muted-foreground uppercase tracking-widest leading-none cursor-pointer">Избери всички</label>
            </div>

            <div className="h-6 w-px bg-primary/10 mx-1 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none">Сортиране</span>
              </div>
              <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
                <SelectTrigger className="h-10 w-[200px] rounded-xl font-bold text-xs border-none bg-card hover:bg-secondary transition-colors shadow-sm">
                  <SelectValue placeholder="Сортиране" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="newest" className="font-bold text-xs py-2.5">Най-нови архиви</SelectItem>
                  <SelectItem value="oldest" className="font-bold text-xs py-2.5">Най-стари архиви</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {archived.length === 0 ? (
        <div className="bg-card/30 rounded-[2.5rem] border-dashed border-2 p-16 text-center animate-in zoom-in-95 duration-500">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl" />
            <Archive className="h-16 w-16 mx-auto opacity-20 relative z-10" />
          </div>
          <h3 className="text-xl font-bold mb-2">Нямате архивирани съобщения</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">Когато архивирате съобщение, то ще се появи тук.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {archived
            .sort((a, b) => {
              const timeA = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
              const timeB = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
              return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
            })
            .map(m => (
              <Link key={m.id} to={`/messages/${m.id}?archive=true`} className="block transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] relative hover:z-10">
                <Card className={`rounded-[1.75rem] border-primary/5 transition-all duration-300 ${
                  selectedIds.includes(m.id) 
                    ? 'bg-primary/5 border-primary/20 shadow-lg' 
                    : 'bg-card hover:border-primary/20 hover:shadow-xl'
                }`}>
                  <CardContent className="p-6 flex gap-6 items-center">
                    <div className="shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                      <Checkbox 
                        checked={selectedIds.includes(m.id)} 
                        onCheckedChange={() => toggleSelect(m.id)}
                        className="h-6 w-6 rounded-lg border-2 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-sm"
                      />
                    </div>
                    <div className={`flex-1 min-w-0 ${selectedIds.includes(m.id) ? 'opacity-80' : ''}`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                              <Archive className="h-3 w-3" /> Личен архив
                            </span>
                            {m.isSnapshot && (
                              <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> Пълен отпечатък
                              </span>
                            )}
                            <span className="text-[10px] font-black uppercase tracking-widest bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-lg">
                              Създадено: {format(new Date(m.createdAt), 'd MMM yyyy', { locale: bg })}
                            </span>
                          </div>
                          <h3 className="text-xl font-black font-heading mb-2 group-hover:text-primary transition-colors truncate">
                            {m.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-4 max-w-3xl whitespace-pre-wrap">
                            {getContentPreview(m.content)}
                          </p>
                          <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" /> Архивирано на: {m.archivedAt ? format(new Date(m.archivedAt), 'd MMM, HH:mm', { locale: bg }) : 'Неизвестно'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 md:border-l md:pl-6 border-primary/5">
                          <Button
                            variant="secondary"
                            onClick={(e) => handleToggleArchive(m.id, true, e)}
                            className="rounded-xl font-black gap-2 h-11 px-5 shadow-sm hover:scale-105 active:scale-95 transition-all text-xs"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                            Разархивирай
                          </Button>
                          <Button
                            variant="outline"
                            asChild
                            className="h-11 w-11 rounded-xl p-0 shadow-sm hover:bg-primary/5 transition-all text-muted-foreground"
                          >
                            <Link to={`/messages/${m.id}?archive=true`}>
                              <Eye className="h-5 w-5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
        </div>
      )}

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
                  <p className="text-white font-black text-sm leading-tight">Избрани съобщения</p>
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
                  onClick={handleBulkRestore}
                  className="rounded-2xl bg-white text-slate-900 hover:bg-white/90 font-black h-12 px-6 flex items-center gap-2 shadow-xl shadow-white/5 transition-all active:scale-95"
                >
                  <ArchiveRestore className="h-5 w-5" />
                  <span className="hidden sm:inline">Разархивирай всички</span>
                  <span className="sm:hidden">Всички</span>
                </Button>

              </div>
            </div>
          </Card>
        </div>
      </div>
    )}
  </div>
  );
};

export default Archived;
