import { MessageCircle, Users, Settings, Plus } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { SearchInput } from '@/components/shared/SearchInput';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { ContactListItem } from '@/components/contacts/ContactListItem';
import { SettingsView } from '@/components/settings/SettingsView';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ViewMode } from '@/types';

const navItems: { mode: ViewMode; icon: typeof MessageCircle; label: string }[] = [
  { mode: 'chats', icon: MessageCircle, label: 'Chats' },
  { mode: 'contacts', icon: Users, label: 'Contacts' },
  { mode: 'settings', icon: Settings, label: 'Settings' },
];

export function ChatList() {
  const { 
    viewMode, 
    setViewMode, 
    chats, 
    contacts,
    activeChat, 
    setActiveChat,
    searchQuery,
    setSearchQuery,
    setShowAddContactModal,
  } = useAppStore();

  const filteredChats = chats.filter(chat =>
    chat.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.contact.phone.includes(searchQuery)
  );

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone.includes(searchQuery) ||
    contact.loanId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-panel border-r border-panel-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-panel-header border-b border-panel-border">
        <h1 className="text-xl font-semibold text-primary">Lotus</h1>
        <div className="flex items-center gap-2">
          {navItems.map(({ mode, icon: Icon }) => (
            <Button
              key={mode}
              variant="ghost"
              size="icon"
              onClick={() => setViewMode(mode)}
              className={cn(
                'h-9 w-9',
                viewMode === mode && 'bg-accent text-primary'
              )}
            >
              <Icon className="h-5 w-5" />
            </Button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-panel-border">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={viewMode === 'contacts' ? 'Search contacts...' : 'Search chats...'}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {viewMode === 'chats' && (
          <>
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No chats yet</p>
              </div>
            ) : (
              filteredChats
                .sort((a, b) => {
                  const aTime = a.lastMessage?.timestamp.getTime() || 0;
                  const bTime = b.lastMessage?.timestamp.getTime() || 0;
                  return bTime - aTime;
                })
                .map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isActive={activeChat?.id === chat.id}
                    onClick={() => setActiveChat(chat)}
                  />
                ))
            )}
          </>
        )}

        {viewMode === 'contacts' && (
          <>
            <Button
              onClick={() => setShowAddContactModal(true)}
              className="w-full justify-start gap-3 rounded-none h-14 px-4 border-b border-panel-border bg-transparent hover:bg-accent/50 text-foreground"
            >
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-medium">Add Contact</span>
            </Button>
            
            {filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-4">
                <Users className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No contacts found</p>
              </div>
            ) : (
              filteredContacts.map(contact => (
                <ContactListItem
                  key={contact.id}
                  contact={contact}
                  onClick={() => {
                    const chat = chats.find(c => c.contact.id === contact.id);
                    if (chat) {
                      setActiveChat(chat);
                      setViewMode('chats');
                    }
                  }}
                />
              ))
            )}
          </>
        )}

        {viewMode === 'settings' && <SettingsView />}
      </div>
    </div>
  );
}
