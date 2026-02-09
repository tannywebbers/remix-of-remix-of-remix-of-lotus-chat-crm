import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Contact } from '@/types';

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
}

export function NewChatModal({ open, onClose, onSelectContact }: NewChatModalProps) {
  const { contacts } = useAppStore();
  const [search, setSearch] = useState('');

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(search.toLowerCase()) ||
    contact.phone.includes(search)
  );

  const handleSelect = (contact: Contact) => {
    onSelectContact(contact);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>New Chat</DialogTitle>
        </DialogHeader>
        
        <div className="p-4 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No contacts found</p>
              <p className="text-xs mt-1">Add contacts from the Contacts tab</p>
            </div>
          ) : (
            <div className="pb-4">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleSelect(contact)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <ContactAvatar 
                    name={contact.name} 
                    avatar={contact.avatar}
                    isOnline={contact.isOnline}
                    size="md"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{contact.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{contact.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}