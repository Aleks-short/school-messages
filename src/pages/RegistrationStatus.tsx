import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { REGISTRATION_STATUS_LABELS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock3, ShieldCheck, ShieldX } from 'lucide-react';

const STATUS_STYLES = {
  pending: {
    icon: Clock3,
    badge: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
    title: 'Регистрацията Ви чака одобрение',
    description: 'Профилът Ви е създаден успешно, но достъпът ще бъде активиран след преглед от глобален администратор.',
  },
  approved: {
    icon: ShieldCheck,
    badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
    title: 'Профилът Ви е одобрен',
    description: 'Одобрението е завършено успешно. Ако все още виждате този екран, презаредете страницата.',
  },
  rejected: {
    icon: ShieldX,
    badge: 'bg-rose-500/15 text-rose-600 border-rose-500/20',
    title: 'Регистрацията Ви е отхвърлена',
    description: 'Свържете се с администратор на платформата или подайте нова регистрация с коректни данни.',
  },
} as const;

const RegistrationStatus: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const config = STATUS_STYLES[user.registrationStatus];
  const Icon = config.icon;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-10">
      <Card className="w-full rounded-[2rem] border-primary/10 shadow-xl">
        <CardHeader className="space-y-4 p-8 pb-0 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Icon className="h-8 w-8" />
          </div>
          <div className="space-y-3">
            <Badge variant="outline" className={config.badge}>
              {REGISTRATION_STATUS_LABELS[user.registrationStatus]}
            </Badge>
            <CardTitle className="text-2xl font-black">{config.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-8 text-center">
          <p className="text-sm font-medium leading-6 text-muted-foreground">{config.description}</p>
          {user.registrationReviewNote && (
            <div className="rounded-2xl border border-primary/10 bg-muted/30 p-4 text-left">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Бележка от администратор</p>
              <p className="text-sm font-medium text-foreground">{user.registrationReviewNote}</p>
            </div>
          )}
          <div className="rounded-2xl border border-primary/10 bg-muted/20 p-4 text-left text-sm">
            <p><span className="font-black">Потребител:</span> {user.firstName} {user.lastName}</p>
            <p><span className="font-black">Имейл:</span> {user.email}</p>
            <p><span className="font-black">Роля:</span> {user.role}</p>
            <p><span className="font-black">Училище:</span> {user.school}</p>
          </div>
          <Button onClick={logout} variant="outline" className="rounded-xl font-bold">
            Изход от профила
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegistrationStatus;
