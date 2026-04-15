import React from 'react';
import { Message, User, AUDIENCE_LABELS } from '@/types';
import UserHoverCard from './UserHoverCard';

interface AudienceDisplayProps {
  message: Message;
  currentUser?: User | null;
  className?: string;
}

const AudienceDisplay: React.FC<AudienceDisplayProps> = ({ message, currentUser, className }) => {
  const ta = message.targetAudience;
  const u = message.targetUser;
  const users = message.targetUsers;

  const renderUser = (target: any) => (
    <UserHoverCard
      key={target.id}
      user={{
        name: `${target.firstName} ${target.lastName}`,
        role: target.role,
        school: target.school,
        class: target.class,
        teacherType: target.teacherType,
        subject: target.subject
      }}
    >
      <span className="hover:text-primary transition-colors cursor-help">
        {target.firstName} {target.lastName}
      </span>
    </UserHoverCard>
  );

  let content: React.ReactNode = null;

  // Case 0: Multi-user message
  if (ta.startsWith('users:') && users && users.length > 0) {
    if (currentUser) {
      const isRecipient = users.some(target => target.id === currentUser.id);
      if (isRecipient) {
        content = renderUser(currentUser);
      } else {
        content = (
          <span className="inline-flex flex-wrap items-center">
            {users.map((target, idx) => (
              <React.Fragment key={target.id}>
                {renderUser(target)}
                {idx < users.length - 1 && <span className="mr-1.5">,</span>}
              </React.Fragment>
            ))}
          </span>
        );
      }
    } else {
      content = (
        <span className="inline-flex flex-wrap items-center">
          {users.map((target, idx) => (
            <React.Fragment key={target.id}>
              {renderUser(target)}
              {idx < users.length - 1 && <span className="mr-1.5">,</span>}
            </React.Fragment>
          ))}
        </span>
      );
    }
  }
  // Case 1: Individual message
  else if (ta.startsWith('user:') && u) {
    content = renderUser(u);
  }
  // Case 2: Group message
  else {
    let label = '';
    if (ta === 'all') label = 'Всички';
    else if (ta === 'teachers') label = 'Всички учители';
    else if (ta === 'students') label = 'Всички ученици';
    else if (ta === 'director') label = 'Ръководството';
    else if (ta.startsWith('subject:')) label = `Преподавателите по ${ta.replace('subject:', '')}`;
    else if (ta.startsWith('class:')) label = `Учениците от ${ta.replace('class:', '')} клас`;
    else label = AUDIENCE_LABELS[ta] || ta;
    
    content = label;
  }

  return (
    <span className={className}>
      До: {content}
    </span>
  );
};

export default AudienceDisplay;
