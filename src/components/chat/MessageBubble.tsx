import { useState } from 'react';
import { Message } from '@/types';
import { MessageStatus } from '@/components/shared/MessageStatus';
import { MediaPreviewModal } from '@/components/chat/MediaPreviewModal';
import { formatMessageTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { FileText, Play, Pause, AlertCircle } from 'lucide-react';
import { useRef } from 'react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { content, isOutgoing, timestamp, status, type, mediaUrl } = message;
  const [mediaPreview, setMediaPreview] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState('0:00');
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setAudioPlaying(!audioPlaying);
  };

  const renderContent = () => {
    if (type === 'image' && mediaUrl) {
      return (
        <div className="space-y-1">
          <img
            src={mediaUrl}
            alt="Image"
            className="rounded-lg max-w-[280px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setMediaPreview(true)}
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
          <button
            className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/30 transition-colors"
            onClick={toggleAudio}
          >
            {audioPlaying
              ? <Pause className="h-5 w-5 text-primary" />
              : <Play className="h-5 w-5 text-primary ml-0.5" />
            }
          </button>
          <div className="flex-1">
            <div className="h-1 bg-primary/30 rounded-full overflow-hidden">
              <div className="h-1 bg-primary rounded-full transition-all" style={{ width: `${audioProgress}%` }} />
            </div>
            <audio
              ref={audioRef}
              src={mediaUrl}
              onTimeUpdate={() => {
                if (audioRef.current) {
                  setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
                  const secs = Math.floor(audioRef.current.currentTime);
                  setAudioDuration(`${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`);
                }
              }}
              onEnded={() => { setAudioPlaying(false); setAudioProgress(0); }}
              className="hidden"
            />
          </div>
          <span className="text-xs text-muted-foreground">{audioDuration}</span>
        </div>
      );
    }

    if (type === 'video' && mediaUrl) {
      return (
        <div className="relative max-w-[280px] cursor-pointer" onClick={() => setMediaPreview(true)}>
          <video src={mediaUrl} className="rounded-lg w-full" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
            <Play className="h-10 w-10 text-white" />
          </div>
        </div>
      );
    }

    if (type === 'document' && mediaUrl) {
      return (
        <button
          onClick={() => setMediaPreview(true)}
          className="flex items-center gap-3 p-3 bg-background/50 rounded-lg hover:bg-background/70 transition-colors w-full text-left"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{content || 'Document'}</p>
            <p className="text-xs text-muted-foreground">Tap to view</p>
          </div>
        </button>
      );
    }

    return (
      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{content}</p>
    );
  };

  return (
    <>
      <div className={cn('flex animate-message-in', isOutgoing ? 'justify-end' : 'justify-start')}>
        <div className={cn('message-bubble', isOutgoing ? 'message-bubble-outgoing' : 'message-bubble-incoming')}>
          {renderContent()}
          <div className={cn('flex items-center gap-1 mt-1', isOutgoing ? 'justify-end' : 'justify-start')}>
            <span className="text-[11px] text-muted-foreground">{formatMessageTime(timestamp)}</span>
            {isOutgoing && <MessageStatus status={status} className="h-3.5 w-3.5" />}
          </div>
          {status === 'failed' && isOutgoing && (
            <div className="flex items-center gap-1 mt-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span className="text-[11px]">Not sent</span>
            </div>
          )}
        </div>
      </div>

      {mediaUrl && (
        <MediaPreviewModal
          open={mediaPreview}
          onOpenChange={setMediaPreview}
          mediaUrl={mediaUrl}
          mediaType={type as any}
          fileName={content}
        />
      )}
    </>
  );
}
