import React, { useState } from 'react';
import { useMessages } from '@/contexts/MessagesContext';
import ScrollToTop from '@/components/ScrollToTop';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, FileText, Clock, ArrowUpDown, X, CheckSquare } from 'lucide-react';
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

const Drafts: React.FC = () => {
  const { getUserDrafts, deleteMessage, deleteMessages } = useMessages();
  const drafts = getUserDrafts();
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteMessage(id);
    toast.success('Черновата е изтрита');
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(drafts.map(m => m.id));
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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      await deleteMessages(selectedIds);
      toast.success(`${selectedIds.length} чернови са изтрити`);
      setSelectedIds([]);
    } catch (e) {
      toast.error('Възникна грешка при изтриването');
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight flex items-center gap-2">
            Чернови
            <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full text-sm font-bold bg-primary text-primary-foreground shadow-md shadow-primary/30 tabular-nums">
              {drafts.length}
            </span>
          </h1>
          <p className="text-muted-foreground font-medium">Вашите незавършени съобщения, съхранени локално</p>
        </div>
        {drafts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-xl shadow-sm border border-primary/5">
              <Checkbox 
                id="select-all" 
                checked={selectedIds.length === drafts.length && drafts.length > 0} 
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
                <SelectTrigger className="h-10 w-[180px] rounded-xl font-bold text-xs border-none bg-card hover:bg-secondary transition-colors shadow-sm">
                  <SelectValue placeholder="Сортиране" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="newest" className="font-bold text-xs py-2.5">Най-нови промени</SelectItem>
                  <SelectItem value="oldest" className="font-bold text-xs py-2.5">Най-стари промени</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {drafts.length === 0 ? (
        <div className="bg-card/30 rounded-[2.5rem] border-dashed border-2 p-16 text-center animate-in zoom-in-95 duration-500">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl" />
            <FileText className="h-16 w-16 mx-auto opacity-20 relative z-10" />
          </div>
          <h3 className="text-xl font-bold mb-2">Нямате чернови</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">Когато започнете ново съобщение, то автоматично ще се запази тук.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {drafts
            .sort((a, b) => {
              const timeA = new Date(a.updatedAt || a.createdAt).getTime();
              const timeB = new Date(b.updatedAt || b.createdAt).getTime();
              return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
            })
            .map(m => (
              <Link key={m.id} to={`/edit/${m.id}`} className="block transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] relative hover:z-10">
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
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                              <FileText className="h-3 w-3" /> Чернова
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-lg">
                              <Clock className="h-3 w-3 mr-1 inline" /> {format(new Date(m.updatedAt), 'd MMM, HH:mm', { locale: bg })}
                            </span>
                          </div>
                          <h3 className="text-xl font-black font-heading mb-2 group-hover:text-primary transition-colors truncate">
                            {m.title || 'Без заглавие'}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed max-w-3xl italic whitespace-pre-wrap">
                            {getContentPreview(m.content)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 md:border-l md:pl-6 border-primary/5">
                          <Button
                            size="lg"
                            className="rounded-xl font-black gap-2 h-11 px-6 shadow-sm hover:scale-105 active:scale-95 transition-all text-sm bg-primary text-white"
                          >
                            <Edit className="h-4 w-4" />
                            Довърши
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDelete(m.id, e)}
                            className="h-11 w-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
                          >
                            <Trash2 className="h-5 w-5" />
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
                    <p className="text-white font-black text-sm leading-tight">Избрани чернови</p>
                    <button 
                      onClick={() => setSelectedIds([])}
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
                        <AlertDialogTitle className="font-heading font-black text-2xl">Изтриване на {selectedIds.length} чернови</AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-medium">
                          Сигурни ли сте? Това действие ще изтрие окончателно избраните чернови.
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

export default Drafts;
