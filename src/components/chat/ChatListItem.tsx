import { useState, useRef } from 'react';
import { Chat } from '@/types';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { MessageStatus } from '@/components/shared/MessageStatus';
import { formatChatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { Pin, BellOff, Archive, Trash2, MessageSquareOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  const { updateContact, setMessages, chats, setChats } = useAppStore();
  const { toast } = useToast();
  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      setShowOptions(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (!isLongPress) onClick();
    setIsLongPress(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowOptions(true);
  };

  const handleDeleteChat = async () => {
    try {
      const { error } = await supabase.from('messages').delete().eq('contact_id', chat.id);
      if (error) throw error;
      setMessages(chat.id, []);
      const updatedChats = chats.map(c => 
        c.id === chat.id ? { ...c, lastMessage: undefined, unreadCount: 0 } : c
      );
      setChats(updatedChats);
      toast({ title: 'Chat cleared', description: 'Messages deleted. Contact preserved.' });
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({ title: 'Failed to clear chat', variant: 'destructive' });
    }
    setShowDeleteDialog(false);
    setShowOptions(false);
  };

  const handleAction = async (action: 'pin' | 'mute' | 'archive') => {
    try {
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
    } catch (error) {
      toast({ title: `Failed to ${action} chat`, variant: 'destructive' });
    }
    setShowOptions(false);
  };
  
  return (
    <>
      <div className="relative">
        <button
          onClick={onClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-[10px] transition-colors text-left',
            'hover:bg-accent/50 active:bg-accent/70',
            isActive && 'bg-accent'
          )}
        >
          <ContactAvatar name={contact.name} avatar={contact.avatar} isOnline={contact.isOnline} size="md" />
          
          <div className="flex-1 min-w-0 border-b border-panel-border pb-[10px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-[17px] truncate text-foreground">{contact.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {lastMessage && (
                  <span className={cn(
                    'text-[13px]',
                    unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}>
                    {formatChatTime(lastMessage.timestamp)}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-[2px]">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                {lastMessage?.isOutgoing && (
                  <MessageStatus status={lastMessage.status} className="h-[16px] w-[16px]" />
                )}
                <span className="text-[15px] text-muted-foreground truncate leading-tight">
                  {lastMessage?.content || 'No messages yet'}
                </span>
              </div>
              
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {isPinned && <Pin className="h-[14px] w-[14px] text-muted-foreground fill-muted-foreground" />}
                {isMuted && <BellOff className="h-[14px] w-[14px] text-muted-foreground" />}
                {unreadCount > 0 && (
                  <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-[12px] font-bold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>

        <DropdownMenu open={showOptions} onOpenChange={setShowOptions}>
          <DropdownMenuTrigger asChild>
            <span className="sr-only">Options</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => handleAction('pin')}>
              <Pin className="h-4 w-4 mr-3" />
              {isPinned ? 'Unpin chat' : 'Pin chat'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction('mute')}>
              <BellOff className="h-4 w-4 mr-3" />
              {isMuted ? 'Unmute notifications' : 'Mute notifications'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction('archive')}>
              <Archive className="h-4 w-4 mr-3" />
              Archive chat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setShowDeleteDialog(true)} 
              className="text-destructive focus:text-destructive"
            >
              <MessageSquareOff className="h-4 w-4 mr-3" />
              Delete chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all messages in this chat. The contact "{contact.name}" will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete messages
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
