import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMessages } from '@/contexts/MessagesContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/contexts/AuditLogContext';
import { CATEGORY_LABELS, STATUS_LABELS, IMPORTANCE_LABELS, ROLE_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Download,
  Trash2, Archive, ArchiveRestore, Send, Check,
  Edit, MessageSquare, AlertCircle, Paperclip, AlertTriangle, CheckCircle2, Clock, Link, X, Users
} from 'lucide-react';
import { SERVER_URL, messagesApi, readStatusesApi } from '@/lib/api';
import UserHoverCard from '@/components/UserHoverCard';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import { toast } from 'sonner';
import FileUploader from '@/components/FileUploader';
import { Attachment, Message } from '@/types';
import AudienceDisplay from '@/components/AudienceDisplay';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

const UPLOADS_DIR = 'uploads';

const getMessageIdFromPath = (value?: string) => value ? value.replace(/^m/, '') : '';

const MessageDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    messages, markAsRead, confirmRead, isConfirmed,
    deleteMessage, setMessageStatus,
    addComment, deleteComment, updateComment, toggleArchive, isArchived, getArchivedAt, refreshArchives, getUserArchivedMessages
  } = useMessages();
  const [searchParams] = useSearchParams();
  const isArchiveView = searchParams.get('archive') === 'true';
  const { markAsReadByMessage } = useNotifications();
  const { user, allUsers } = useAuth();
  const { addEntry } = useAuditLog();
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<Attachment[]>([]);
  const [commentLinks, setCommentLinks] = useState<string[]>([]);
  const [messageReaders, setMessageReaders] = useState<any[]>([]); // New state for all readers
  const [commentLinkUrl, setCommentLinkUrl] = useState('');
  const [showCommentInteractive, setShowCommentInteractive] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string, name: string } | null>(null);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<Message | null>(null);
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);
  const [messageLoadFailed, setMessageLoadFailed] = useState(false);

  const archivedMessages = getUserArchivedMessages();
  const contextMessage = isArchiveView
    ? archivedMessages.find(m => m.id === id)
    : messages.find(m => m.id === id);
  const resolvedMessageId = getMessageIdFromPath(id);
  const displayMessage = contextMessage || fallbackMessage;
  const shouldLoadMessage = !contextMessage && Boolean(resolvedMessageId);

  useEffect(() => {
    const loadMessage = async () => {
      if (contextMessage || !resolvedMessageId) {
        setIsLoadingMessage(false);
        setMessageLoadFailed(false);
        return;
      }
      setMessageLoadFailed(false);
      setIsLoadingMessage(true);
      try {
        const fetched = await messagesApi.getById(resolvedMessageId);
        setFallbackMessage(fetched || null);
      } catch (err) {
        console.error('Failed to load message by id:', err);
        setFallbackMessage(null);
        setMessageLoadFailed(true);
      } finally {
        setIsLoadingMessage(false);
      }
    };

    loadMessage();
  }, [contextMessage, resolvedMessageId]);

  const isAuthor = user?.id === displayMessage?.authorId;
  const isAdmin = user && ['admin', 'director'].includes(user?.role || '');

  useEffect(() => {
    if (displayMessage && displayMessage.status === 'published' && !isArchiveView) {
      markAsRead(displayMessage.id);
      markAsReadByMessage(displayMessage.id);
    }
  }, [displayMessage, isArchiveView, markAsRead, markAsReadByMessage]);

  // Fetch all readers if authorized
  useEffect(() => {
    const fetchReaders = async () => {
      if (displayMessage && (isAdmin || isAuthor)) {
        try {
          const data = await readStatusesApi.getByMessage(displayMessage.id);
          setMessageReaders(data);
        } catch (err) {
          console.error("Failed to fetch readers:", err);
        }
      }
    };
    fetchReaders();
  }, [displayMessage, isAdmin, isAuthor]);

  if (!displayMessage && !messageLoadFailed && (isLoadingMessage || shouldLoadMessage)) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Зареждане на съобщението...</p>
      </div>
    );
  }

  if (!displayMessage) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Съобщението не е намерено</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/messages')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Назад
        </Button>
      </div>
    );
  }

  const message = displayMessage;

  const needsConfirmation = displayMessage.importance === 'high';
  const comments = displayMessage.comments || [];
  const archived = isArchived(displayMessage.id);
  const archivedDate = getArchivedAt(displayMessage.id);

  const canDeleteComment = (commentAuthorId: string) => {
    if (!user) return false;
    if (user.id === commentAuthorId) return true; // Автора на коментара (including Teachers deleting their own)
    if (isAuthor) return true; // Автора на съобщението
    if (user.role === 'admin') return true; // Администратор
    
    const commentAuthor = allUsers.find(u => u.id === commentAuthorId);
    
    if (user.role === 'director') {
      if (commentAuthor && commentAuthor.role === 'admin') return false;
      if (commentAuthor && commentAuthor.school === user.school) return true;
    }
    
    if (user.role === 'teacher') {
      // Учителите могат да трият коментари на ученици
      if (commentAuthor && commentAuthor.role === 'student' && commentAuthor.school === user.school) return true;
    }
    
    return false;
  };

  const renderCommentContent = (text: string) => {
    const parts = text.split(/^(@[^,]+,\s)/);
    if (parts.length > 1) {
      return (
        <p className="text-sm whitespace-pre-wrap">
          <span className="text-primary font-semibold">{parts[1]}</span>
          {parts.slice(2).join('')}
        </p>
      );
    }
    return <p className="text-sm whitespace-pre-wrap">{text}</p>;
  };

  const handleDelete = async () => {
    addEntry({
      action: 'Изтриване на съобщение',
      performedBy: user!.id,
      performedByName: `${user!.firstName} ${user!.lastName}`,
      performedBySchool: user!.school,
      targetType: 'message',
      targetId: message.id,
      details: `Изтрито съобщение "${message.title}"`,
      targetData: JSON.stringify({ ...message, comments: [] }) // Store message without comments for restoration if needed
    });
    await deleteMessage(message.id);
    toast.success('Съобщението е изтрито');
    navigate('/messages');
  };

  const handleDeleteComment = async (commentId: string) => {
    const comment = message.comments?.find(c => c.id === commentId);
    if (comment) {
      addEntry({
        action: 'Изтрит коментар',
        performedBy: user!.id,
        performedByName: `${user!.firstName} ${user!.lastName}`,
        performedBySchool: user!.school,
        targetType: 'comment',
        targetId: commentId,
        details: `Изтрит коментар от ${comment.authorName}`,
        targetData: JSON.stringify(comment)
      });
    }
    await deleteComment(commentId);
    toast.success('Коментарът е изтрит');
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    await updateComment(commentId, editingCommentText.trim());
    toast.success('Коментарът е обновен');
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleReply = (authorName: string) => {
    setCommentText(`@${authorName}, `);
    const textarea = document.querySelector('textarea');
    if (textarea) textarea.focus();
  };

  const handleArchive = async (force: boolean = false) => {
    if (needsConfirmation && !isConfirmed(message.id)) {
      toast.error('Не можете да архивирате важно съобщение, преди да сте го потвърдили!', {
        description: 'Моля, натиснете бутона "Потвърди" по-горе първо.',
        icon: <AlertCircle className="h-5 w-5 text-destructive" />
      });
      return;
    }

    const wasArchived = archived;

    if (wasArchived && !force) {
      const archivedAt = getArchivedAt(message.id);
      if (archivedAt) {
        const archivedTime = new Date(archivedAt).getTime();
        const lastMsgUpdate = new Date(message.updatedAt).getTime();
        const lastCommentTime = message.comments && message.comments.length > 0
          ? Math.max(...message.comments.map(c => new Date(c.createdAt).getTime()))
          : 0;

        if (lastMsgUpdate <= archivedTime && lastCommentTime <= archivedTime) {
          toast.info("Архивът вече е актуален. Няма нови промени за обновяване.");
          return;
        }
      }
    }

    const { alreadyArchived, success } = await toggleArchive(message.id, force);

    if (alreadyArchived && !force) {
      setShowOverwriteDialog(true);
      return;
    }

    if (success) {
      if (!wasArchived && user) {
        toast.success('Съобщението е преместено в личния ви архив');
      } else if (wasArchived && force) {
        toast.success('Архивът е обновен с новата версия на съобщението');
      } else if (wasArchived && !force) {
        // This was actually an unarchive (restore) if toggleArchive deleted it.
        // Wait, our toggleArchive in MessagesContext handles both.
        // If it was already archived and we didn't force, it returned alreadyArchived: true.
      }
    }
  };

  const handleUnarchive = async () => {
    // We need a specific unarchive method if we want to separate "Update Snapshot" from "Restore"
    // For now let's use a dedicated call if we can.
    await messagesApi.unarchive(message.id);
    await refreshArchives();
    toast.success('Съобщението е върнато в общия поток');
  };

  const handlePublish = () => {
    addEntry({
      action: 'Публикуване на съобщение',
      performedBy: user!.id,
      performedByName: `${user!.firstName} ${user!.lastName}`,
      performedBySchool: user!.school,
      targetType: 'message',
      targetId: message.id,
      details: `Ръчно публикувано съобщение "${message.title}"${message.importance === 'high' ? ' (Важно)' : ''}`,
    });
    setMessageStatus(message.id, 'published');
    toast.success('Съобщението е публикувано');
  };

  const addCommentAsLink = () => {
    if (!commentLinkUrl.trim()) {
      toast.error('Моля, въведете валиден линк');
      return;
    }
    const formattedLink = commentLinkUrl.startsWith('http') ? commentLinkUrl : `https://${commentLinkUrl}`;
    setCommentLinks(prev => [...prev, formattedLink]);
    setCommentLinkUrl('');
    toast.success('Линкът е добавен към коментара');
  };

  const handleAddComment = async () => {
    if (!commentText.trim() && commentAttachments.length === 0 && commentLinks.length === 0) return;
    await addComment(message.id, commentText.trim(), commentAttachments, commentLinks);
    
    if (user) {
      addEntry({
        action: 'Добавен коментар',
        performedBy: user.id,
        performedByName: `${user.firstName} ${user.lastName}`,
        performedBySchool: user.school,
        targetType: 'comment',
        targetId: message.id, // Reference message ID since comment ID is not easily available here
        details: `Потребителят коментира съобщение "${message.title}"`,
      });
    }

    setCommentText('');
    setCommentAttachments([]);
    setCommentLinks([]);
    setShowCommentInteractive(false);
    setCommentLinkUrl('');
    toast.success('Коментарът е добавен');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url.startsWith('http') ? url : `${SERVER_URL}${url}`);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Грешка при изтегляне на файла');
    }
  };

  const canDeleteMessage = user && (
    isAuthor ||
    user.role === 'admin' ||
    (user.role === 'director' && message.authorRole !== 'admin' && message.authorSchool === user.school) ||
    (user.role === 'teacher' && user.teacherType === 'class' && message.authorRole === 'student' && message.authorClass === user.class && message.authorSchool === user.school)
  );

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Назад
      </Button>

      <Card className="rounded-[2rem] border-primary/10 bg-gradient-to-br from-card to-secondary/20 shadow-xl overflow-hidden relative">
        {/* Importance декоративна лента - преместена вътре за по-добро подравняване */}
        {message.importance === 'high' && (
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-importance-high z-10" />
        )}

        <CardContent className="p-6 md:p-10 relative">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge variant="outline" className="rounded-lg font-bold">{CATEGORY_LABELS[message.category] || message.category}</Badge>
            <Badge variant={message.status === 'published' ? 'default' : 'secondary'} className="rounded-lg font-bold">
              {STATUS_LABELS[message.status]}
            </Badge>
            {archived && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground rounded-lg font-bold">
                <Archive className="h-3 w-3 mr-1" /> Архивирано
              </Badge>
            )}
            {message.importance !== 'normal' && (
              <Badge className={`rounded-lg font-bold ${message.importance === 'high' ? 'bg-importance-high text-primary-foreground' :
                'bg-muted text-muted-foreground'
                }`}>
                {message.importance === 'high' ? (
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                ) : null}
                {IMPORTANCE_LABELS[message.importance]}
              </Badge>
            )}
            <AudienceDisplay 
              message={message} 
              currentUser={user} 
              className="text-xs text-muted-foreground font-bold uppercase tracking-wider" 
            />
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="font-heading text-2xl md:text-3xl font-black mb-3 tracking-tight break-words">{message.title}</h1>

              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap font-medium">
                <span className="flex items-center gap-1.5 max-w-full overflow-hidden">
                  <span className="shrink-0">От:</span>
                  <UserHoverCard user={{ name: message.authorName, role: message.authorRole, school: message.authorSchool, class: message.authorClass, teacherType: message.authorTeacherType, subject: message.authorSubject }}>
                    <span className="text-foreground font-bold hover:underline cursor-pointer truncate block max-w-[150px] md:max-w-[250px]" title={message.authorName}>{message.authorName}</span>
                  </UserHoverCard>
                </span>
                <span className="text-muted-foreground/30">|</span>
                <span>Публикувано: <span className="text-foreground/80">{format(new Date(message.createdAt), 'd MMMM yyyy, HH:mm', { locale: bg })}</span></span>
                {message.editHistory && message.editHistory.length > 0 && (
                  <>
                    <span className="text-muted-foreground/30">|</span>
                    <span className="text-accent font-bold flex items-center gap-1.5 bg-accent/5 px-2 py-0.5 rounded-lg border border-accent/10">
                      <Edit className="h-3.5 w-3.5" />
                      Редактирано: {format(new Date(message.updatedAt), 'd MMMM yyyy, HH:mm', { locale: bg })}
                    </span>
                  </>
                )}
                {archived && archivedDate && (
                  <span className="text-secondary-foreground font-bold flex items-center gap-1.5 bg-secondary/30 px-2 py-0.5 rounded-lg border border-primary/5">
                    <Clock className="h-3.5 w-3.5" /> Архивирано на: {format(new Date(archivedDate), 'd MMMM yyyy, HH:mm', { locale: bg })}
                  </span>
                )}
              </div>
            </div>

            {needsConfirmation && (
              <div className={`flex items-center gap-3 p-4 md:p-5 -ml-2 md:-ml-3 rounded-2xl border transition-all ${isConfirmed(message.id)
                ? 'bg-success/5 text-success border-success/20'
                : 'bg-importance-high/10 text-importance-high border-importance-high/30 shadow-sm'
                }`}>
                {isConfirmed(message.id) ? (
                  <>
                    <div className="p-2 bg-success/10 rounded-xl">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wide">Прочитането е потвърдено</span>
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-importance-high/20 rounded-xl">
                      <AlertTriangle className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold leading-tight">Изисква потвърждение за прочитане</p>
                      <p className="text-[10px] uppercase font-black tracking-widest opacity-70 mt-0.5">Важно съобщение</p>
                    </div>
                    <Button 
                      size="sm" 
                      className="rounded-xl font-black bg-importance-high text-primary-foreground hover:scale-105 active:scale-95 transition-all shadow-md px-6 shadow-importance-high/20" 
                      onClick={() => { 
                        confirmRead(message.id); 
                        addEntry({
                          action: 'Потвърждаване на важно съобщение',
                          performedBy: user!.id,
                          performedByName: `${user!.firstName} ${user!.lastName}`,
                          performedBySchool: user!.school,
                          targetType: 'message',
                          targetId: message.id,
                          details: `Потребителят потвърди прочитането на важно съобщение "${message.title}"`,
                        });
                        toast.success('Потвърдихте прочитането'); 
                      }}
                    >
                      Потвърди
                    </Button>
                  </>
                )}
              </div>
            )}

            <div
              className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap break-words [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:font-bold [&_a]:underline [&_hr]:my-6 [&_hr]:border-border/50"
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          </div>

          {message.links && message.links.length > 0 && (
            <div className="border-t pt-6 mb-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Link className="h-4 w-4" /> Външни препратки
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {message.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-all group overflow-hidden"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Link className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-primary font-medium truncate flex-1 hover:underline">
                      {link.replace(/^https?:\/\//, '')}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {message.attachments.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Прикачени файлове ({message.attachments.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {message.attachments.map(att => {
                  const cleanedPath = att.path ? (att.path.startsWith(`${UPLOADS_DIR}/`) ? att.path.replace(`${UPLOADS_DIR}/`, '') : att.path) : '';
                  const attUrl = att.url || `/${UPLOADS_DIR}/${cleanedPath}`;
                  return (
                    <div key={att.id} className="flex flex-col bg-card border border-primary/10 rounded-2xl overflow-hidden hover:border-primary/25 hover:shadow-lg transition-all duration-300 group max-w-full sm:max-w-[300px]">
                      {att.type.startsWith('image/') && (
                        <div
                          className="h-32 sm:h-40 relative overflow-hidden bg-black/5 flex items-center justify-center border-b border-muted-foreground/5 p-4 cursor-pointer hover:bg-black/10 transition-colors"
                          onClick={() => setPreviewImage({ url: attUrl.startsWith('http') ? attUrl : `${SERVER_URL}${attUrl}`, name: att.name })}
                        >
                          <img
                            src={attUrl.startsWith('http') ? attUrl : `${SERVER_URL}${attUrl}`}
                            alt={att.name}
                            className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105 bg-white p-1 rounded shadow-sm"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between p-3.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors shrink-0">
                            <Paperclip className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold truncate leading-tight" title={att.name}>{att.name}</p>
                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{formatFileSize(att.size)}</p>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-lg bg-background shadow-sm border shrink-0"
                          onClick={() => handleDownload(attUrl, att.name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* Read status section */}
          {(isAdmin || isAuthor) && messageReaders.length > 0 && (() => {
            // Filter readers based on importance
            const displayReaders = message.importance === 'high' 
              ? messageReaders.filter(r => r.confirmed) 
              : messageReaders;
            
            if (displayReaders.length === 0) return null;

            return (
              <div className="border-t border-primary/5 pt-5 mt-5">
                <h3 className="text-sm font-black mb-4 uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <span className="p-1 px-1.5 bg-secondary/40 rounded-lg">
                    {message.importance === 'high' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  </span>
                  {message.importance === 'high' ? 'Потвърдено от' : 'Прочетено от'} ({displayReaders.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {displayReaders.map(r => {
                    const readerUser = allUsers.find(u => u.id === r.userId);
                    return (
                      <span key={r.userId} className="inline-flex items-center gap-1.5 text-xs font-bold bg-secondary/60 pl-1 pr-3 py-1 rounded-full border border-primary/5 hover:border-primary/20 hover:bg-secondary/80 transition-all cursor-help">
                        {readerUser ? (
                          <UserHoverCard user={{ 
                            name: `${readerUser.firstName} ${readerUser.lastName}`, 
                            role: readerUser.role, 
                            school: readerUser.school, 
                            class: readerUser.class, 
                            teacherType: readerUser.teacherType, 
                            subject: readerUser.subject 
                          }}>
                            <span className="px-2 py-0.5">{readerUser.firstName} {readerUser.lastName}</span>
                          </UserHoverCard>
                        ) : (
                          <span className="px-2 py-0.5">{r.userName || r.userId}</span>
                        )}
                        {r.confirmed && <CheckCircle2 className="h-3 w-3 text-success" />}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Action buttons */}
          <div className="border-t border-primary/5 pt-5 mt-6 flex flex-wrap gap-2">
            {message.status === 'draft' && isAuthor && (
              <Button onClick={handlePublish} size="sm" className="rounded-xl font-bold gap-2 shadow-sm hover:scale-105 active:scale-95 transition-all">
                <Send className="h-4 w-4" /> Публикувай
              </Button>
            )}

            {archived ? (
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-xl border border-success/20">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-bold">Архивирано</span>
                </div>
                {isArchiveView && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleUnarchive}
                    className="flex-1 sm:flex-none rounded-xl font-bold gap-2 hover:scale-105 active:scale-95 transition-all"
                  >
                    <ArchiveRestore className="h-4 w-4" /> Разархивирай
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleArchive(false)}
                  className="flex-1 sm:flex-none rounded-xl font-bold gap-2 hover:scale-105 active:scale-95 transition-all text-destructive border-destructive/20 hover:bg-destructive/5"
                >
                  <Archive className="h-4 w-4" /> Обнови архив
                </Button>
              </div>
            ) : (
              <>
                {message.status === 'published' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArchive(false)}
                    className={`flex-1 sm:flex-none rounded-xl font-bold gap-2 hover:scale-105 active:scale-95 transition-all ${needsConfirmation && !isConfirmed(message.id) ? 'opacity-70 border-dashed' : ''}`}
                  >
                    {needsConfirmation && !isConfirmed(message.id) ? (
                      <AlertCircle className="h-4 w-4 text-importance-high" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                    Архивирай
                  </Button>
                )}
              </>
            )}

            {/* Editing and Deletion actions - always available in live view for authors/admins */}
            {!isArchiveView && (
              <>
                {isAuthor && (
                  <Button variant="outline" size="sm" onClick={() => navigate(`/edit/${message.id}`)} className="rounded-xl font-bold gap-2 hover:scale-105 active:scale-95 transition-all">
                    <Edit className="h-4 w-4" /> Редактирай
                  </Button>
                )}

                {canDeleteMessage && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="rounded-xl font-bold gap-2 hover:scale-105 active:scale-95 transition-all">
                        <Trash2 className="h-4 w-4" /> Изтрий
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2rem] border-primary/10">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-heading font-black">Сигурни ли сте?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Това действие ще премахне съобщението за постоянно. Това не може да бъде отменено.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Отказ</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Изтрий
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comments section */}
      {message.commentsEnabled && (message.status === 'published' || isArchiveView) && (
        <Card className="mt-4 rounded-[1.75rem] border-primary/10 bg-gradient-to-br from-card to-secondary/10 shadow-lg overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <h3 className="font-heading text-lg font-black mb-5 flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              Коментари
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-black bg-primary text-primary-foreground">
                {comments.length}
              </span>
            </h3>

            {/* Add comment - only visible if NOT viewing an archive snapshot */}
            {!isArchiveView ? (
              (() => {
                const cannotComment = needsConfirmation && !isConfirmed(message.id);
                if (cannotComment) {
                  return (
                    <div className="mb-6 p-6 rounded-2xl bg-importance-high/5 border border-importance-high/20 text-center space-y-3">
                      <div className="p-3 rounded-2xl bg-importance-high/10 w-fit mx-auto shadow-sm">
                        <AlertTriangle className="h-6 w-6 text-importance-high animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-importance-high uppercase tracking-tight">Коментарите са временно ограничени</p>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                          Трябва да потвърдите прочитането на това важно съобщение, преди да можете да оставяте коментари.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="mb-6 p-4 rounded-2xl bg-secondary/30 border border-primary/5">
                    <Textarea
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Напишете коментар..."
                      rows={3}
                      maxLength={1000} autoResize
                      className="rounded-2xl border-primary/20 bg-card/60 focus:border-primary/40"
                    />
                    <div className="mt-3 space-y-3">
                      {/* Comment Links Visualizer */}
                      {commentLinks.length > 0 && (
                        <div className="flex flex-col gap-2 p-3 bg-primary/5 rounded-2xl border border-primary/10">
                          <span className="text-xs font-black text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                            <Link className="h-3 w-3" /> Външни препратки:
                          </span>
                          {commentLinks.map((link, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-card p-2 rounded-xl border border-primary/10">
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate flex-1 text-primary hover:underline font-bold"
                              >
                                {link}
                              </a>
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-muted-foreground hover:text-destructive shrink-0" onClick={() => setCommentLinks(prev => prev.filter((_, i) => i !== idx))}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <FileUploader
                        attachments={commentAttachments}
                        onAttachmentsChange={setCommentAttachments}
                      />

                      {/* Interactive block toggle */}
                      <div className="flex gap-2 items-center flex-wrap">
                        <Button variant="outline" size="sm" type="button" onClick={() => setShowCommentInteractive(!showCommentInteractive)} className="text-xs shrink-0 rounded-xl font-bold border-primary/20 hover:border-primary/40">
                          <Link className="h-3 w-3 mr-1.5" /> Добави линк
                        </Button>
                      </div>

                      {showCommentInteractive && (
                        <div className="p-4 border border-primary/10 rounded-2xl bg-secondary/20 flex flex-col gap-3 animate-fade-in">
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <Input
                              placeholder="Въведете URL адрес (напр. https://example.com)..."
                              value={commentLinkUrl}
                              onChange={e => setCommentLinkUrl(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addCommentAsLink();
                                }
                              }}
                              className="text-sm bg-card rounded-xl border-primary/20 h-9 min-w-[200px]"
                            />
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                              <Button type="button" variant="secondary" size="sm" onClick={addCommentAsLink} className="h-9 rounded-xl font-bold whitespace-nowrap flex-1 sm:flex-none" disabled={!commentLinkUrl.trim()}>
                                <Link className="h-3 w-3 mr-1.5" /> Ок
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      <Button size="sm" onClick={handleAddComment} disabled={!commentText.trim() && commentAttachments.length === 0 && commentLinks.length === 0} className="rounded-xl font-bold gap-2 hover:scale-105 active:scale-95 transition-all">
                        <Send className="h-4 w-4" /> Коментирай
                      </Button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="mb-5 p-5 bg-secondary/20 rounded-2xl text-center text-sm text-muted-foreground border border-primary/5">
                <div className="p-3 rounded-2xl bg-secondary/30 w-fit mx-auto mb-2">
                  <Archive className="h-5 w-5 opacity-50" />
                </div>
                {isArchiveView
                  ? 'Това е статичен отпечатък от съобщението и не може да бъде коментиран'
                  : 'Архивът на съобщението не може да бъде коментиран през архивната секция'}
              </div>
            )}

            {/* Comments list */}
            {comments.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-4 rounded-2xl bg-secondary/20 w-fit mx-auto mb-3">
                  <MessageSquare className="h-6 w-6 opacity-30" />
                </div>
                <p className="text-sm text-muted-foreground font-bold">Няма коментари все още</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="p-4 bg-secondary/20 rounded-2xl border border-primary/5 hover:border-primary/10 hover:bg-secondary/30 transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-foreground">
                          <UserHoverCard user={{ name: c.authorName, role: c.authorRole, school: c.authorSchool, class: c.authorClass, teacherType: c.authorTeacherType, subject: c.authorSubject }}>
                            {c.authorName}
                          </UserHoverCard>
                        </span>
                        <Badge variant="outline" className="text-[10px] px-2 py-0 rounded-full font-bold border-primary/20">
                          {ROLE_LABELS[c.authorRole]}
                        </Badge>
                        <span className="text-[10px] font-bold text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
                          {format(new Date(c.createdAt), 'd MMM, HH:mm', { locale: bg })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!archived && isAuthor && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] rounded-lg font-bold" onClick={() => handleReply(c.authorName)}>
                            Отговори
                          </Button>
                        )}

                        {!archived && user?.id === c.authorId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-lg text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditingCommentText(c.content);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}

                        {!archived && canDeleteComment(c.authorId) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[2rem] border-primary/10">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-heading font-black">Изтриване на коментар</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Сигурни ли сте, че искате да изтриете този коментар?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Отказ</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteComment(c.id)} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Изтрий
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="mt-2">
                        <Textarea
                          value={editingCommentText}
                          onChange={e => setEditingCommentText(e.target.value)}
                          className="text-sm bg-card rounded-2xl border-primary/20 mb-2"
                          rows={2} autoResize
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs rounded-lg font-bold" onClick={() => handleUpdateComment(c.id)}>
                            Запази
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={() => setEditingCommentId(null)}>
                            Отказ
                          </Button>
                        </div>
                      </div>
                    ) : (
                      renderCommentContent(c.content)
                    )}

                    {/* Comment links */}
                    {c.links && c.links.length > 0 && (
                      <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-primary/5">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Link className="h-2.5 w-2.5" /> Външни препратки
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {c.links.map((link, lidx) => (
                            <a key={lidx} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 hover:bg-primary/15 border border-primary/20 rounded-xl py-1 px-2.5 transition-all font-bold max-w-full">
                              <Link className="h-3 w-3 shrink-0" />
                              <span className="truncate">{link.replace(/^https?:\/\//, '')}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Comment attachments */}
                    {c.attachments && c.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-primary/5">
                        {c.attachments.map(ca => {
                          const caUrl = ca.url || `/uploads/${ca.path}`;
                          return (
                            <button
                              key={ca.id}
                              onClick={() => handleDownload(caUrl, ca.name)}
                              className="flex items-center gap-1.5 text-[10px] font-bold bg-secondary/40 hover:bg-secondary/70 rounded-xl px-2.5 py-1 border border-primary/10 transition-colors"
                            >
                              <Paperclip className="h-3 w-3" />
                              <span className="max-w-[120px] truncate">{ca.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!message.commentsEnabled && message.status === 'published' && (
        <Card className="mt-4 rounded-[1.75rem] border-primary/10 bg-card/50">
          <CardContent className="p-5 text-center text-muted-foreground text-sm">
            <div className="p-3 rounded-2xl bg-secondary/40 w-fit mx-auto mb-2">
              <MessageSquare className="h-5 w-5 opacity-40" />
            </div>
            Коментарите са изключени за това съобщение
          </CardContent>
        </Card>
      )}

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[fit-content] border-0 p-0 overflow-visible bg-transparent shadow-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Визуализация на изображение</DialogTitle>
            <DialogDescription>Преглед на изображението</DialogDescription>
          </DialogHeader>
          <div className="relative flex items-center justify-center">
            {previewImage && (
              <>
                <img
                  src={previewImage.url}
                  alt={previewImage.name}
                  className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl bg-white border-2 select-none"
                />
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="absolute -top-3 -right-3 z-[60] flex items-center justify-center h-7 w-7 bg-destructive text-destructive-foreground border-2 border-background rounded-full shadow-lg hover:bg-destructive/90 hover:scale-110 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Overwrite Archive Confirmation Dialog */}
      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent className="rounded-[2.5rem] border-primary/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-black text-2xl">Обновяване на архива</AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium">
              Вече имате това съобщение в личния си архив. Искате ли да го подмените с текущата му версия (с всички нови коментари и промени)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-2xl h-12 font-bold px-6">Отказ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleArchive(true)}
              className="rounded-2xl h-12 font-black px-8 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Да, поднови архива
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default MessageDetail;
