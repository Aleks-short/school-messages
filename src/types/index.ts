export type UserRole = 'admin' | 'director' | 'teacher' | 'student';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export type TeacherType = 'class' | 'regular';

export type ManagementPosition = 'director';

export const MANAGEMENT_POSITION_LABELS: Record<ManagementPosition, string> = {
  director: 'Директор',
};

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  registrationStatus: RegistrationStatus;
  registrationReviewNote?: string;
  registrationReviewedAt?: string;
  school: string;
  class?: string;
  pendingClass?: string;
  classNumber?: number;
  avatar?: string;
  subject?: string;
  pendingSubject?: string;
  teacherType?: TeacherType;
  pendingTeacherType?: TeacherType;
  managementPosition?: ManagementPosition;
}

export type MessageStatus = 'draft' | 'published' | 'archived';
export type MessageCategory = string;
export type MessageImportance = 'low' | 'normal' | 'high';
export type TargetAudience = 'all' | 'admin' | 'director' | 'teachers' | 'students' | string;

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  path?: string;
}


export interface Comment {
  id: string;
  messageId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorSchool?: string;
  authorClass?: string;
  authorTeacherType?: TeacherType;
  authorSubject?: string;
  content: string;
  createdAt: string;
  attachments?: Attachment[];
  links?: string[];
}

export interface Message {
  id: string;
  title: string;
  content: string;
  category: MessageCategory;
  status: MessageStatus;
  importance: MessageImportance;
  targetAudience: TargetAudience;
  authorId: string;
  authorName: string;
  authorRole?: UserRole;
  authorSchool?: string;
  authorClass?: string;
  authorTeacherType?: TeacherType;
  authorSubject?: string;
  attachments: Attachment[];
  links?: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  commentsEnabled: boolean;
  comments: Comment[];
  editHistory?: {
    editedAt: string;
    editedBy: string;
    editedByName: string;
    changes: string;
  }[];
  isSnapshot?: boolean;
  targetUser?: Partial<User>;
  targetUsers?: Partial<User>[];
}

export interface ReadStatus {
  messageId: string;
  userId: string;
  readAt: string;
  confirmed?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'new_message' | 'edited_message' | 'reminder' | 'new_comment';
  messageId: string;
  messageTitle: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationSettings {
  userId: string;
  newMessage: boolean;
  editedMessage: boolean;
  newComment: boolean;
  reminder: boolean;
}

export interface MessageCategoryOption {
  id: string;
  key: string;
  label: string;
}

export interface SchoolClassOption {
  id: string;
  school: string;
  name: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByName: string;
  performedBySchool?: string;
  targetType: 'message' | 'user' | 'setting' | 'class' | 'comment' | 'draft' | 'archive';
  targetId: string;
  details: string;
  createdAt: string;
  targetData?: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  director: 'Директор',
  teacher: 'Учител',
  student: 'Ученик',
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: 'Чака одобрение',
  approved: 'Одобрен',
  rejected: 'Отхвърлен',
};

export const CATEGORY_LABELS: Record<MessageCategory, string> = {
  system: 'Системно съобщение',
  general: 'Общо съобщение',
  administrative: 'Административно съобщение',
  academic: 'Учебно съобщение',
  personal: 'Лично съобщение',
};

export const STATUS_LABELS: Record<MessageStatus, string> = {
  draft: 'Чернова',
  published: 'Публикувано',
  archived: 'Архивирано',
};

export const IMPORTANCE_LABELS: Record<MessageImportance, string> = {
  low: 'Ниска',
  normal: 'Нормална',
  high: 'Висока',
};

export const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Всички',
  admin: 'Администратор',
  director: 'Директор',
  teachers: 'Учители',
  students: 'Ученици',
};

export const COMMON_SUBJECTS = [
  'Български език и литература',
  'Английски език',
  'Математика',
  'Информационни технологии',
  'Физика',
  'Химия',
  'Биология',
  'История',
  'География',
  'Философия',
  'Физкултура',
];

export const ALL_SCHOOLS = [
  'Професионална гимназия по компютърни науки и математически анализи „Проф. Минко Балкански“',
  'СУ "Христо Ботев"'
];
