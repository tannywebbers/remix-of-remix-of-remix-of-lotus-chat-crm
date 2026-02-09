import { useState } from 'react';
import { MessageCircle, Users, Settings, Plus, Search, SquarePen, Star } from 'lucide-react';
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
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
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

  // Section title
  const sectionTitle = viewMode === 'contacts' ? 'Contacts' : viewMode === 'settings' ? 'Settings' : 'Chats';

  return (
    <div className="flex flex-col h-full bg-panel border-r border-panel-border">
      {/* Header - iOS WhatsApp Style */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 bg-panel shrink-0">
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">{sectionTitle}</h1>
        <div className="flex items-center gap-1">
          {viewMode === 'chats' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-primary"
              onClick={onNewChat}
            >
              <SquarePen className="h-[22px] w-[22px]" />
            </Button>
          )}
          {viewMode === 'contacts' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-primary"
              onClick={() => setShowAddContactModal(true)}
            >
              <Plus className="h-[22px] w-[22px] stroke-[2.5px]" />
            </Button>
          )}
        </div>
      </div>

      {/* Search - iOS Style */}
      <div className="px-4 py-2 shrink-0">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={viewMode === 'contacts' ? 'Search contacts' : 'Search'}
        />
      </div>

      {/* Chat Filter Tabs - WhatsApp iOS pill style */}
      {viewMode === 'chats' && (
        <div className="flex px-4 py-1.5 gap-2 shrink-0">
          {(['all', 'unread', 'favorites'] as ChatFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setChatFilter(filter)}
              className={cn(
                'px-4 py-[6px] text-[13px] font-semibold rounded-full transition-all',
                chatFilter === filter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : 'Favorites'}
            </button>
          ))}
        </div>
      )}

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {viewMode === 'chats' && (
          <>
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <MessageCircle className="h-14 w-14 mb-3 opacity-40" />
                <p className="text-[15px] font-medium">
                  {chatFilter === 'unread' 
                    ? 'No unread messages' 
                    : chatFilter === 'favorites' 
                    ? 'No favorite chats'
                    : 'No chats yet'}
                </p>
                <p className="text-[13px] mt-1">
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
            <button
              onClick={() => setShowAddContactModal(true)}
              className="w-full flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors border-b border-panel-border"
            >
              <div className="h-[42px] w-[42px] rounded-full bg-primary flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary-foreground stroke-[2.5px]" />
              </div>
              <span className="text-[17px] font-medium text-primary">New Contact</span>
            </button>
            
            {filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-4">
                <Users className="h-14 w-14 mb-3 opacity-40" />
                <p className="text-[15px]">No contacts found</p>
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
      </div>
    </div>
  );
}
