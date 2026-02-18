import { useState, useEffect } from 'react';
import { MessageCircle, Users, Plus, SquarePen, Archive, Star, Tag, SortAsc, SortDesc, Settings2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { SearchInput } from '@/components/shared/SearchInput';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { ContactListItem } from '@/components/contacts/ContactListItem';
import { LabelManagerPanel } from '@/components/chat/LabelManagerPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type ChatFilter = 'all' | 'unread' | 'favorites' | 'archived';
type SortBy = 'recent' | 'name' | 'amount';
type SortDir = 'asc' | 'desc';

interface Label {
  id: string;
  name: string;
  color: string;
}

interface ChatListProps {
  onChatSelect?: (chat: any) => void;
  onNewChat?: () => void;
}

export function ChatList({ onChatSelect, onNewChat }: ChatListProps) {
  const { user } = useAuth();
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
    favorites,
  } = useAppStore();

  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [chatLabelMap, setChatLabelMap] = useState<Record<string, string[]>>({});
  const [showLabelManager, setShowLabelManager] = useState(false);


  // Fetch labels
  const fetchLabels = async () => {
    if (!user) return;
    const [labelsRes, chatLabelsRes] = await Promise.all([
      supabase.from('labels' as any).select('*').eq('user_id', user.id),
      supabase.from('chat_labels' as any).select('*').eq('user_id', user.id),
    ]);
    setLabels(((labelsRes.data as any[]) || []) as Label[]);
    const map: Record<string, string[]> = {};
    ((chatLabelsRes.data as any[]) || []).forEach((cl: any) => {
      if (!map[cl.chat_id]) map[cl.chat_id] = [];
      map[cl.chat_id].push(cl.label_id);
    });
    setChatLabelMap(map);
  };

  useEffect(() => {
    if (user) fetchLabels();
  }, [user]);

  const archivedChats = chats.filter(c => c.isArchived || c.contact.isArchived);
  const archivedCount = archivedChats.length;

  const filteredChats = chats
    .filter(chat => {
      const matchesSearch = chat.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.contact.phone.includes(searchQuery);
      if (!matchesSearch) return false;
      
      if (chatFilter === 'archived') return chat.isArchived || chat.contact.isArchived;
      if (chat.isArchived || chat.contact.isArchived) return false;
      if (chatFilter === 'unread') return chat.unreadCount > 0;
      if (chatFilter === 'favorites') return favorites[chat.id];

      // Label filter
      if (selectedLabelId) {
        const chatLabels = chatLabelMap[chat.id] || [];
        if (!chatLabels.includes(selectedLabelId)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const aFav = favorites[a.id] ? 1 : 0;
      const bFav = favorites[b.id] ? 1 : 0;
      if (chatFilter !== 'archived') {
        if (aFav !== bFav) return bFav - aFav;
      }
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.contact.name.localeCompare(b.contact.name);
      } else if (sortBy === 'amount') {
        cmp = (a.contact.amount || 0) - (b.contact.amount || 0);
      } else {
        const aTime = a.lastMessage?.timestamp.getTime() || a.contact.createdAt.getTime();
        const bTime = b.lastMessage?.timestamp.getTime() || b.contact.createdAt.getTime();
        cmp = bTime - aTime; // newest first by default
      }
      return sortDir === 'asc' ? cmp : (sortBy === 'recent' ? cmp : -cmp);
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

  const sectionTitle = viewMode === 'contacts' ? 'Contacts' : viewMode === 'settings' ? 'Settings' : 'Chats';

  return (
    <div className="flex flex-col h-full bg-panel border-r border-panel-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 bg-panel shrink-0">
        <h1 className="text-[32px] sm:text-[28px] font-extrabold tracking-tight text-foreground ios-header">{sectionTitle}</h1>
        <div className="flex items-center gap-1">
          {viewMode === 'chats' && (
            <>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-primary" onClick={() => setShowLabelManager(true)} title="Manage Labels">
                <Settings2 className="h-[20px] w-[20px]" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-primary" onClick={onNewChat}>
                <SquarePen className="h-[22px] w-[22px]" />
              </Button>
            </>
          )}
          {viewMode === 'contacts' && (
            <Button variant="ghost" size="icon" className="h-10 w-10 text-primary" onClick={() => setShowAddContactModal(true)}>
              <Plus className="h-[22px] w-[22px] stroke-[2.5px]" />
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 shrink-0">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={viewMode === 'contacts' ? 'Search contacts' : 'Search'}
        />
      </div>

      {/* Chat Filter Tabs + Sort */}
      {viewMode === 'chats' && (
        <div className="px-4 py-1.5 shrink-0 space-y-1.5">
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'unread', 'favorites', 'archived'] as ChatFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => { setChatFilter(filter); setSelectedLabelId(null); }}
                className={cn(
                  'px-3 py-[6px] text-[13px] font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1',
                  chatFilter === filter && !selectedLabelId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {filter === 'favorites' && <Star className="h-3 w-3" />}
                {filter === 'archived' && <Archive className="h-3 w-3" />}
                {filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : filter === 'favorites' ? 'Favorites' : `Archived${archivedCount > 0 ? ` (${archivedCount})` : ''}`}
              </button>
            ))}

            {/* Label filters */}
            {labels.map(label => (
              <button
                key={label.id}
                onClick={() => { setSelectedLabelId(selectedLabelId === label.id ? null : label.id); setChatFilter('all'); }}
                className={cn(
                  'px-3 py-[6px] text-[13px] font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1',
                  selectedLabelId === label.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Tag className="h-3 w-3" />
                {label.name}
              </button>
            ))}

            {/* Sort dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3 py-[6px] text-[13px] font-semibold rounded-full bg-muted text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  {sortDir === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
                  Sort
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('recent')} className={sortBy === 'recent' ? 'font-bold' : ''}>Recent</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('name')} className={sortBy === 'name' ? 'font-bold' : ''}>Name</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('amount')} className={sortBy === 'amount' ? 'font-bold' : ''}>Amount</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>
                  {sortDir === 'asc' ? 'Descending' : 'Ascending'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {viewMode === 'chats' && (
          <>
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <MessageCircle className="h-14 w-14 mb-3 opacity-40" />
                <p className="text-[15px] font-medium">
                  {chatFilter === 'unread' ? 'No unread messages' 
                    : chatFilter === 'favorites' ? 'No favorite chats'
                    : chatFilter === 'archived' ? 'No archived chats'
                    : 'No chats yet'}
                </p>
                {chatFilter === 'all' && <p className="text-[13px] mt-1">Add contacts to start chatting</p>}
              </div>
            ) : (
              filteredChats.map(chat => {
                const chatLabelIds = chatLabelMap[chat.id] || [];
                const resolvedLabels = labels.filter(l => chatLabelIds.includes(l.id));
                return (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isActive={activeChat?.id === chat.id}
                    onClick={() => handleChatClick(chat)}
                    chatLabels={resolvedLabels}
                  />
                );
              })
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

      {/* Label Manager Panel */}
      <LabelManagerPanel
        open={showLabelManager}
        onOpenChange={setShowLabelManager}
        onLabelsChanged={fetchLabels}
      />
    </div>
  );
}
