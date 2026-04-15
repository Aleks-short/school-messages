import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { UserRole, TeacherType, ROLE_LABELS, COMMON_SUBJECTS, ALL_SCHOOLS } from '@/types';
import {
  Mail, ChevronDown, X, Eye, EyeOff, UserPlus, User, School, Lock,
  Sparkles, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { ModeToggle } from '@/components/mode-toggle';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

const REGISTERABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'director', label: ROLE_LABELS.director },
  { value: 'teacher', label: ROLE_LABELS.teacher },
  { value: 'student', label: ROLE_LABELS.student },
];

const PREDEFINED_SCHOOLS = ALL_SCHOOLS;

const CLASS_NUMBERS = Array.from({ length: 12 }, (_, i) => String(12 - i));
const CLASS_LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'];

const Register: React.FC = () => {
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', role: '' as UserRole,
    school: '', classYear: '', classLetter: '', teacherType: '' as TeacherType,
  });

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordRequirements = [
    { id: 'length', label: '8+ симв.', test: (p: string) => p.length >= 8 },
    { id: 'uppercase', label: 'Гл. буква', test: (p: string) => /[A-Z]/.test(p) || /[А-Я]/.test(p) },
    { id: 'lowercase', label: 'Малка буква', test: (p: string) => /[a-z]/.test(p) || /[а-я]/.test(p) },
    { id: 'number', label: 'Цифра', test: (p: string) => /[0-9]/.test(p) },
    { id: 'special', label: 'Спец. симв.', test: (p: string) => /[^A-Za-z0-9А-Яа-я]/.test(p) },
  ];

  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const removeSubject = (subject: string) => {
    setSelectedSubjects(prev => prev.filter(s => s !== subject));
  };

  const showClassField =
    form.role === 'student' ||
    (form.role === 'teacher' && form.teacherType === 'class');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.firstName || !form.lastName || !form.role || !form.school) {
      toast.error('Моля, попълнете всички задължителни полета');
      return;
    }

    const finalSubjects = [...selectedSubjects];
    const subjectStr = finalSubjects.join(', ');

    if ((form.role === 'teacher' || form.role === 'director') && selectedSubjects.length === 0) {
      toast.error('Моля, изберете поне един предмет');
      return;
    }
    if (showClassField && (!form.classYear || !form.classLetter)) {
      toast.error('Моля, попълнете класа');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Паролата трябва да е поне 8 символа');
      return;
    }
    const unmetRequirements = passwordRequirements.filter(r => !r.test(form.password));
    if (unmetRequirements.length > 0) {
      toast.error('Паролата не отговаря на всички изисквания');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Паролите не съвпадат');
      return;
    }

    const finalClass = showClassField ? `${form.classYear}${form.classLetter}` : undefined;

    setIsSubmitting(true);
    try {
      const result = await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        school: form.school,
        subject: (form.role === 'teacher' || form.role === 'director') ? subjectStr : undefined,
        teacherType: form.role === 'teacher' ? form.teacherType : undefined,
        class: finalClass,
      });
      if (result.success) {
        if (result.user?.registrationStatus === 'pending') {
          toast.success('Регистрацията е изпратена и чака одобрение от администратор.');
        } else {
          toast.success('Успешна регистрация!');
        }
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Потребител с този имейл вече съществува');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden bg-zinc-950 dark:bg-zinc-950">
        {/* Abstract Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay" />
          <div className="absolute top-[15%] right-[15%] w-[45%] h-[45%] bg-primary/30 rounded-full blur-[140px] animate-pulse" />
          <div className="absolute bottom-[15%] left-[15%] w-[55%] h-[55%] bg-accent/20 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="z-10 relative w-full max-w-2xl px-12"
        >
          <div className="p-12 rounded-[3rem] border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/40 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-accent/40 to-transparent rounded-tr-full opacity-50 xl:group-hover:translate-x-4 xl:group-hover:-translate-y-4 transition-transform duration-700" />

            <div className="relative z-10 flex flex-col gap-6 text-white">
              <div className="h-16 w-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-lg mb-2">
                <UserPlus className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-4xl xl:text-5xl font-black mb-2 leading-tight tracking-tight">
                Станете част от <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  бъдещето
                </span> на образованието
              </h2>
              <p className="text-lg xl:text-xl text-white/70 font-medium leading-relaxed max-w-lg mb-4">
                Управлявайте класове, възлагайте задачи, разговаряйте с учители и директори без усилие.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-[600px] xl:w-[650px] flex flex-col relative z-20 bg-card/80 backdrop-blur-3xl shadow-[-20px_0_40px_rgba(0,0,0,0.05)] dark:shadow-[-20px_0_40px_rgba(0,0,0,0.2)] border-l border-primary/5">
        <div className="absolute top-6 right-6 md:right-8 z-30">
          <ModeToggle />
        </div>

        <div className="flex-1 overflow-y-auto px-6 sm:px-12 md:px-16 flex flex-col py-4 scrollbar-none">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-[500px] mx-auto my-auto"
          >
            <div className="flex items-center gap-4 mb-5 pt-2">
              <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 relative shrink-0">
                <UserPlus className="h-6 w-6 text-primary" />
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="h-3.5 w-3.5 text-accent animate-bounce" />
                </div>
              </div>
              <div>
                <h1 className="font-heading text-2xl font-black text-foreground tracking-tight leading-none">Регистрация</h1>
                <p className="text-[11px] text-muted-foreground font-medium mt-1">Присъединете се към Училищни съобщения за секунди</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 pl-1">Име</Label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                      <User size={14} />
                    </div>
                    <Input
                      value={form.firstName}
                      onChange={e => set('firstName', e.target.value)}
                      placeholder="Име"
                      className="h-10 pl-9 rounded-xl bg-secondary/40 border-primary/5 focus:border-primary/30 transition-all font-bold shadow-inner text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 pl-1">Фамилия</Label>
                  <Input
                    value={form.lastName}
                    onChange={e => set('lastName', e.target.value)}
                    placeholder="Фамилия"
                    className="h-10 rounded-xl bg-secondary/40 border-primary/5 focus:border-primary/30 transition-all font-bold shadow-inner text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 pl-1">Имейл</Label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                      <Mail size={14} />
                    </div>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="Имейл"
                      className="h-10 pl-9 rounded-xl bg-secondary/40 border-primary/5 focus:border-primary/30 transition-all font-bold shadow-inner text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 pl-1">Роля</Label>
                  <Select value={form.role} onValueChange={v => { set('role', v); set('teacherType', ''); set('classYear', ''); set('classLetter', ''); setSelectedSubjects([]); }}>
                    <SelectTrigger className="h-10 rounded-xl bg-secondary/40 border-primary/5 focus:border-primary/30 transition-all font-bold shadow-inner text-sm">
                      <SelectValue placeholder="Избери роля" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-primary/10">
                      {REGISTERABLE_ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value} className="font-bold">{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 pl-1">Училище</Label>
                <Select value={form.school} onValueChange={v => set('school', v)}>
                  <SelectTrigger className="h-10 rounded-xl bg-secondary/40 border-primary/5 focus:border-primary/30 transition-all font-bold shadow-inner text-sm">
                    <div className="flex items-center gap-2">
                      <School size={14} className="text-muted-foreground/40" />
                      <SelectValue placeholder="Изберете училище" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10">
                    {PREDEFINED_SCHOOLS.map(school => (
                      <SelectItem key={school} value={school} className="font-bold">{school}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <AnimatePresence mode="wait">
                {(form.role === 'teacher' || form.role === 'director') && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                    <div className={cn(
                      "grid gap-3 items-end",
                      form.role === 'teacher' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                    )}>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 font-black">Предмети</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-10 w-full justify-between rounded-xl bg-secondary/20 border-dashed border border-primary/20 hover:border-primary transition-all font-bold text-sm">
                              {selectedSubjects.length > 0 ? `Избрани (${selectedSubjects.length})` : "Изберете"}
                              <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-full min-w-[200px] max-h-40 overflow-y-auto rounded-xl border-primary/10 shadow-xl" align="start">
                            {COMMON_SUBJECTS.map(subject => (
                              <DropdownMenuCheckboxItem key={subject} checked={selectedSubjects.includes(subject)} onCheckedChange={() => toggleSubject(subject)} onSelect={(e) => e.preventDefault()} className="font-bold text-xs">{subject}</DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {form.role === 'teacher' && (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 font-black">Заетост</Label>
                          <RadioGroup value={form.teacherType} onValueChange={v => { set('teacherType', v); if (v === 'regular') { set('classYear', ''); set('classLetter', ''); } }} className="flex gap-2 h-10">
                            <label className={cn("flex items-center justify-center space-x-2 flex-1 rounded-xl border cursor-pointer transition-all shadow-sm text-[11px] font-bold px-2", form.teacherType === 'class' ? "bg-primary/10 border-primary text-primary" : "bg-background border-transparent hover:border-primary/10")}>
                              <RadioGroupItem value="class" id="class-teacher" className="sr-only" />
                              <span>Класен</span>
                            </label>
                            <label className={cn("flex items-center justify-center space-x-2 flex-1 rounded-xl border cursor-pointer transition-all shadow-sm text-[11px] font-bold px-2", form.teacherType === 'regular' ? "bg-primary/10 border-primary text-primary" : "bg-background border-transparent hover:border-primary/10")}>
                              <RadioGroupItem value="regular" id="regular-teacher" className="sr-only" />
                              <span>Редовен</span>
                            </label>
                          </RadioGroup>
                        </div>
                      )}
                    </div>
                    {selectedSubjects.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-14 overflow-y-auto scrollbar-none">
                        {selectedSubjects.map(subject => (
                          <Badge key={subject} className="h-6 px-2 rounded-lg bg-primary/20 text-primary border-none text-[10px] font-black flex items-center gap-1">
                            {subject} <X className="h-2.5 w-2.5 cursor-pointer hover:text-red-500" onClick={() => removeSubject(subject)} />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showClassField && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-accent/5 border border-accent/10">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-accent pl-1">Клас</Label>
                      <Select value={form.classYear} onValueChange={v => set('classYear', v)}>
                        <SelectTrigger className="h-9 rounded-lg bg-background border-accent/20 focus:border-accent text-xs font-bold px-3">
                          <SelectValue placeholder="№" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">{CLASS_NUMBERS.map(num => <SelectItem key={num} value={num} className="font-bold">{num} клас</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-accent pl-1">Паралелка</Label>
                      <Select value={form.classLetter} onValueChange={v => set('classLetter', v)}>
                        <SelectTrigger className="h-9 rounded-lg bg-background border-accent/20 focus:border-accent text-xs font-bold px-3">
                          <SelectValue placeholder="Буква" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">{CLASS_LETTERS.map(letter => <SelectItem key={letter} value={letter} className="font-bold">{letter}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 pl-1">Парола</Label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                      <Lock size={14} />
                    </div>
                    <Input type={showPassword ? "text" : "password"} value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" className="h-10 pl-9 pr-9 rounded-xl bg-secondary/40 border-primary/5 focus:border-primary/30 transition-all font-bold shadow-inner text-sm" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 pl-1">Потвърди</Label>
                  <div className="relative group">
                    <Input type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="••••••••" className="h-10 pl-4 pr-9 rounded-xl bg-secondary/40 border-primary/5 focus:border-primary/30 transition-all font-bold shadow-inner text-sm" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary">
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* More visible password requirements below password fields */}
              {(form.password.length > 0) && (
                <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1.5 px-1 pt-1">
                  {passwordRequirements.map((req) => {
                    const isMet = req.test(form.password);
                    return (
                      <div key={req.id} className={cn(
                        "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                        isMet ? "text-green-500" : "text-muted-foreground/20"
                      )}>
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full transition-all",
                          isMet ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-muted-foreground/20"
                        )} />
                        <span>{req.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 space-y-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl font-black text-sm bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 group"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Създаване на профил</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center font-medium">
                  Имате акаунт? <Link to="/login" className="text-primary hover:text-primary/80 font-black transition-colors">Влезте тук</Link>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Register;
