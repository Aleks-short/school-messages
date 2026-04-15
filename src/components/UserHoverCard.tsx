import React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { UserRole, TeacherType, ROLE_LABELS } from '@/types';
import { School, BookOpen, User, GraduationCap } from 'lucide-react';

interface UserHoverCardProps {
  children: React.ReactNode;
  user: {
    name: string;
    role?: UserRole;
    school?: string;
    class?: string;
    teacherType?: TeacherType;
    subject?: string;
  };
}

const UserHoverCard: React.FC<UserHoverCardProps> = ({ children, user }) => {
  if (!user.role) {
    return <>{children}</>;
  }

  const isTeacher = user.role === 'teacher';
  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const showClass = user.class && (user.role === 'student' || (isTeacher && user.teacherType === 'class'));

  return (
    <HoverCard openDelay={0} closeDelay={200}>
      <HoverCardTrigger asChild>
        <span className="cursor-help underline-offset-4 hover:underline decoration-muted-foreground/50">
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <div className="bg-primary/10 p-2 rounded-full">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">{user.name}</h4>
              <p className="text-xs text-muted-foreground">
                {isTeacher && user.teacherType === 'class' ? 'Класен ръководител' :
                  isTeacher && user.teacherType === 'regular' ? 'Редовен учител' :
                    roleLabel}
              </p>
            </div>
          </div>

          {user.school && user.role !== 'admin' && (
            <div className="flex items-start gap-2 text-sm">
              <School className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span>{user.school}</span>
            </div>
          )}

          {showClass && (
            <div className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span>Клас: {user.class}</span>
            </div>
          )}

          {isTeacher && user.subject && (
            <div className="flex items-start gap-2 text-sm">
              <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs leading-none mb-1">
                  Предмет{user.subject.includes(',') ? 'и' : ''}:
                </span>
                <span>{user.subject}</span>
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default UserHoverCard;
