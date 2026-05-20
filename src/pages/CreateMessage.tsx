import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMessages } from '@/contexts/MessagesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { MessageCategory, MessageStatus, MessageImportance, TargetAudience, Attachment, CATEGORY_LABELS, IMPORTANCE_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, X, Send, MessageSquare, Link, QrCode as QrIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { metadataApi, uploadsApi } from '@/lib/api';
import AudienceSelector from '@/components/AudienceSelector';
import FileUploader from '@/components/FileUploader';
import RichTextEditor from '@/components/RichTextEditor';

const CreateMessage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { messages, createMessage, updateMessage } = useMessages();
  const { user, allUsers } = useAuth();
  const { addNotification, replaceNotificationForMessage } = useNotifications();

  const editing = id ? messages.find(m => m.id === id) : null;

  const [title, setTitle] = useState(editing?.title || '');
  const [content, setContent] = useState(editing?.content || '');
  const [category, setCategory] = useState<MessageCategory>(editing?.category || 'general');
  const [importance, setImportance] = useState<MessageImportance>(editing?.importance || 'normal');
  const [audience, setAudience] = useState<TargetAudience>(editing?.targetAudience || 'all');
  const [attachments, setAttachments] = useState<Attachment[]>(editing?.attachments || []);
  const [commentsEnabled, setCommentsEnabled] = useState(editing?.commentsEnabled ?? true);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [links, setLinks] = useState<string[]>(editing?.links || []);
  const [linkUrl, setLinkUrl] = useState('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [showInteractiveOptions, setShowInteractiveOptions] = useState(false);
  const [initialStatesSet, setInitialStatesSet] = useState(false);

  const getFinalAudience = useCallback(() => {
    if (audience === 'students') {
      if (selectedClass && selectedClass !== 'all_classes') {
        if (selectedPersonIds.length > 0) {
          return selectedPersonIds.length === 1 ? `user:${selectedPersonIds[0]}` : `users:${selectedPersonIds.join(',')}`;
        }
        return `class:${selectedClass}`;
      }
      return 'students';
    }
    if (audience === 'teachers') {
      if (selectedSubject && selectedSubject !== 'all_subjects') {
        if (selectedPersonIds.length > 0) {
          return selectedPersonIds.length === 1 ? `user:${selectedPersonIds[0]}` : `users:${selectedPersonIds.join(',')}`;
        }
        return `subject:${selectedSubject}`;
      }
      return 'teachers';
    }
    if (audience === 'director') {
      if (selectedPersonIds.length > 0) {
        return selectedPersonIds.length === 1 ? `user:${selectedPersonIds[0]}` : `users:${selectedPersonIds.join(',')}`;
      }
      return 'director';
    }
    return audience;
  }, [audience, selectedClass, selectedPersonIds, selectedSubject]);

  // Parse initial audience when editing
  useEffect(() => {
    if (editing && allUsers.length > 0 && !initialStatesSet) {
      const ta = editing.targetAudience;
      if (ta.startsWith('user:')) {
        const userId = ta.replace('user:', '');
        const targetUser = allUsers.find(u => u.id === userId);
        if (targetUser) {
          if (targetUser.role === 'student') {
            setAudience('students');
            setSelectedClass(targetUser.class || '');
            setSelectedPersonIds([userId]);
          } else if (targetUser.role === 'teacher') {
            setAudience('teachers');
            setSelectedSubject(targetUser.subject?.split(', ')[0] || '');
            setSelectedPersonIds([userId]);
          } else if (targetUser.role === 'director') {
            setAudience('director');
            setSelectedPersonIds([userId]);
          }
        }
      } else if (ta.startsWith('users:')) {
        const userIds = ta.replace('users:', '').split(',');
        const firstUser = allUsers.find(u => u.id === userIds[0]);
        if (firstUser) {
          if (firstUser.role === 'student') {
            setAudience('students');
            setSelectedClass(firstUser.class || '');
          } else if (firstUser.role === 'teacher') {
            setAudience('teachers');
            setSelectedSubject(firstUser.subject?.split(', ')[0] || '');
          } else if (firstUser.role === 'director') {
            setAudience('director');
          }
        }
        setSelectedPersonIds(userIds);
      } else if (ta.startsWith('class:')) {
        setAudience('students');
        setSelectedClass(ta.replace('class:', ''));
        setSelectedPersonIds([]);
      } else if (ta.startsWith('subject:')) {
        setAudience('teachers');
        setSelectedSubject(ta.replace('subject:', ''));
        setSelectedPersonIds([]);
      } else if (['all', 'admin', 'director', 'teachers', 'students'].includes(ta)) {
        setAudience(ta as TargetAudience);
        if (ta === 'director') setSelectedPersonIds([]);
      } else if (ta) {
        // Fallback for plain class names
        setAudience('students');
        setSelectedClass(ta);
        setSelectedPersonIds([]);
      }
      setInitialStatesSet(true);
    }
  }, [editing, allUsers, initialStatesSet]);

  // Auto-draft: create a draft automatically when user starts typing (new message only)
  const [draftId, setDraftId] = useState<string | null>(editing?.id || null);
  const draftCreated = useRef(!!editing);
  const draftCreationPromise = useRef<Promise<string | undefined> | null>(null);
  const isPublishing = useRef(false);

  useEffect(() => {
    if (editing || !user) return;
    // Auto-create draft on first meaningful input
    if (!draftCreated.current && (title.trim() || content.trim())) {
      draftCreated.current = true;
      const createDraft = async () => {
        const finalAudience = getFinalAudience();
        const id = await createMessage({
          title: title || '',
          content: content || '',
          category,
          importance,
          status: 'draft' as MessageStatus,
          targetAudience: finalAudience,
          authorId: user.id,
          authorName: `${user.firstName} ${user.lastName}`,
          authorSchool: user.school,
          attachments,
          links,
          commentsEnabled,
          comments: [],
        });
        if (id) {
          setDraftId(id);
        } else {
          draftCreated.current = false;
        }
        return id;
      };
      draftCreationPromise.current = createDraft().finally(() => {
        draftCreationPromise.current = null;
      });
    }
  }, [title, content, editing, user, category, importance, attachments, links, commentsEnabled, getFinalAudience, createMessage]);

  // Auto-save draft updates
  useEffect(() => {
    if (isPublishing.current) return;
    if (!draftId) return;
    const msg = messages.find(m => m.id === draftId);
    if (!msg || msg.status !== 'draft') return;

    const timer = setTimeout(() => {
      if (isPublishing.current) return;
      const finalAudience = getFinalAudience();
      updateMessage(draftId, {
        title, content, category, importance, targetAudience: finalAudience, attachments, links, commentsEnabled,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, content, category, importance, attachments, links, commentsEnabled, draftId, getFinalAudience, messages, updateMessage]);

  const { data: categoryOptions = [] } = useQuery({
    queryKey: ['messageCategories'],
    queryFn: () => metadataApi.getCategories(),
  });

  const allowedCategories = user
    ? categoryOptions.filter(option => user.role === 'admin' || option.key !== 'system')
    : [];

  const notifyTargetUsers = (msgTitle: string, msgId: string, type: 'new_message' | 'edited_message') => {
    if (!user) return;
    const text = type === 'new_message'
      ? `Ново съобщение от ${user.firstName} ${user.lastName}`
      : `Съобщението "${msgTitle}" е редактирано от ${user.firstName} ${user.lastName}`;

    allUsers.forEach(u => {
      if (u.id === user.id) return;
      if (type === 'edited_message') {
        // Replace old notification, mark as unread
        replaceNotificationForMessage(msgId, {
          userId: u.id,
          type,
          messageId: msgId,
          messageTitle: msgTitle,
          text,
        });
      } else {
        addNotification({
          userId: u.id,
          type,
          messageId: msgId,
          messageTitle: msgTitle,
          text,
        });
      }
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Въведете заглавие'); return; }
    // Strip HTML tags to check if there's actual text content
    const textOnly = content.replace(/<[^>]*>/g, '').trim();
    if (!textOnly) { toast.error('Въведете съдържание'); return; }
    if (!user) return;

    isPublishing.current = true;
    const status: MessageStatus = 'published';

    if (editing) {
      const wasPublished = editing.status === 'published';
      const finalAudience = getFinalAudience();
      const success = await updateMessage(editing.id, {
        title, content, category, importance, targetAudience: finalAudience, attachments, links, status,
        commentsEnabled,
      });

      if (success) {
        if (wasPublished) {
          notifyTargetUsers(title, editing.id, 'edited_message');
        } else {
          notifyTargetUsers(title, editing.id, 'new_message');
        }

        toast.success('Съобщението е публикувано');
        navigate('/messages');
      } else {
        isPublishing.current = false;
        toast.error('Грешка при публикуване');
      }
    } else {
      const activeDraftId = draftId || (draftCreationPromise.current ? await draftCreationPromise.current : null);
      const finalAudience = getFinalAudience();

      if (activeDraftId) {
        const success = await updateMessage(activeDraftId, {
          title, content, category, importance, targetAudience: finalAudience, attachments, links, status,
          commentsEnabled,
        });

        if (success) {
          setDraftId(null);
          notifyTargetUsers(title, activeDraftId, 'new_message');

          toast.success('Съобщението е публикувано');
          navigate('/messages');
        } else {
          isPublishing.current = false;
          toast.error('Грешка при публикуване');
        }
      } else {
        const msgId = await createMessage({
          title, content, category, importance, status,
          targetAudience: finalAudience,
          authorId: user.id,
          authorName: `${user.firstName} ${user.lastName}`,
          authorSchool: user.school,
          attachments,
          links,
          commentsEnabled,
          comments: [],
        });

        if (msgId) {
          notifyTargetUsers(title, msgId, 'new_message');

          toast.success('Съобщението е публикувано');
          navigate('/messages');
        } else {
          isPublishing.current = false;
          toast.error('Грешка при създаване');
        }
      }
    }
  };

  const addAsLink = () => {
    if (!linkUrl.trim()) {
      toast.error('Моля, въведете валиден линк');
      return;
    }
    const formattedLink = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    setLinks(prev => [...prev, formattedLink]);
    setLinkUrl('');
    toast.success('Линкът е добавен!');
  };

  const removeLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
  };

  const generateQrCode = async () => {
    if (!linkUrl.trim()) {
      toast.error('Моля, въведете валиден линк за QR код');
      return;
    }

    setIsGeneratingQr(true);
    try {
      const formattedLink = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
      const dataUrl = await QRCode.toDataURL(formattedLink, {
        width: 600,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `qr-code-${Date.now()}.png`, { type: 'image/png' });

      const [newAttachment] = await uploadsApi.uploadFiles([file]);
      setAttachments(prev => [...prev, newAttachment]);
      toast.success('QR кодът е генериран и прикачен');
      setLinkUrl('');
    } catch (err) {
      console.error('QR generation error:', err);
      toast.error('Грешка при генериране на QR код');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Назад
      </Button>

      <Card className="rounded-[2rem] border-primary/10 bg-gradient-to-br from-card to-secondary/20 shadow-xl overflow-hidden">
        <CardHeader className="pb-4 px-6 md:px-10 pt-8">
          <CardTitle className="font-heading text-2xl font-black">
            {editing ? 'Редактиране на съобщение' : 'Ново съобщение'}
          </CardTitle>
          {draftCreated.current && !editing && (
            <p className="text-xs text-muted-foreground mt-1">Черновата се запазва автоматично</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6 px-6 md:px-10 pb-10">
          <div>
            <Label className="font-bold text-sm mb-1.5 block">Заглавие *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Въведете заглавие на съобщението" maxLength={200} className="rounded-2xl h-11 border-primary/20 focus:border-primary/40" />
          </div>

          <div>
            <Label>Съдържание *</Label>
            <div className="mt-1.5">
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Текст на съобщението..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
            <Label className="font-bold text-sm mb-1.5 block">Категория</Label>
              <Select value={category} onValueChange={v => setCategory(v as MessageCategory)}>
                <SelectTrigger className="rounded-2xl h-11 border-primary/20"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl border-primary/10">
                  {allowedCategories.map(option => (
                    <SelectItem key={option.id} value={option.key} className="font-bold">{option.label || CATEGORY_LABELS[option.key] || option.key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-sm mb-1.5 block">Важност</Label>
              <Select value={importance} onValueChange={v => setImportance(v as MessageImportance)}>
                <SelectTrigger className="rounded-2xl h-11 border-primary/20"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl border-primary/10">
                  {(Object.entries(IMPORTANCE_LABELS) as [MessageImportance, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="font-bold">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
          </div>

          <AudienceSelector
            audience={audience}
            onAudienceChange={setAudience}
            selectedPersonIds={selectedPersonIds}
            onSelectedPersonIdsChange={setSelectedPersonIds}
            selectedClass={selectedClass}
            onSelectedClassChange={setSelectedClass}
            selectedSubject={selectedSubject}
            onSelectedSubjectChange={setSelectedSubject}
          />

          {/* Comments toggle */}
          <label htmlFor="comments-toggle" className="flex items-center gap-3 cursor-pointer group w-fit">
            <Switch checked={commentsEnabled} onCheckedChange={setCommentsEnabled} id="comments-toggle" className="pointer-events-none shrink-0" />
            <div className="flex items-center gap-2 select-none">
              <MessageSquare className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-sm font-medium">Разреши коментари</span>
            </div>
          </label>

          <div>
            <Label className="font-bold text-sm mb-1.5 block">Прикачени файлове</Label>
            <div className="mt-2">
              <FileUploader
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-primary/5 space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="!rounded-2xl font-bold border-primary/20 hover:border-primary/40 flex items-center gap-2"
              onClick={() => setShowInteractiveOptions(!showInteractiveOptions)}
            >
              <Link className="h-4 w-4" />
              Добави линк или QR код
            </Button>

            {showInteractiveOptions && (
              <div className="bg-secondary/20 p-5 rounded-2xl border border-primary/10 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-black mb-4 text-muted-foreground uppercase tracking-wider">Допълнителни ресурси</p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3">
                  <Input
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="Въведете URL адрес (напр. https://example.com)..."
                    className="w-full rounded-2xl border-primary/20"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={addAsLink}
                      disabled={!linkUrl.trim()}
                      className="flex-1 md:flex-initial !rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all"
                    >
                      <Link className="h-4 w-4 mr-1.5" /> Добави линк
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={generateQrCode}
                      disabled={!linkUrl.trim() || isGeneratingQr}
                      className="flex-1 md:flex-initial !rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all"
                    >
                      {isGeneratingQr ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <QrIcon className="h-4 w-4 mr-1.5" />
                      )}
                      {isGeneratingQr ? 'Генериране...' : 'QR код'}
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic pl-0.5">
                  Линкът ще бъде добавен в специална секция „Външни препратки". QR кодът ще бъде качен като основен прикачен файл.
                </p>
              </div>
            )}

            {links.length > 0 && (
              <div className="grid gap-2">
                {links.map((link, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-primary/5 p-3 rounded-2xl border border-primary/10 text-sm hover:bg-primary/10 transition-colors">
                    <div className="flex items-center gap-2 truncate">
                      <Link className="h-4 w-4 text-primary shrink-0" />
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-primary hover:underline font-bold decoration-primary/30 underline-offset-4"
                      >
                        {link}
                      </a>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => removeLink(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-primary/5">
              <Button onClick={handleSubmit} className="rounded-2xl font-bold px-6 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20">
                <Send className="h-4 w-4 mr-1" /> Публикувай
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateMessage;
