import { useState } from 'react';
import { MessageCircle, Users, Settings, Plus, Search, Edit, Star } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { SearchInput } from '@/components/shared/SearchInput';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { ContactListItem } from '@/components/contacts/ContactListItem';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ViewMode } from '@/types';

type ChatFilter = 'all' | 'unread' | 'favorites';

interface ChatListProps {
  onChatSelect?: (chat: any) => void;
  onNewChat?: () => void;
}

export function ChatList({ onChatSelect, onNewChat }: ChatListProps) {
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

  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');

  // Filter chats based on search and filter tab
  const filteredChats = chats
    .filter(chat => {
      const matchesSearch = chat.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.contact.phone.includes(searchQuery);
      
      if (!matchesSearch) return false;

      if (chatFilter === 'unread') return chat.unreadCount > 0;
      if (chatFilter === 'favorites') return chat.isPinned;
      return true;
    })
    .sort((a, b) => {
      // Pinned first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // Then by last message time
      const aTime = a.lastMessage?.timestamp.getTime() || 0;
      const bTime = b.lastMessage?.timestamp.getTime() || 0;
      return bTime - aTime;
    });

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone.includes(searchQuery) ||
    contact.loanId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatClick = (chat: any) => {
    setActiveChat(chat);
    onChatSelect?.(chat);
  };

  // Get section title based on view mode
  const getSectionTitle = () => {
    switch (viewMode) {
      case 'chats': return 'Chats';
      case 'contacts': return 'Contacts';
      case 'settings': return 'Settings';
      default: return 'Chats';
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel border-r border-panel-border">
      {/* Header - iOS Style */}
      <div className="flex items-center justify-between px-4 py-3 bg-panel-header border-b border-panel-border shrink-0">
        <h1 className="text-2xl font-bold text-foreground">{getSectionTitle()}</h1>
        <div className="flex items-center gap-1">
          {viewMode === 'chats' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-primary"
                onClick={onNewChat}
              >
                <Edit className="h-5 w-5" />
              </Button>
            </>
          )}
          {viewMode === 'contacts' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-primary"
              onClick={() => setShowAddContactModal(true)}
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-panel-border shrink-0">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={viewMode === 'contacts' ? 'Search contacts' : 'Search'}
        />
      </div>

      {/* Chat Filter Tabs - iOS Style */}
      {viewMode === 'chats' && (
        <div className="flex px-3 py-2 gap-2 border-b border-panel-border shrink-0 overflow-x-auto">
          {(['all', 'unread', 'favorites'] as ChatFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setChatFilter(filter)}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap',
                chatFilter === filter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : 'Favorites'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {viewMode === 'chats' && (
          <>
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">
                  {chatFilter === 'unread' 
                    ? 'No unread messages' 
                    : chatFilter === 'favorites' 
                    ? 'No favorite chats'
                    : 'No chats yet'}
                </p>
                <p className="text-xs mt-1">
                  {chatFilter === 'all' && 'Add contacts to start chatting'}
                </p>
              </div>
            ) : (
              filteredChats.map(chat => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isActive={activeChat?.id === chat.id}
                  onClick={() => handleChatClick(chat)}
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
              <span className="font-medium">New Contact</span>
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
                      handleChatClick(chat);
                      setViewMode('chats');
                    }
                  }}
                />
              ))
            )}
          </>
        )}

        {viewMode === 'settings' && (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Click Settings icon on mobile to open full settings</p>
          </div>
        )}
      </div>
    </div>
  );
}