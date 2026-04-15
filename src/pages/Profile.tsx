import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, metadataApi } from '@/lib/api';
import { ROLE_LABELS } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuditLog } from '@/contexts/AuditLogContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  EyeOff,
  Check,
  Circle,
  ChevronDown,
  X,
  User as UserIcon,
  Shield,
  Mail,
  School as SchoolIcon,
  BookOpen,
  Settings,
  Lock,
  LogOut
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { COMMON_SUBJECTS } from '@/types';
import { cn } from '@/lib/utils';

const Profile: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { addEntry } = useAuditLog();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    (user?.pendingSubject || user?.subject) ? (user.pendingSubject || user.subject || '').split(', ') : []
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [teacherType, setTeacherType] = useState(user?.pendingTeacherType || user?.teacherType || 'regular');
  const [selectedClass, setSelectedClass] = useState(user?.pendingClass || user?.class || '');

  const { data: rawSchoolClasses = [] } = useQuery({
    queryKey: ['schoolClasses', user?.school],
    queryFn: () => metadataApi.getClasses(user?.school || ''),
    enabled: !!user?.school,
  });

  const schoolClasses = React.useMemo(() => {
    const parseClass = (c: string | undefined) => {
      if (!c) return { num: 0, suffix: '' };
      const match = c.match(/^(\d+)(.*)$/);
      if (!match) return { num: 0, suffix: c };
      return { num: parseInt(match[1], 10), suffix: match[2] };
    };

    return [...rawSchoolClasses].sort((a, b) => {
      const classA = parseClass(a.name);
      const classB = parseClass(b.name);
      if (classA.num !== classB.num) return classB.num - classA.num;
      return classA.suffix.localeCompare(classB.suffix, 'bg');
    });
  }, [rawSchoolClasses]);

  const passwordRequirements = [
    { id: 'length', label: 'Минимум 8 символа', test: (p: string) => p.length >= 8 },
    { id: 'uppercase', label: 'Главна буква', test: (p: string) => /[A-Z]/.test(p) || /[А-Я]/.test(p) },
    { id: 'lowercase', label: 'Малка буква', test: (p: string) => /[a-z]/.test(p) || /[а-я]/.test(p) },
    { id: 'number', label: 'Цифра', test: (p: string) => /[0-9]/.test(p) },
    { id: 'special', label: 'Специален символ', test: (p: string) => /[^A-Za-z0-9А-Яа-я]/.test(p) },
  ];

  if (!user) return null;

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const removeSubject = (subject: string) => {
    setSelectedSubjects(prev => prev.filter(s => s !== subject));
  };

  const handleSave = async () => {
    if ((user.role === 'teacher' || user.role === 'director') && selectedSubjects.length === 0) {
      toast.error('Моля, изберете поне един предмет');
      return;
    }
    try {
      const subjectStr = (user.role === 'teacher' || user.role === 'director')
        ? selectedSubjects.join(', ')
        : undefined;

      const subjectChanged = user.role === 'teacher' && subjectStr !== (user.pendingSubject || user.subject || '');
      const typeChanged = user.role === 'teacher' && teacherType !== (user.pendingTeacherType || user.teacherType);
      const classChanged = user.role === 'teacher' && selectedClass !== (user.pendingClass || user.class);

      await updateProfile({
        firstName,
        lastName,
        ...(user.role === 'teacher'
          ? { 
              pendingSubject: subjectStr,
              teacherType: teacherType,
              class: teacherType === 'regular' ? null : selectedClass
            }
          : { subject: subjectStr }),
      });

      const message = [];
      if (subjectChanged) message.push('Предметите са изпратени за одобрение');
      if (typeChanged || classChanged) message.push('Промяната на типа учител/клас е изпратена за одобрение');
      
      
      toast.success(message.length > 0 ? message.join(' и ') : 'Профилът е обновен успешно');

      // Add audit log entry for significant changes
      if (subjectChanged || typeChanged || classChanged) {
        addEntry({
          action: 'Промяна по профил',
          performedBy: user.id,
          performedByName: `${firstName} ${lastName}`,
          performedBySchool: user.school,
          targetType: 'user',
          targetId: user.id,
          details: `Заявени промени: ${message.join(', ')}`,
        });
      }

      setIsEditing(false);
    } catch (err) {
      toast.error('Грешка при обновяване на профила');
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast.error('Паролата трябва да е поне 8 символа');
      return;
    }
    const unmetRequirements = passwordRequirements.filter(r => !r.test(newPassword));
    if (unmetRequirements.length > 0) {
      toast.error('Паролата не отговаря на всички изисквания');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Паролите не съвпадат');
      return;
    }

    try {
      await usersApi.changePassword(user.id, newPassword);
      toast.success('Паролата е сменена успешно');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Грешка при смяна на паролата');
    }
  };

  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`;

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-8 px-4">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-64 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-accent animate-gradient" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />

        <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col md:flex-row items-end gap-6 bg-gradient-to-t from-black/60 to-transparent">
          <div className="relative group">
            <div className="w-32 h-32 rounded-3xl bg-white/10 backdrop-blur-xl border-4 border-white/20 flex items-center justify-center text-4xl font-black text-white shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
              {initials}
            </div>
          </div>

          <div className="flex-1 space-y-1 mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black text-white tracking-tight">
                {user.firstName} {user.lastName}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-white/80 font-medium">
              <span className="flex items-center gap-1.5"><Mail size={18} /> {user.email}</span>
              {user.school && (
                <span className="flex items-center gap-1.5"><SchoolIcon size={27} /> {user.school}</span>
              )}
            </div>
          </div>

          <div className="flex gap-3 mb-2">
            <Button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-white/10 hover:bg-white/20 text-white border-none rounded-2xl backdrop-blur-md transition-all font-bold px-6"
            >
              <Settings className="mr-2 h-4 w-4" />
              {isEditing ? "Отказ" : "Редактирай"}
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="space-y-8">
        {/* Main Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden border border-white/20">
            <div className="p-8 border-b border-primary/5 bg-primary/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <UserIcon size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-foreground">Лична информация</h2>
                  <p className="text-sm text-muted-foreground font-medium">Основни данни за Вашия акаунт</p>
                </div>
              </div>
            </div>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1">Име</Label>
                  <Input
                    disabled={!isEditing}
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className={cn(
                      "h-14 rounded-2xl transition-all duration-300",
                      isEditing ? "bg-background border-primary/20 shadow-lg" : "bg-muted/30 border-none shadow-none font-semibold"
                    )}
                  />
                </div>
                <div className="space-y-2.5">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1">Фамилия</Label>
                  <Input
                    disabled={!isEditing}
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className={cn(
                      "h-14 rounded-2xl transition-all duration-300",
                      isEditing ? "bg-background border-primary/20 shadow-lg" : "bg-muted/30 border-none shadow-none font-semibold"
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-primary/5 items-stretch">
                <div className="space-y-2.5 flex flex-col">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-1.5">
                    <Shield size={16} /> Роля в системата
                  </Label>
                  <div className="min-h-[3.5rem] py-3 flex items-center px-5 rounded-2xl bg-secondary/40 font-bold text-foreground/80 border border-primary/5 flex-1">
                    {ROLE_LABELS[user.role]}
                  </div>
                </div>
                <div className="space-y-2.5 flex flex-col">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-1.5">
                    <SchoolIcon size={16} /> Училище
                  </Label>
                  <div className="min-h-[3.5rem] py-3 flex items-center px-5 rounded-2xl bg-secondary/40 font-bold text-foreground/80 border border-primary/5 leading-tight flex-1">
                    {user.school || "Не е посочено"}
                  </div>
                </div>
              </div>

              {user.role === 'teacher' && (
                <div className="space-y-4 pt-4 border-t border-primary/5">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-1.5">
                    <UserIcon size={16} /> Тип на учителския профил
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      disabled={!isEditing}
                      onClick={() => setTeacherType('regular')}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 font-bold",
                        teacherType === 'regular' 
                          ? "border-primary bg-primary/5 text-primary" 
                          : "border-primary/5 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                      )}
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span>Редовен учител</span>
                        <span className="text-[10px] opacity-60 font-medium">Само преподава предмети</span>
                      </div>
                      {teacherType === 'regular' && <Check size={20} />}
                    </button>
                    <button
                      disabled={!isEditing}
                      onClick={() => setTeacherType('class')}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 font-bold",
                        teacherType === 'class' 
                          ? "border-primary bg-primary/5 text-primary" 
                          : "border-primary/5 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                      )}
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span>Класен ръководител</span>
                        <span className="text-[10px] opacity-60 font-medium">Управлява и следи клас</span>
                      </div>
                      {teacherType === 'class' && <Check size={20} />}
                    </button>
                  </div>

                  {isEditing && teacherType === 'class' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-2 pt-2"
                    >
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1">Изберете клас</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="h-14 w-full justify-between rounded-2xl bg-background border-dashed border-2 border-primary/20 hover:border-primary transition-all font-bold">
                            {selectedClass ? `Избран клас: ${selectedClass}` : "Изберете клас..."}
                            <ChevronDown className="h-5 w-5 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-72 max-h-80 overflow-y-auto rounded-2xl p-2 shadow-2xl border-primary/10" align="start">
                          {schoolClasses.map(cls => (
                            <DropdownMenuCheckboxItem
                              key={cls.id}
                              checked={selectedClass === cls.name}
                              onSelect={() => setSelectedClass(cls.name)}
                              className="rounded-lg h-10 font-medium"
                            >
                              {cls.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {schoolClasses.length === 0 && (
                            <div className="p-4 text-center text-xs text-muted-foreground italic">Няма налични класове</div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.div>
                  )}

                  {(user.pendingTeacherType || user.pendingClass) && !isEditing && (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 font-medium text-amber-700 dark:text-amber-400 flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <div className="text-sm">
                          Чакащо одобрение за:
                        </div>
                      </div>
                      <div className="pl-5 text-sm font-bold">
                        {user.pendingTeacherType === 'class' ? 'Класен ръководител' : (user.pendingTeacherType === 'regular' ? 'Редовен учител' : (user.teacherType === 'class' ? 'Класен ръководител' : 'Редовен учител'))}
                        {user.pendingClass ? ` (${user.pendingClass} клас)` : ''}
                        {user.teacherType === 'class' && !user.pendingClass && user.pendingTeacherType === 'regular' ? ' (ще бъде премахнат от клас)' : ''}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(user.role === 'teacher' || user.role === 'director') && (
                <div className="space-y-4 pt-4 border-t border-primary/5">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-1.5">
                    <BookOpen size={16} /> Преподавани предмети
                  </Label>

                  <div className="space-y-4">
                    {isEditing && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="h-14 w-full justify-between rounded-2xl bg-background border-dashed border-2 border-primary/20 hover:border-primary transition-all font-bold">
                            {selectedSubjects.length > 0 ? `Избрани предмети (${selectedSubjects.length})` : "Добави предмети"}
                            <ChevronDown className="h-5 w-5 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-72 max-h-80 overflow-y-auto rounded-2xl p-2 shadow-2xl border-primary/10" align="start">
                          {COMMON_SUBJECTS.map(subject => (
                            <DropdownMenuCheckboxItem
                              key={subject}
                              checked={selectedSubjects.includes(subject)}
                              onCheckedChange={() => toggleSubject(subject)}
                              onSelect={(e) => e.preventDefault()}
                              className="rounded-lg h-10 font-medium"
                            >
                              {subject}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                      <div className="flex flex-wrap gap-2.5">
                        {selectedSubjects.length > 0 ? (
                        selectedSubjects.map(subject => (
                          <motion.div
                            layout
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            key={subject}
                          >
                            <Badge className="h-10 px-4 py-0 rounded-xl bg-primary/10 text-primary border-none text-sm font-bold flex items-center gap-2 group hover:bg-primary/20 transition-colors">
                              {subject}
                              {isEditing && (
                                <span
                                  onClick={() => removeSubject(subject)}
                                  className="cursor-pointer p-0.5 rounded-full hover:bg-red-500 hover:text-white transition-all scale-110"
                                >
                                  <X size={14} />
                                </span>
                              )}
                            </Badge>
                          </motion.div>
                        ))
                      ) : (
                        <div className="italic text-muted-foreground text-sm pl-1 font-medium">Все още няма избрани предмети.</div>
                      )}
                    </div>

                    {user.role === 'teacher' && user.pendingSubject && user.pendingSubject !== user.subject && !isEditing && (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-medium text-amber-700 dark:text-amber-400">
                        Чакащо одобрение на предмети: {user.pendingSubject}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {user.class && (
                <div className="space-y-2.5 pt-4 border-t border-primary/5">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1">Клас</Label>
                  <div className="h-14 flex items-center px-5 rounded-2xl bg-secondary/40 font-bold text-foreground/80 border border-primary/5">
                    {user.class}
                  </div>
                </div>
              )}

              <AnimatePresence>
                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-6"
                  >
                    <Button
                      onClick={handleSave}
                      className="h-14 px-10 rounded-2xl font-black text-base bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all w-full md:w-auto"
                    >
                      Запази промените
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden border border-white/20">
            <div className="p-8 border-b border-primary/5 bg-accent/5 flex items-center">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-accent/10 text-accent rounded-2xl">
                  <Lock size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-foreground">Сигурност</h2>
                  <p className="text-sm text-muted-foreground font-medium">Защитете акаунта си</p>
                </div>
              </div>
            </div>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1">Нова парола</Label>
                    <div className="relative group">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Минимум 8 символа"
                        className="h-14 rounded-2xl bg-background/50 border-primary/5 focus:border-primary/30 transition-all pr-12 shadow-inner font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors focus:outline-none"
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1">Потвърди паролата</Label>
                    <div className="relative group">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="h-14 rounded-2xl bg-background/50 border-primary/5 focus:border-primary/30 transition-all pr-12 shadow-inner font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors focus:outline-none"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-secondary/30 space-y-3 border border-white/5 flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Изисквания за парола:</p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {passwordRequirements.map((req) => {
                      const isMet = req.test(newPassword);
                      return (
                        <div key={req.id} className={cn(
                          "flex items-center gap-2.5 text-xs font-bold transition-all duration-300",
                          isMet ? "text-green-500 scale-[1.02]" : "text-muted-foreground/60"
                        )}>
                          <div className={cn(
                            "p-0.5 rounded-full transition-colors",
                            isMet ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                          )}>
                            {isMet ? <Check size={10} /> : <Circle size={10} />}
                          </div>
                          <span>{req.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-primary/5">
                <Button
                  variant="outline"
                  onClick={handlePasswordChange}
                  className="h-14 px-10 rounded-2xl font-black text-sm uppercase tracking-widest bg-background hover:bg-accent/10 hover:text-accent border-accent/20 transition-all duration-300 shadow-sm"
                >
                  Обнови парола
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
