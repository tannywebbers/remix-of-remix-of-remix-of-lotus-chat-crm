import { useState, useRef, useEffect } from 'react';
import { Chat } from '@/types';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { MessageStatus } from '@/components/shared/MessageStatus';
import { formatChatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { Pin, BellOff, Archive, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const { contact, lastMessage, unreadCount, isPinned, isMuted } = chat;
  const { updateContact, deleteContact } = useAppStore();
  const { toast } = useToast();
  const [showOptions, setShowOptions] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      setShowOptions(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    if (!isLongPress) {
      onClick();
    }
    setIsLongPress(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowOptions(true);
  };

  const handleAction = async (action: 'pin' | 'mute' | 'archive' | 'delete') => {
    try {
      if (action === 'delete') {
        await supabase.from('contacts').delete().eq('id', chat.id);
        deleteContact(chat.id);
        toast({ title: 'Chat deleted' });
      } else {
        const field = action === 'pin' ? 'is_pinned' : action === 'mute' ? 'is_muted' : 'is_archived';
        const currentValue = action === 'pin' ? isPinned : action === 'mute' ? isMuted : false;
        
        await supabase.from('contacts').update({ [field]: !currentValue }).eq('id', chat.id);
        updateContact(chat.id, { 
          [action === 'pin' ? 'isPinned' : action === 'mute' ? 'isMuted' : 'isArchived']: !currentValue 
        } as any);
        
        toast({ 
          title: action === 'pin' 
            ? (currentValue ? 'Chat unpinned' : 'Chat pinned')
            : action === 'mute'
            ? (currentValue ? 'Unmuted' : 'Muted')
            : 'Archived'
        });
      }
    } catch (error) {
      console.error(`Error ${action}ing chat:`, error);
      toast({ title: `Failed to ${action} chat`, variant: 'destructive' });
    }
    setShowOptions(false);
  };
  
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
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
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-medium truncate">{contact.name}</span>
              {isPinned && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
              {isMuted && <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
            {lastMessage && (
              <span className={cn(
                'text-xs shrink-0 ml-2',
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
              <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground shrink-0">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Options on hover (desktop) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex">
        <DropdownMenu open={showOptions} onOpenChange={setShowOptions}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 bg-panel/80">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => handleAction('pin')}>
              <Pin className="h-4 w-4 mr-2" />
              {isPinned ? 'Unpin chat' : 'Pin chat'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction('mute')}>
              <BellOff className="h-4 w-4 mr-2" />
              {isMuted ? 'Unmute' : 'Mute notifications'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction('archive')}>
              <Archive className="h-4 w-4 mr-2" />
              Archive chat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleAction('delete')} 
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
