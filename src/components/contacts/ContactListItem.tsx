import { useState, useRef } from 'react';
import { Contact } from '@/types';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { formatCurrency } from '@/lib/utils/format';
import { Edit2, Trash2, CheckSquare } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LabelBadge {
  id: string;
  name: string;
  color: string;
}

interface ContactListItemProps {
  contact: Contact;
  onClick: () => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
  labels?: LabelBadge[];
  onEnterSelectionMode?: () => void;
}

export function ContactListItem({ contact, onClick, selected, onToggleSelect, selectionMode, labels = [], onEnterSelectionMode }: ContactListItemProps) {
  const { setEditContactId, deleteContact } = useAppStore();
  const { toast } = useToast();
  const [showOptions, setShowOptions] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const touchStartY = useRef<number>(0);
  const isScrolling = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isScrolling.current = false;
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      if (selectionMode && onToggleSelect) {
        onToggleSelect(contact.id);
      } else {
        setShowOptions(true);
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (deltaY > 8) {
      isScrolling.current = true;
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (!isLongPress && !isScrolling.current) {
      if (selectionMode && onToggleSelect) {
        onToggleSelect(contact.id);
      } else {
        onClick();
      }
    }
    setIsLongPress(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowOptions(true);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${contact.name}?`)) return;
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', contact.id);
      if (error) throw error;
      deleteContact(contact.id);
      toast({ title: 'Contact deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setShowOptions(false);
  };

  return (
    <div className="relative">
      <button
        onClick={selectionMode && onToggleSelect ? () => onToggleSelect(contact.id) : onClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        className={cn(
          "w-full flex items-center gap-3 p-3 transition-colors text-left hover:bg-accent/50 border-b border-panel-border/50",
          selected && "bg-primary/10"
        )}
      >
        {selectionMode && (
          <div className={cn(
            "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0",
            selected ? "bg-primary border-primary" : "border-muted-foreground"
          )}>
            {selected && <CheckSquare className="h-4 w-4 text-primary-foreground" />}
          </div>
        )}
        <ContactAvatar name={contact.name} avatar={contact.avatar} isOnline={contact.isOnline} size="md" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">{contact.name}</span>
            <span className="text-xs text-muted-foreground">{contact.loanId}</span>
          </div>
          
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-sm text-muted-foreground truncate">{contact.phone}</span>
            {contact.amount && (
              <span className="text-sm font-medium text-primary">{formatCurrency(contact.amount)}</span>
            )}
          </div>

          {labels.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {labels.slice(0, 2).map((label) => (
                <span
                  key={label.id}
                  className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-semibold leading-tight"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      <DropdownMenu open={showOptions} onOpenChange={setShowOptions}>
        <DropdownMenuTrigger asChild>
          <span className="sr-only">Options</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => { setEditContactId(contact.id); setShowOptions(false); }}>
            <Edit2 className="h-4 w-4 mr-3" />
            Edit contact
          </DropdownMenuItem>
          {onToggleSelect && (
            <DropdownMenuItem onClick={() => {
              onEnterSelectionMode?.();
              onToggleSelect(contact.id);
              setShowOptions(false);
            }}>
              <CheckSquare className="h-4 w-4 mr-3" />
              Select
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-3" />
            Delete contact
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
