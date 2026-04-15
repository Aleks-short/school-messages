import React, { useState, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Paperclip, X, Upload, FileText, ImageIcon, Film, Music, AlertCircle } from 'lucide-react';
import { Attachment } from '@/types';
import { uploadsApi, SERVER_URL } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface FileUploaderProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
}

const UPLOADS_DIR = 'uploads';
const MAX_SIZE_MB = 500;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'video/*': ['.mp4', '.webm', '.avi'],
  'audio/*': ['.mp3', '.wav', '.ogg'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/vnd.rar': ['.rar'],
  'text/plain': ['.txt'],
};

const FileUploader: React.FC<FileUploaderProps> = ({
  attachments,
  onAttachmentsChange,
  maxFiles = Infinity
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<{url: string, name: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFiles = async (files: File[]) => {
    // Валидация на броя
    if (maxFiles !== Infinity && attachments.length + files.length > maxFiles) {
      toast.error(`Максималният брой файлове е ${maxFiles}`);
      return;
    }

    // Валидация на размера и типа
    const validFiles: File[] = [];
    const allowedTypes = Object.keys(ALLOWED_MIME_TYPES);

    for (const file of files) {
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(`Файлът "${file.name}" е твърде голям. Максимум 500MB.`);
        continue;
      }

      // Проста проверка на типа (дали MIME типа започва същия начин или е в списъка)
      const isAllowed = allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', ''));
        }
        return file.type === type;
      });

      if (!isAllowed) {
        toast.error(`Форматът на "${file.name}" не е разрешен.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      const newAttachments = await uploadsApi.uploadFiles(validFiles);
      onAttachmentsChange([...attachments, ...newAttachments]);
      toast.success('Файловете са качени успешно');
    } catch (err: any) {
      toast.error(err.message || 'Грешка при качване на файлове');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id: string) => {
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (type.startsWith('video/')) return <Film className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <Music className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-2xl p-6 transition-colors text-center cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'
          }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={onFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-primary/10 rounded-full mb-1 group-hover:bg-primary/20 transition-colors">
            <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-primary'}`} />
          </div>
          <p className="text-sm font-semibold tracking-tight">Кликнете или провлачете файлове тук</p>

          <div className="flex flex-wrap justify-center gap-1 mt-2 max-w-md">
            {[
              { label: 'Изображения', formats: 'JPG, PNG, GIF, WEBP' },
              { label: 'Видеа', formats: 'MP4, WEBM' },
              { label: 'Документи', formats: 'PDF, DOCX, XLSX, PPTX' },
              { label: 'Архиви', formats: 'ZIP, RAR' },
              { label: 'Аудио', formats: 'MP3, WAV' },
              { label: 'Текст', formats: 'TXT' },
            ].map(cat => (
              <div key={cat.label} className="group/item relative">
                <span className="px-2 py-0.5 bg-muted/80 text-muted-foreground rounded text-[10px] font-bold uppercase tracking-wider border hover:bg-muted transition-colors cursor-help">
                  {cat.label}
                </span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded border shadow-sm opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {cat.formats}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground font-bold uppercase tracking-[0.1em] opacity-80">
            ОГРАНИЧЕНИЕ: <span className="text-foreground">500 MB</span>
          </p>
        </div>
      </div>

      {uploading && (
        <div className="space-y-1">
          <p className="text-xs text-center text-muted-foreground animate-pulse">Качване...</p>
          <Progress value={undefined} className="h-1" />
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {attachments.map(att => (
            <div
              key={att.id}
              className="flex items-center gap-2 bg-background border border-muted-foreground/20 rounded-2xl p-2 pr-1.5 text-xs shadow-sm hover:shadow-md hover:border-primary/50 transition-all group"
            >
              <div 
                className={`p-1 bg-primary/5 rounded-lg shrink-0 overflow-hidden flex items-center justify-center w-14 h-14 ${att.type.startsWith('image/') ? 'cursor-pointer hover:bg-primary/20 transition-colors' : ''}`}
                onClick={() => {
                  if (att.type.startsWith('image/')) {
                    const cleanPath = att.path ? (att.path.startsWith(`${UPLOADS_DIR}/`) ? att.path.replace(`${UPLOADS_DIR}/`, '') : att.path) : '';
                    const imgUrl = att.url ? (att.url.startsWith('data:') ? att.url : `${SERVER_URL}${att.url}`) : `${SERVER_URL}/${UPLOADS_DIR}/${cleanPath}`;
                    setPreviewImage({ url: imgUrl, name: att.name });
                  }
                }}
              >
                {att.type.startsWith('image/') ? (
                  <img 
                    src={att.url ? (att.url.startsWith('data:') ? att.url : `${SERVER_URL}${att.url}`) : `${SERVER_URL}/${UPLOADS_DIR}/${att.path ? (att.path.startsWith(`${UPLOADS_DIR}/`) ? att.path.replace(`${UPLOADS_DIR}/`, '') : att.path) : ''}`} 
                    alt={att.name} 
                    className="w-full h-full object-contain rounded-md bg-white p-0.5 pointer-events-none"
                  />
                ) : (
                  getFileIcon(att.type)
                )}
              </div>
              <div className="flex flex-col min-w-0 pr-1 flex-1">
                <span className="font-semibold truncate max-w-[140px]" title={att.name}>{att.name}</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase">{formatFileSize(att.size)}</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(att.id); }}
                className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[fit-content] border-0 p-0 overflow-visible bg-transparent shadow-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Визуализация на изображение</DialogTitle>
            <DialogDescription>Преглед на избраното изображение или QR код</DialogDescription>
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
    </div>
  );
};

export default FileUploader;
