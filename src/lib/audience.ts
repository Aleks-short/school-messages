import { Message, AUDIENCE_LABELS, User } from '@/types';

export const formatAudienceLabel = (message: Message, currentUser?: User | null): string => {
  const ta = message.targetAudience;
  const u = message.targetUser;
  const users = message.targetUsers;

  let label = '';

  // Case 0: Multi-user message (users:id1,id2,...)
  if (ta.startsWith('users:') && users && users.length > 0) {
    if (currentUser) {
      const isRecipient = users.some(target => target.id === currentUser.id);
      if (isRecipient) {
        // Show only current user's name if they are a recipient
        label = `${currentUser.firstName} ${currentUser.lastName}`;
      } else {
        // Show all names for author or others
        label = users.map(target => `${target.firstName} ${target.lastName}`).join(', ');
      }
    } else {
      label = users.map(target => `${target.firstName} ${target.lastName}`).join(', ');
    }
  }
  // Case 1: Individual message (targetUser exists)
  else if (ta.startsWith('user:') && u) {
    label = `${u.firstName} ${u.lastName}`;
  } 
  // Case 2: Group message
  else if (ta === 'all') label = 'Всички';
  else if (ta === 'teachers') label = 'Всички учители';
  else if (ta === 'students') label = 'Всички ученици';
  else if (ta === 'director') label = 'Ръководството';
  else if (ta.startsWith('subject:')) {
    label = `Преподавателите по ${ta.replace('subject:', '')}`;
  }
  else if (ta.startsWith('class:')) {
    label = `Учениците от ${ta.replace('class:', '')} клас`;
  }
  else {
    label = AUDIENCE_LABELS[ta] || ta;
  }

  return `До: ${label}`;
};
