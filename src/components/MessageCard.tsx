import React from 'react';
import { Message, CATEGORY_LABELS, STATUS_LABELS, AUDIENCE_LABELS, IMPORTANCE_LABELS, MessageImportance } from '@/types';
import AudienceDisplay from '@/components/AudienceDisplay';
import { Badge } from '@/components/ui/badge';
import { Paperclip, Clock, AlertTriangle, Edit, MessageSquare, Archive } from 'lucide-react';
import { useMessages } from '@/contexts/MessagesContext';
import { useAuth } from '@/contexts/AuthContext';
import UserHoverCard from '@/components/UserHoverCard';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  message: Message;
  isRead: boolean;
}

const categoryColors: Record<string, string> = {
  system: 'bg-red-500/10 text-red-600',
  general: 'bg-primary/10 text-primary',
  administrative: 'bg-blue-500/10 text-blue-600',
  academic: 'bg-green-500/10 text-green-600',
  personal: 'bg-purple-500/10 text-purple-600',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-success/15 text-success',
  archived: 'bg-secondary text-secondary-foreground',
};

const importanceStyles: Record<MessageImportance, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-primary/10 text-primary',
  high: 'bg-importance-high/15 text-importance-high font-semibold',
};

const MessageCard: React.FC<Props> = ({ message, isRead }) => {
  const isHighImportance = message.importance === 'high';
  const attachmentCount = message.attachments?.length ?? 0;
  const commentCount = message.comments?.length ?? 0;
  const { isArchived } = useMessages();
  const { user } = useAuth();
  const archived = isArchived(message.id);

  return (
    <Link
      to={`/messages/${message.id}`}
      className={`
        group block rounded-[1.75rem] border p-5 md:p-6
        transition-all duration-300
        hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]
        relative hover:z-10
        animate-fade-in
        ${isHighImportance
          ? 'border-importance-high/40 border-l-4 border-l-importance-high bg-importance-high/5 shadow-md shadow-importance-high/5'
          : !isRead
            ? 'border-primary/10 bg-card shadow-md ring-1 ring-primary/5'
            : 'bg-card/40 border-transparent text-muted-foreground'
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${categoryColors[message.category]}`}>
              {CATEGORY_LABELS[message.category] || message.category}
            </span>
            <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${statusColors[message.status]}`}>
              {STATUS_LABELS[message.status]}
            </span>
            {message.importance !== 'normal' && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${importanceStyles[message.importance]}`}>
                {isHighImportance && <AlertTriangle className="h-3 w-3" />}
                {IMPORTANCE_LABELS[message.importance]}
              </span>
            )}
            {!isRead && message.status === 'published' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[9px] font-black uppercase tracking-tighter">Ново</span>
              </div>
            )}
            {archived && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                <Archive className="h-2.5 w-2.5" />
                <span className="text-[9px] font-black uppercase tracking-tighter">Архивирано</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className={`text-base font-black truncate mb-1 ${!isRead ? 'text-foreground' : 'text-foreground/70'}`}>
            {isHighImportance && '⚠ '}{message.title}
          </h3>

          {/* Content preview */}
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed whitespace-pre-wrap" title={message.content.replace(/<[^>]*>/g, '').trim()}>
            {message.content
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
              .replace(/<[^>]*>/g, '')
              .trim()}
          </p>
        </div>

        {/* ── Right-column interactive icons ── */}
        <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
          {/* Attachments — amber/orange */}
          {attachmentCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="
                    flex items-center gap-1 px-2 py-1 rounded-xl
                    bg-amber-500/10 text-amber-500 text-xs font-semibold
                    transition-all duration-200
                    group-hover:bg-amber-500/20 group-hover:text-amber-400
                  "
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{attachmentCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-amber-500/30 text-amber-500 font-bold">
                <p>{attachmentCount} прикачен{attachmentCount === 1 ? '' : 'и'} файл{attachmentCount === 1 ? '' : 'а'}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Comments — green */}
          {commentCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="
                    flex items-center gap-1 px-2 py-1 rounded-xl
                    bg-emerald-500/10 text-emerald-500 text-xs font-semibold
                    transition-all duration-200
                    group-hover:bg-emerald-500/20 group-hover:text-emerald-400
                  "
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{commentCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-emerald-500/30 text-emerald-500 font-bold">
                <p>{commentCount} коментар{commentCount === 1 ? '' : 'а'}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Footer meta ── */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
        <span className="font-bold">
          <UserHoverCard user={{ name: message.authorName, role: message.authorRole, school: message.authorSchool, class: message.authorClass, teacherType: message.authorTeacherType, subject: message.authorSubject }}>
            От: {message.authorName}
          </UserHoverCard>
        </span>
        <span className="flex items-center gap-1 font-bold">
          <Clock className="h-3 w-3" />
          Публикувано: {format(new Date(message.createdAt), 'd MMM yyyy, HH:mm', { locale: bg })}
        </span>
        {message.editHistory && message.editHistory.length > 0 && (
          <span className="flex items-center gap-1 text-accent font-black">
            <Edit className="h-3 w-3" />
            Редактирано: {format(new Date(message.updatedAt), 'd MMM yyyy, HH:mm', { locale: bg })}
          </span>
        )}
        <AudienceDisplay 
          message={message} 
          currentUser={user} 
          className="font-bold" 
        />

        {attachmentCount === 0 && commentCount === 0 && message.attachments.length > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {message.attachments.length}
          </span>
        )}
      </div>
    </Link>
  );
};

export default MessageCard;
