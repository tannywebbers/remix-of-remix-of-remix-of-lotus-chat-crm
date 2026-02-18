import { useState, useRef, useEffect } from 'react';
import { Chat } from '@/types';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { MessageStatus } from '@/components/shared/MessageStatus';
import { formatChatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { Pin, BellOff, Archive, Trash2, MessageSquareOff, Star, Tag } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Label {
  id: string;
  name: string;
  color: string;
}

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  chatLabels?: Label[];
}

export function ChatListItem({ chat, isActive, onClick, chatLabels = [] }: ChatListItemProps) {
  const { contact, lastMessage, unreadCount, isPinned, isMuted, isArchived } = chat;
  const { updateContact, setMessages, chats, setChats, favorites, toggleFavorite } = useAppStore();
  const { toast } = useToast();
  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const isFav = favorites[chat.id];
  const { user } = useAuth();
  const [allLabels, setAllLabels] = useState<Label[]>(chatLabels);
  const [assignedLabelIds, setAssignedLabelIds] = useState<string[]>(chatLabels.map(l => l.id));

  // Touch intent system — prevent accidental click during scroll
  const touchStartY = useRef<number>(0);
  const isScrolling = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isScrolling.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!isScrolling.current) {
        setIsLongPress(true);
        setShowOptions(true);
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (deltaY > 8) {
      isScrolling.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (!isLongPress && !isScrolling.current) onClick();
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
      toast({ title: 'Failed to clear chat', variant: 'destructive' });
    }
    setShowDeleteDialog(false);
    setShowOptions(false);
  };

  const handleAction = async (action: 'pin' | 'mute' | 'archive') => {
    try {
      const field = action === 'pin' ? 'is_pinned' : action === 'mute' ? 'is_muted' : 'is_archived';
      const currentValue = action === 'pin' ? isPinned : action === 'mute' ? isMuted : (isArchived || contact.isArchived);
      await supabase.from('contacts').update({ [field]: !currentValue }).eq('id', chat.id);
      updateContact(chat.id, { 
        [action === 'pin' ? 'isPinned' : action === 'mute' ? 'isMuted' : 'isArchived']: !currentValue 
      } as any);
      toast({ 
        title: action === 'pin' ? (currentValue ? 'Chat unpinned' : 'Chat pinned')
          : action === 'mute' ? (currentValue ? 'Unmuted' : 'Muted')
          : (currentValue ? 'Unarchived' : 'Archived')
      });
    } catch (error) {
      toast({ title: `Failed to ${action} chat`, variant: 'destructive' });
    }
    setShowOptions(false);
  };
  

  useEffect(() => {
    setAllLabels(chatLabels);
    setAssignedLabelIds(chatLabels.map(l => l.id));
  }, [chatLabels]);

  const loadLabelsForMenu = async () => {
    if (!user) return;
    const [labelsRes, assignedRes] = await Promise.all([
      supabase.from('labels' as any).select('*').eq('user_id', user.id).order('name', { ascending: true }),
      supabase.from('chat_labels' as any).select('label_id').eq('user_id', user.id).eq('chat_id', chat.id),
    ]);

    setAllLabels(((labelsRes.data as any[]) || []) as Label[]);
    setAssignedLabelIds((((assignedRes.data as any[]) || []).map((x: any) => x.label_id)));
  };

  const toggleLabelAssignment = async (labelId: string, checked: boolean) => {
    if (!user) return;
    try {
      if (checked) {
        const { error } = await supabase.from('chat_labels' as any).insert({ user_id: user.id, chat_id: chat.id, label_id: labelId } as any);
        if (error && !String(error.message || '').includes('duplicate key')) throw error;
        setAssignedLabelIds(prev => [...new Set([...prev, labelId])]);
      } else {
        const { error } = await supabase.from('chat_labels' as any).delete().eq('user_id', user.id).eq('chat_id', chat.id).eq('label_id', labelId);
        if (error) throw error;
        setAssignedLabelIds(prev => prev.filter(id => id !== labelId));
      }
    } catch (error: any) {
      toast({ title: 'Failed to update labels', description: error.message, variant: 'destructive' });
    }
  };

  const hasUnread = unreadCount > 0;

  return (
    <>
      <div className="relative">
        <button
          onClick={onClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-[10px] transition-colors text-left',
            'hover:bg-accent/50 active:bg-accent/70',
            isActive && 'bg-accent'
          )}
        >
          <ContactAvatar name={contact.name} avatar={contact.avatar} isOnline={contact.isOnline} lastSeen={contact.lastSeen} size="md" />
          
          <div className="flex-1 min-w-0 border-b border-panel-border pb-[10px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn(
                  'text-[17px] truncate text-foreground font-normal'
                )}>{contact.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {lastMessage && (
                  <span className={cn(
                    'text-[13px]',
                    hasUnread ? 'text-primary font-normal' : 'text-muted-foreground'
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
                <span className={cn(
                  'text-[15px] truncate leading-tight font-normal',
                  hasUnread ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {lastMessage?.content || 'No messages yet'}
                </span>
              </div>
              
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {/* Label badges */}
                {chatLabels.slice(0, 2).map(label => (
                  <span
                    key={label.id}
                    className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-semibold leading-tight"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
                {isFav && <Star className="h-[14px] w-[14px] text-amber-500 fill-amber-500" />}
                {isPinned && <Pin className="h-[14px] w-[14px] text-muted-foreground fill-muted-foreground" />}
                {isMuted && <BellOff className="h-[14px] w-[14px] text-muted-foreground" />}
                {hasUnread && (
                  <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-[12px] font-bold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>

        <DropdownMenu open={showOptions} onOpenChange={(open) => { setShowOptions(open); if (open) loadLabelsForMenu(); }}>
          <DropdownMenuTrigger asChild>
            <span className="sr-only">Options</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => { toggleFavorite(chat.id); setShowOptions(false); }}>
              <Star className={cn("h-4 w-4 mr-3", isFav && "fill-amber-500 text-amber-500")} />
              {isFav ? 'Remove from favorites' : 'Add to favorites'}
            </DropdownMenuItem>
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
              {(isArchived || contact.isArchived) ? 'Unarchive chat' : 'Archive chat'}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tag className="h-4 w-4 mr-3" />
                Labels
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {allLabels.length === 0 ? (
                  <DropdownMenuItem disabled>No labels created</DropdownMenuItem>
                ) : allLabels.map((label) => (
                  <DropdownMenuCheckboxItem
                    key={label.id}
                    checked={assignedLabelIds.includes(label.id)}
                    onCheckedChange={(checked) => toggleLabelAssignment(label.id, checked === true)}
                  >
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                    {label.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
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
