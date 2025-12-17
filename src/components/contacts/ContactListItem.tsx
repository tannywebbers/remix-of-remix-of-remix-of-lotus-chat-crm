import { Contact } from '@/types';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { formatCurrency } from '@/lib/utils/format';

interface ContactListItemProps {
  contact: Contact;
  onClick: () => void;
}

export function ContactListItem({ contact, onClick }: ContactListItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 transition-colors text-left hover:bg-accent/50 border-b border-panel-border/50"
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
          <span className="text-xs text-muted-foreground">{contact.loanId}</span>
        </div>
        
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm text-muted-foreground truncate">{contact.phone}</span>
          {contact.amount && (
            <span className="text-sm font-medium text-primary">
              {formatCurrency(contact.amount)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
