import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, LogIn, Sparkles, School, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ModeToggle } from '@/components/mode-toggle';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import { SERVER_URL } from '@/lib/api';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testAccounts, setTestAccounts] = useState<any[]>([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${SERVER_URL}/api/auth/test-accounts`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTestAccounts(data);
      })
      .catch(err => console.error("Could not fetch test accounts", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Въведете имейл'); return; }

    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        if (result.user?.registrationStatus === 'pending') {
          toast.info('Профилът Ви чака одобрение от администратор.');
        } else if (result.user?.registrationStatus === 'rejected') {
          toast.error('Регистрацията Ви е отхвърлена.');
        } else {
          toast.success('Успешен вход!');
        }
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Невалиден имейл или парола');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 bg-zinc-950 dark:bg-zinc-950 z-0">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay" />
          <div className="absolute top-[10%] left-[20%] w-[50%] h-[50%] bg-primary/30 rounded-full blur-[150px] animate-pulse" />
          <div className="absolute bottom-[10%] right-[10%] w-[60%] h-[60%] bg-accent/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
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
              <div className="h-16 w-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-lg">
                <School className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-4xl xl:text-5xl font-black mb-2 leading-tight tracking-tight">
                Свържете се с вашето <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  училище
                </span> по нов начин
              </h2>
              <p className="text-lg xl:text-xl text-white/70 font-medium leading-relaxed max-w-lg">
                Модерна, бърза и сигурна платформа за комуникация между учители, ученици и ръководство.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-[500px] xl:w-[550px] flex flex-col relative z-20 bg-card/80 backdrop-blur-3xl shadow-[-20px_0_40px_rgba(0,0,0,0.05)] dark:shadow-[-20px_0_40px_rgba(0,0,0,0.2)] border-l border-primary/5">
        <div className="absolute top-6 right-6 md:right-8 z-30">
          <ModeToggle />
        </div>

        <div className="flex-1 overflow-y-auto px-8 sm:px-12 md:px-16 flex flex-col justify-center py-12 scrollbar-none">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-[400px] mx-auto"
          >
            <div className="flex flex-col gap-1 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20 relative w-fit">
                  <Mail className="h-6 w-6 text-primary" />
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-3 w-3 text-accent animate-bounce" />
                  </div>
                </div>
                <h1 className="font-heading text-2xl font-black text-foreground tracking-tight">Училищни съобщения</h1>
              </div>
              <h2 className="text-2xl font-black text-foreground">Добре дошли</h2>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Влезте във вашия акаунт, за да продължите</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Имейл адрес</Label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
                    <Mail size={16} />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Имейл"
                    className="h-12 pl-12 rounded-2xl bg-secondary/40 border-primary/5 focus:border-primary/30 transition-all font-bold shadow-inner text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Парола</Label>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
                    <Lock size={16} />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 pl-12 pr-12 rounded-2xl bg-secondary/40 border-primary/5 focus:border-primary/30 transition-all font-bold shadow-inner text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-2xl font-black text-sm bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group mt-2"
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Вход в системата</span>
                    <LogIn className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-primary/10"></div>
              </div>
              <div className="relative flex justify-center text-[9px] font-black uppercase tracking-[0.2em]">
                <span className="bg-card px-4 text-muted-foreground/50">Или</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center font-medium">
              Нямате акаунт? <Link to="/register" className="text-primary hover:text-primary/80 font-black transition-colors">Създайте профил</Link>
            </p>

            <div className="mt-6 p-5 rounded-[2rem] bg-secondary/25 border border-primary/10 space-y-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-accent" /> Тестови акаунти (парола: password123)
              </p>
              
              <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                {/* Admin */}
                {testAccounts.filter(a => a.role === 'admin').length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-primary/70 uppercase tracking-tighter pl-1">Глобален достъп</p>
                    {testAccounts.filter(a => a.role === 'admin').map((acc, i) => (
                      <div 
                        key={`admin-${i}`} 
                        className="bg-background/90 p-3 rounded-xl border border-primary/20 hover:border-primary/40 transition-all font-bold text-sm text-foreground/90 truncate shadow-sm cursor-pointer"
                        onClick={() => { setEmail(acc.email); setPassword('password123'); }}
                      >
                        {acc.email}
                      </div>
                    ))}
                  </div>
                )}

                {/* Schools Grouped */
                  Array.from(new Set(testAccounts.filter(a => a.role !== 'admin').map(a => a.school))).map((schoolName, i) => {
                    const schoolAccounts = testAccounts.filter(a => a.school === schoolName);
                    if (schoolAccounts.length === 0) return null;
                    return (
                      <div key={`school-${i}`} className="space-y-2.5 pt-1">
                        <p className="text-[10px] font-black text-muted-foreground/80 uppercase tracking-tighter flex items-center gap-1.5 border-t border-primary/10 pt-3 pl-1">
                          <School size={12} /> {schoolName}
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {schoolAccounts.map((acc, j) => {
                            let roleLabel = acc.role;
                            if (acc.role === 'director') roleLabel = 'Директор';
                            else if (acc.role === 'teacher') roleLabel = 'Учител';
                            else if (acc.role === 'student') roleLabel = 'Ученик';
                            return (
                              <div 
                                key={`acc-${i}-${j}`} 
                                className="bg-background/90 p-3 rounded-xl border border-white/10 text-xs font-bold text-muted-foreground flex justify-between items-center shadow-sm hover:border-primary/20 transition-colors cursor-pointer"
                                onClick={() => { setEmail(acc.email); setPassword('password123'); }}
                              >
                                <span className="truncate pr-2">{acc.email}</span>
                                <Badge variant="outline" className="text-[9px] font-black py-0 h-5 bg-primary/5 text-primary border-primary/20 whitespace-nowrap">{roleLabel}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
