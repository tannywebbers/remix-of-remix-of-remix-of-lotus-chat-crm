import { Chat } from '@/types';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { MessageStatus } from '@/components/shared/MessageStatus';
import { formatChatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const { contact, lastMessage, unreadCount } = chat;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 transition-colors text-left',
        'hover:bg-accent/50',
        isActive && 'bg-accent'
      )}
    >
      <ContactAvatar
        name={contact.name}
        avatar={contact.avatar}
        isOnline={contact.isOnline}
        size="md"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium truncate">{contact.name}</span>
          {lastMessage && (
            <span className={cn(
              'text-xs',
              unreadCount > 0 ? 'text-primary font-medium' : 'text-muted-foreground'
            )}>
              {formatChatTime(lastMessage.timestamp)}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-0.5">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {lastMessage?.isOutgoing && (
              <MessageStatus status={lastMessage.status} />
            )}
            <span className="text-sm text-muted-foreground truncate">
              {lastMessage?.content || 'No messages yet'}
            </span>
          </div>
          
          {unreadCount > 0 && (
            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
