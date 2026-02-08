import { Message } from '@/types';
import { MessageStatus } from '@/components/shared/MessageStatus';
import { formatMessageTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { FileText, Play, Image as ImageIcon, Mic } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { content, isOutgoing, timestamp, status, type, mediaUrl } = message;
  
  const renderContent = () => {
    if (type === 'image' && mediaUrl) {
      return (
        <div className="space-y-1">
          <img 
            src={mediaUrl} 
            alt="Image" 
            className="rounded-lg max-w-[280px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(mediaUrl, '_blank')}
          />
          {content && content !== '[Image]' && (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{content}</p>
          )}
        </div>
      );
    }

    if (type === 'audio' && mediaUrl) {
      return (
        <div className="flex items-center gap-3 min-w-[200px]">
          <button className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/30 transition-colors">
            <Play className="h-5 w-5 text-primary ml-0.5" />
          </button>
          <div className="flex-1">
            <div className="h-1 bg-primary/30 rounded-full">
              <div className="h-1 w-0 bg-primary rounded-full" />
            </div>
            <audio src={mediaUrl} controls className="hidden" />
          </div>
          <span className="text-xs text-muted-foreground">0:00</span>
        </div>
      );
    }

    if (type === 'video' && mediaUrl) {
      return (
        <div className="relative max-w-[280px]">
          <video 
            src={mediaUrl} 
            className="rounded-lg w-full"
            controls
          />
        </div>
      );
    }

    if (type === 'document' && mediaUrl) {
      return (
        <a 
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-background/50 rounded-lg hover:bg-background/70 transition-colors"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{content || 'Document'}</p>
            <p className="text-xs text-muted-foreground">Click to download</p>
          </div>
        </a>
      );
    }

    return (
      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </p>
    );
  };
  
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
        {renderContent()}
        
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
