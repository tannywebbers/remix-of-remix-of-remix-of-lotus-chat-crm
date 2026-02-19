import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageCircle, Users, Plus, SquarePen, Archive, Tag, SortAsc, SortDesc, Settings2, CheckSquare, Trash2, Send } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { SearchInput } from '@/components/shared/SearchInput';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { ContactListItem } from '@/components/contacts/ContactListItem';
import { LabelManagerPanel } from '@/components/chat/LabelManagerPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ChatFilter = 'all' | 'unread' | 'archived';
type SortBy = 'recent' | 'name' | 'amount';
type SortDir = 'asc' | 'desc';
type ContactSortBy = 'name' | 'recent' | 'amount' | 'loanId';

interface Label {
  id: string;
  name: string;
  color: string;
}

interface AppTemplate {
  id: string;
  name: string;
  body: string;
}

interface MetaTemplate {
  id: string;
  name: string;
  components?: any[];
  status?: string;
}

interface ChatListProps {
  onChatSelect?: (chat: any) => void;
  onNewChat?: () => void;
}

const VARIABLE_MAP: Record<string, (c: any) => string> = {
  customer_name: (c) => c.name,
  loan_id: (c) => c.loanId,
  amount: (c) => c.amount?.toString() || '',
  phone_number: (c) => c.phone,
  app_name: (c) => c.appType || 'Tloan',
  day_type: (c) => c.dayType?.toString() || '',
  due_date: () => '',
  account_number: (c) => c.accountDetails?.[0]?.accountNumber || '',
  payment_details: (c) => c.accountDetails?.map((a: any) => `${a.bank} - ${a.accountNumber} (${a.accountName})`).join('; ') || '',
  current_date: () => new Date().toLocaleDateString(),
  current_time: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

const resolveTemplate = (body: string, contact: any): string =>
  body.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const resolver = VARIABLE_MAP[varName];
    return resolver ? resolver(contact) || match : match;
  });

export function ChatList({ onChatSelect, onNewChat }: ChatListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
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
    deleteContact,
    addMessage,
  } = useAppStore();

  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [contactSortBy, setContactSortBy] = useState<ContactSortBy>('name');
  const [contactSortDir, setContactSortDir] = useState<SortDir>('asc');
  const [contactAppTypeFilter, setContactAppTypeFilter] = useState<string>('all');
  const [contactDayTypeFilter, setContactDayTypeFilter] = useState<string>('all');

  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [chatLabelMap, setChatLabelMap] = useState<Record<string, string[]>>({});
  const [showLabelManager, setShowLabelManager] = useState(false);

  const [contactSelectionMode, setContactSelectionMode] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkSource, setBulkSource] = useState<'app' | 'meta'>('app');
  const [appTemplates, setAppTemplates] = useState<AppTemplate[]>([]);
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sendingBulk, setSendingBulk] = useState(false);

  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const restoreListScroll = useCallback(() => {
    const key = viewMode === 'contacts' ? 'lotus_contacts_scroll' : 'lotus_chats_scroll';
    const saved = Number(sessionStorage.getItem(key) || '0');
    if (listContainerRef.current) listContainerRef.current.scrollTop = saved;
  }, [viewMode]);

  const persistListScroll = useCallback(() => {
    const key = viewMode === 'contacts' ? 'lotus_contacts_scroll' : 'lotus_chats_scroll';
    if (listContainerRef.current) sessionStorage.setItem(key, String(listContainerRef.current.scrollTop));
  }, [viewMode]);

  const fetchLabels = useCallback(async () => {
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
  }, [user]);

  const fetchBulkTemplates = useCallback(async () => {
    if (!user) return;
    const [appRes, metaRes] = await Promise.all([
      supabase.from('app_templates' as any).select('*').eq('user_id', user.id).order('name'),
      supabase.from('whatsapp_templates' as any).select('*').eq('user_id', user.id).order('name'),
    ]);
    setAppTemplates((appRes.data as any[]) || []);
    setMetaTemplates(((metaRes.data as any[]) || []).filter((t: any) => t.status === 'APPROVED'));
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchLabels();
      fetchBulkTemplates();
    }
  }, [user, fetchLabels, fetchBulkTemplates]);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    restoreListScroll();
    const onScroll = () => persistListScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [viewMode, restoreListScroll, persistListScroll]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`labels-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labels', filter: `user_id=eq.${user.id}` }, fetchLabels)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_labels', filter: `user_id=eq.${user.id}` }, fetchLabels)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchLabels]);

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
      if (selectedLabelId) {
        const chatLabels = chatLabelMap[chat.id] || [];
        if (!chatLabels.includes(selectedLabelId)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aFav = favorites[a.id] ? 1 : 0;
      const bFav = favorites[b.id] ? 1 : 0;
      if (chatFilter !== 'archived' && aFav !== bFav) return bFav - aFav;
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      let cmp = 0;
      if (sortBy === 'name') cmp = a.contact.name.localeCompare(b.contact.name);
      else if (sortBy === 'amount') cmp = (a.contact.amount || 0) - (b.contact.amount || 0);
      else {
        const aTime = a.lastMessage?.timestamp.getTime() || a.contact.createdAt.getTime();
        const bTime = b.lastMessage?.timestamp.getTime() || b.contact.createdAt.getTime();
        cmp = bTime - aTime;
      }
      return sortDir === 'asc' ? cmp : (sortBy === 'recent' ? cmp : -cmp);
    });

  const appTypeOptions = useMemo(() => ['all', ...Array.from(new Set(contacts.map(c => (c.appType || 'unknown').toLowerCase())))], [contacts]);
  const dayTypeOptions = useMemo(() => ['all', ...Array.from(new Set(contacts.map(c => String(c.dayType ?? '0'))))], [contacts]);

  const filteredContacts = contacts
    .filter(contact =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery) ||
      contact.loanId.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(contact => contactAppTypeFilter === 'all' ? true : (contact.appType || '').toLowerCase() === contactAppTypeFilter)
    .filter(contact => contactDayTypeFilter === 'all' ? true : String(contact.dayType ?? '0') === contactDayTypeFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (contactSortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (contactSortBy === 'amount') cmp = (a.amount || 0) - (b.amount || 0);
      else if (contactSortBy === 'loanId') cmp = a.loanId.localeCompare(b.loanId);
      else cmp = b.createdAt.getTime() - a.createdAt.getTime();
      return contactSortDir === 'asc' ? cmp : -cmp;
    });

  const handleChatClick = (chat: any) => {
    setActiveChat(chat);
    onChatSelect?.(chat);
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSelectedContacts = async () => {
    if (!user || selectedContactIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedContactIds.length} selected contact(s)?`)) return;

    const { error } = await supabase.from('contacts').delete().eq('user_id', user.id).in('id', selectedContactIds as any);
    if (error) {
      toast({ title: 'Failed to delete selected contacts', description: error.message, variant: 'destructive' });
      return;
    }

    selectedContactIds.forEach((id) => deleteContact(id));
    setSelectedContactIds([]);
    setContactSelectionMode(false);
    toast({ title: 'Selected contacts deleted' });
  };

  const handleBulkTemplateSend = async () => {
    if (!user || selectedContactIds.length === 0 || !selectedTemplateId) return;
    setSendingBulk(true);
    try {
      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!settings?.api_token || !settings?.phone_number_id) {
        toast({ title: 'WhatsApp not configured', variant: 'destructive' });
        setSendingBulk(false);
        return;
      }

      const selectedContacts = contacts.filter(c => selectedContactIds.includes(c.id));
      const appTemplate = appTemplates.find(t => t.id === selectedTemplateId);
      const metaTemplate = metaTemplates.find(t => t.id === selectedTemplateId);

      for (const contact of selectedContacts) {
        if (bulkSource === 'app' && appTemplate) {
          const content = resolveTemplate(appTemplate.body, contact);
          const { data } = await supabase.functions.invoke('whatsapp-api', {
            body: {
              action: 'send_message',
              token: settings.api_token,
              phoneNumberId: settings.phone_number_id,
              to: contact.phone,
              type: 'text',
              content,
            },
          });

          await supabase.from('messages').insert({
            user_id: user.id,
            contact_id: contact.id,
            content,
            type: 'text',
            status: data?.success ? 'sent' : 'failed',
            is_outgoing: true,
            whatsapp_message_id: data?.messageId || null,
          });

          if (data?.success) {
            addMessage(contact.id, {
              id: `bulk-${Date.now()}-${contact.id}`,
              contactId: contact.id,
              content,
              type: 'text',
              status: 'sent',
              isOutgoing: true,
              timestamp: new Date(),
              whatsappMessageId: data?.messageId,
            });
          }
        }

        if (bulkSource === 'meta' && metaTemplate) {
          await supabase.functions.invoke('whatsapp-api', {
            body: {
              action: 'send_message',
              token: settings.api_token,
              phoneNumberId: settings.phone_number_id,
              to: contact.phone,
              type: 'template',
              templateName: metaTemplate.name,
              templateParams: {},
            },
          });
        }
      }

      toast({ title: `Queued messages to ${selectedContacts.length} contact(s)` });
      setShowBulkDialog(false);
      setContactSelectionMode(false);
      setSelectedContactIds([]);
    } catch (err: any) {
      toast({ title: 'Bulk send failed', description: err.message, variant: 'destructive' });
    } finally {
      setSendingBulk(false);
    }
  };

  const sectionTitle = viewMode === 'contacts' ? 'Contacts' : viewMode === 'settings' ? 'Settings' : 'Chats';

  return (
    <div className="flex flex-col h-full bg-panel border-r border-panel-border">
      <div className="flex items-center justify-between px-4 pt-3 pb-1 bg-panel shrink-0">
        <h1 className="text-[32px] sm:text-[28px] font-extrabold tracking-tight text-foreground ios-header">{sectionTitle}</h1>
        <div className="flex items-center gap-1">
          {viewMode === 'chats' && (
            <>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-black" onClick={() => setShowLabelManager(true)} title="Manage Labels">
                <Settings2 className="h-[20px] w-[20px] stroke-[2.6px]" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-black" onClick={onNewChat}>
                <SquarePen className="h-[22px] w-[22px] stroke-[2.6px]" />
              </Button>
            </>
          )}
          {viewMode === 'contacts' && (
            <>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-black" onClick={() => setShowAddContactModal(true)}>
                <Plus className="h-[22px] w-[22px] stroke-[2.8px]" />
              </Button>
              <Button variant={contactSelectionMode ? 'default' : 'ghost'} size="icon" className="h-10 w-10" onClick={() => {
                setContactSelectionMode(!contactSelectionMode);
                setSelectedContactIds([]);
              }}>
                <CheckSquare className="h-[21px] w-[21px] stroke-[2.4px]" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-2 shrink-0">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={viewMode === 'contacts' ? 'Search contacts' : 'Search'} />
      </div>

      {viewMode === 'chats' && (
        <div className="px-4 py-1.5 shrink-0 space-y-1.5">
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'unread', 'archived'] as ChatFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => { setChatFilter(filter); setSelectedLabelId(null); }}
                className={cn(
                  'px-3 py-[6px] text-[13px] font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1',
                  chatFilter === filter && !selectedLabelId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {filter === 'archived' && <Archive className="h-3 w-3" />}
                {filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : `Archived${archivedCount > 0 ? ` (${archivedCount})` : ''}`}
              </button>
            ))}

            {labels.map(label => (
              <button
                key={label.id}
                onClick={() => { setSelectedLabelId(selectedLabelId === label.id ? null : label.id); setChatFilter('all'); }}
                className={cn(
                  'px-3 py-[6px] text-[13px] font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1',
                  selectedLabelId === label.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                <Tag className="h-3 w-3" style={{ color: label.color }} />
                {label.name}
              </button>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3 py-[6px] text-[13px] font-semibold rounded-full bg-muted text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  {sortDir === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />} Sort
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

      {viewMode === 'contacts' && (
        <div className="px-4 py-1.5 shrink-0 space-y-1.5">
          <div className="flex gap-2 overflow-x-auto">
            {appTypeOptions.map((appType) => (
              <button
                key={appType}
                onClick={() => setContactAppTypeFilter(appType)}
                className={cn('px-3 py-[6px] text-[13px] font-semibold rounded-full whitespace-nowrap',
                  contactAppTypeFilter === appType ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
              >
                {appType === 'all' ? 'All Apps' : appType.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {dayTypeOptions.map((dayType) => (
              <button
                key={dayType}
                onClick={() => setContactDayTypeFilter(dayType)}
                className={cn('px-3 py-[6px] text-[13px] font-semibold rounded-full whitespace-nowrap',
                  contactDayTypeFilter === dayType ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
              >
                {dayType === 'all' ? 'All Day Types' : `Day ${dayType}`}
              </button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3 py-[6px] text-[13px] font-semibold rounded-full bg-muted text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  {contactSortDir === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />} Sort
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setContactSortBy('name')}>Name</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setContactSortBy('recent')}>Recent</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setContactSortBy('amount')}>Amount</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setContactSortBy('loanId')}>Loan ID</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setContactSortDir(contactSortDir === 'asc' ? 'desc' : 'asc')}>
                  {contactSortDir === 'asc' ? 'Descending' : 'Ascending'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {contactSelectionMode && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="destructive" onClick={handleDeleteSelectedContacts} disabled={selectedContactIds.length === 0}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete ({selectedContactIds.length})
              </Button>
              <Button size="sm" onClick={() => setShowBulkDialog(true)} disabled={selectedContactIds.length === 0}>
                <Send className="h-4 w-4 mr-1" /> Message ({selectedContactIds.length})
              </Button>
            </div>
          )}
        </div>
      )}

      <div ref={listContainerRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {viewMode === 'chats' && (
          <>
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <MessageCircle className="h-14 w-14 mb-3 opacity-40" />
                <p className="text-[15px] font-medium">{chatFilter === 'unread' ? 'No unread messages' : chatFilter === 'archived' ? 'No archived chats' : 'No chats yet'}</p>
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
                    allLabels={labels}
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
              filteredContacts.map(contact => {
                const contactLabelIds = chatLabelMap[contact.id] || [];
                const resolvedContactLabels = labels.filter(l => contactLabelIds.includes(l.id));
                return (
                  <ContactListItem
                    key={contact.id}
                    contact={contact}
                    labels={resolvedContactLabels}
                    selectionMode={contactSelectionMode}
                    selected={selectedContactIds.includes(contact.id)}
                    onToggleSelect={toggleContactSelection}
                    onClick={() => {
                      const chat = chats.find(c => c.contact.id === contact.id);
                      if (chat) {
                        handleChatClick(chat);
                        setViewMode('chats');
                      }
                    }}
                  />
                );
              })
            )}
          </>
        )}
      </div>

      <LabelManagerPanel open={showLabelManager} onOpenChange={setShowLabelManager} onLabelsChanged={fetchLabels} />

      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Message Selected Contacts</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={bulkSource === 'app' ? 'default' : 'outline'} onClick={() => { setBulkSource('app'); setSelectedTemplateId(''); }}>App Template</Button>
              <Button variant={bulkSource === 'meta' ? 'default' : 'outline'} onClick={() => { setBulkSource('meta'); setSelectedTemplateId(''); }}>Meta Template</Button>
            </div>

            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select template</option>
              {(bulkSource === 'app' ? appTemplates : metaTemplates).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <Button className="w-full" onClick={handleBulkTemplateSend} disabled={!selectedTemplateId || sendingBulk || selectedContactIds.length === 0}>
              {sendingBulk ? 'Sending...' : `Send to ${selectedContactIds.length} Contact(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
