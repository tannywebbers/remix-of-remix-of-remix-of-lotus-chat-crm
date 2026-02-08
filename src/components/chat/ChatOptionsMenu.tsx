import { useState } from 'react';
import { MoreVertical, Archive, Pin, BellOff, Bell, Trash2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store/appStore';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChatOptionsMenuProps {
  chatId: string;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  onClose?: () => void;
}

export function ChatOptionsMenu({ chatId, isPinned, isMuted, isArchived, onClose }: ChatOptionsMenuProps) {
  const { updateContact, deleteContact } = useAppStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleAction = async (action: 'pin' | 'mute' | 'archive' | 'delete') => {
    try {
      if (action === 'delete') {
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', chatId);
        
        if (error) throw error;
        deleteContact(chatId);
        toast({ title: 'Chat deleted' });
      } else {
        const field = action === 'pin' ? 'is_pinned' : action === 'mute' ? 'is_muted' : 'is_archived';
        const currentValue = action === 'pin' ? isPinned : action === 'mute' ? isMuted : isArchived;
        
        const { error } = await supabase
          .from('contacts')
          .update({ [field]: !currentValue })
          .eq('id', chatId);
        
        if (error) throw error;
        
        const updateField = action === 'pin' ? 'isPinned' : action === 'mute' ? 'isMuted' : 'isArchived';
        updateContact(chatId, { [updateField]: !currentValue } as any);
        
        toast({ 
          title: action === 'pin' 
            ? (currentValue ? 'Chat unpinned' : 'Chat pinned')
            : action === 'mute'
            ? (currentValue ? 'Notifications unmuted' : 'Notifications muted')
            : (currentValue ? 'Chat unarchived' : 'Chat archived')
        });
      }
    } catch (error) {
      console.error(`Error ${action}ing chat:`, error);
      toast({ title: 'Error', description: `Failed to ${action} chat`, variant: 'destructive' });
    }
    
    setOpen(false);
    onClose?.();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleAction('pin')}>
          <Pin className="h-4 w-4 mr-2" />
          {isPinned ? 'Unpin chat' : 'Pin chat'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('mute')}>
          {isMuted ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
          {isMuted ? 'Unmute' : 'Mute notifications'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('archive')}>
          <Archive className="h-4 w-4 mr-2" />
          {isArchived ? 'Unarchive chat' : 'Archive chat'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleAction('delete')} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete chat
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
