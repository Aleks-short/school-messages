import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { ROLE_LABELS } from '@/types';
import { Mail, PlusCircle, User, LogOut, LayoutDashboard, Menu, X, Bell, Shield, FileText, Archive, School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ModeToggle } from '@/components/mode-toggle';
import { ALL_SCHOOLS } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MarqueeText from './MarqueeText';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, activeSchoolScope, setActiveSchoolScope, isGlobalAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user && ['admin', 'director'].includes(user.role);
  const adminEntry = isGlobalAdmin
    ? { to: '/admin', label: 'Админ панел', icon: Shield }
    : user?.role === 'director'
      ? { to: '/director', label: 'Директорски панел', icon: Shield }
      : null;

  const navItems = [
    { to: '/dashboard', label: 'Табло', icon: LayoutDashboard },
    { to: '/messages', label: 'Съобщения', icon: Mail },
    { to: '/drafts', label: 'Чернови', icon: FileText },
    { to: '/archived', label: 'Личен архив', icon: Archive },
    { to: '/notifications', label: 'Уведомления', icon: Bell, badge: unreadCount },
    { to: '/create', label: 'Ново съобщение', icon: PlusCircle },
    ...(isAdmin && adminEntry ? [adminEntry] : []),
    { to: '/profile', label: 'Профил', icon: User },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSchoolChange = (newSchool: string) => {
    setActiveSchoolScope(newSchool === 'all' ? '' : newSchool);
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground sticky top-0 h-screen overflow-y-auto">
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/dashboard" className={`flex items-start gap-3 ${isGlobalAdmin ? 'mb-4' : 'mb-0'}`}>
            <Mail className="h-7 w-7 text-sidebar-primary shrink-0 mt-0.5" />
            <span className="font-heading text-xl font-bold leading-tight">Училищни съобщения</span>
          </Link>

          {isGlobalAdmin && (
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-sidebar-foreground/50 flex items-center gap-1.5 px-1">
                <School className="h-3 w-3" />
                Избор на училище
              </label>
              <Select value={activeSchoolScope || 'all'} onValueChange={handleSchoolChange}>
                <SelectTrigger className="bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent transition-colors h-11 rounded-xl">
                  <MarqueeText 
                    text={activeSchoolScope || 'Всички училища'} 
                    className="text-sm font-medium" 
                    delay="2s"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всички училища</SelectItem>
                  {ALL_SCHOOLS.map(school => (
                    <SelectItem key={school} value={school}>
                      <MarqueeText text={school} speed={20} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'hover:bg-sidebar-accent/50'
                  }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
                {'badge' in item && (item as any).badge > 0 && (
                  <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {(item as any).badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-sidebar-foreground/60 mb-1" title={`${user?.firstName} ${user?.lastName}`}>{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-sidebar-foreground/40" title={!isGlobalAdmin ? user?.school : activeSchoolScope || 'Всички училища'}>
                {user ? ROLE_LABELS[user.role] : ''}
                {!isGlobalAdmin && user?.school ? ` · ${user.school}` : ''}
                {isGlobalAdmin ? ` · ${activeSchoolScope || 'Всички училища'}` : ''}
              </div>
            </div>
            <ModeToggle className="bg-transparent border-none shadow-none text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-2 text-red-400 font-bold hover:text-white hover:bg-red-500 transition-all duration-300"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" /> Изход
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-sidebar-primary shrink-0" />
          <span className="font-heading text-lg font-bold leading-tight">Училищни съобщения</span>
        </Link>
        <div className="flex items-center gap-1">
          <ModeToggle className="bg-transparent border-none shadow-none text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
          <Link to="/notifications" className="relative p-2">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-sidebar-primary text-sidebar-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-sidebar text-sidebar-foreground pt-16 flex flex-col">
          <div className="p-4 border-b border-sidebar-border">
            {isGlobalAdmin && (
              <div className="space-y-2 mb-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-sidebar-foreground/50 flex items-center gap-1.5 px-1">
                  <School className="h-3 w-3" />
                  Избор на училище
                </label>
                <Select value={activeSchoolScope || 'all'} onValueChange={(v) => { handleSchoolChange(v); setMobileOpen(false); }}>
                  <SelectTrigger className="bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent transition-colors h-11 rounded-xl">
                    <MarqueeText 
                      text={activeSchoolScope || 'Всички училища'} 
                      className="text-sm font-medium" 
                      delay="2s"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всички училища</SelectItem>
                    {ALL_SCHOOLS.map(school => (
                      <SelectItem key={school} value={school}>
                        <MarqueeText text={school} speed={20} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-base hover:bg-sidebar-accent"
                >
                  <Icon className="h-5 w-5" /> {item.label}
                  {'badge' in item && (item as any).badge > 0 && (
                    <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                      {(item as any).badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-sidebar-border">
            <Button
              variant="outline"
              className="w-full justify-start border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white font-bold"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" /> Изход
            </Button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-0 mt-14 md:mt-0">
        <div className={`${(location.pathname === '/admin' || location.pathname === '/director') ? 'max-w-[80%]' : 'max-w-5xl'} mx-auto p-4 md:p-8 transition-all duration-500`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
