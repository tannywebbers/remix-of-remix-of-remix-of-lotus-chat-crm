import { Message } from '@/types';
import { MessageStatus } from '@/components/shared/MessageStatus';
import { formatMessageTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { content, isOutgoing, timestamp, status } = message;
  
  return (
    <div
      className={cn(
        'flex animate-message-in',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'message-bubble',
          isOutgoing ? 'message-bubble-outgoing' : 'message-bubble-incoming'
        )}
      >
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </p>
        
        <div className={cn(
          'flex items-center gap-1 mt-1',
          isOutgoing ? 'justify-end' : 'justify-start'
        )}>
          <span className="text-[11px] text-muted-foreground">
            {formatMessageTime(timestamp)}
          </span>
          {isOutgoing && <MessageStatus status={status} className="h-3.5 w-3.5" />}
        </div>
      </div>
    </div>
  );
}
