import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, CheckSquare, MessageCircle, Plus, Send, Settings2, SortAsc, SortDesc, SquarePen, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/shared/SearchInput';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { ContactListItem } from '@/components/contacts/ContactListItem';
import { LabelManagerPanel } from '@/components/chat/LabelManagerPanel';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ChatFilter = 'all' | 'unread' | 'archived';
type SortBy = 'recent' | 'name' | 'amount';
type SortDir = 'asc' | 'desc';
type ContactSortBy = 'name' | 'recent' | 'amount' | 'loanId';

interface Label { id: string; name: string; color: string }
interface AppTemplate { id: string; name: string; body: string }
interface MetaTemplate { id: string; name: string; status?: string }

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
};

const resolveTemplate = (body: string, contact: any): string =>
  body.replace(/\{\{(\w+)\}\}/g, (match, variableName) => VARIABLE_MAP[variableName]?.(contact) || match);

export function ChatList({ onChatSelect, onNewChat }: ChatListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    viewMode, setViewMode, chats, contacts, activeChat, setActiveChat, searchQuery, setSearchQuery,
    setShowAddContactModal, favorites, deleteContact, addMessage,
  } = useAppStore();

  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [contactSortBy, setContactSortBy] = useState<ContactSortBy>('name');
  const [contactSortDir, setContactSortDir] = useState<SortDir>('asc');
  const [contactAppTypeFilter, setContactAppTypeFilter] = useState('all');
  const [contactDayTypeFilter, setContactDayTypeFilter] = useState('all');

  const [labels, setLabels] = useState<Label[]>([]);
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

  const fetchLabels = useCallback(async () => {
    if (!user) return;
    const [labelsRes, chatLabelsRes] = await Promise.all([
      supabase.from('labels' as any).select('*').eq('user_id', user.id),
      supabase.from('chat_labels' as any).select('*').eq('user_id', user.id),
    ]);

    setLabels(((labelsRes.data as any[]) || []) as Label[]);
    const map: Record<string, string[]> = {};
    ((chatLabelsRes.data as any[]) || []).forEach((entry: any) => {
      if (!map[entry.chat_id]) map[entry.chat_id] = [];
      map[entry.chat_id].push(entry.label_id);
    });
    setChatLabelMap(map);
  }, [user]);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    const [appRes, metaRes] = await Promise.all([
      supabase.from('app_templates' as any).select('*').eq('user_id', user.id).order('name'),
      supabase.from('whatsapp_templates' as any).select('*').eq('user_id', user.id).order('name'),
    ]);

    setAppTemplates((appRes.data as any[]) || []);
    setMetaTemplates((((metaRes.data as any[]) || []).filter((t: any) => t.status === 'APPROVED')));
  }, [user]);

  useEffect(() => { fetchLabels(); fetchTemplates(); }, [fetchLabels, fetchTemplates]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`labels-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labels', filter: `user_id=eq.${user.id}` }, fetchLabels)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_labels', filter: `user_id=eq.${user.id}` }, fetchLabels)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchLabels]);

  const archivedCount = chats.filter((c) => c.isArchived || c.contact.isArchived).length;

  const filteredChats = chats
    .filter((chat) => {
      const matchesSearch = chat.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) || chat.contact.phone.includes(searchQuery);
      if (!matchesSearch) return false;
      if (chatFilter === 'archived') return !!(chat.isArchived || chat.contact.isArchived);
      if (chat.isArchived || chat.contact.isArchived) return false;
      if (chatFilter === 'unread' && chat.unreadCount <= 0) return false;
      if (selectedLabelId) return (chatLabelMap[chat.id] || []).includes(selectedLabelId);
      return true;
    })
    .sort((a, b) => {
      if ((favorites[b.id] ? 1 : 0) !== (favorites[a.id] ? 1 : 0)) return (favorites[b.id] ? 1 : 0) - (favorites[a.id] ? 1 : 0);
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      let cmp = 0;
      if (sortBy === 'name') cmp = a.contact.name.localeCompare(b.contact.name);
      else if (sortBy === 'amount') cmp = (a.contact.amount || 0) - (b.contact.amount || 0);
      else cmp = (b.lastMessage?.timestamp.getTime() || b.contact.createdAt.getTime()) - (a.lastMessage?.timestamp.getTime() || a.contact.createdAt.getTime());

      return sortDir === 'asc' ? cmp : (sortBy === 'recent' ? cmp : -cmp);
    });

  const appTypeOptions = useMemo(() => ['all', ...Array.from(new Set(contacts.map((c) => (c.appType || 'unknown').toLowerCase())))], [contacts]);
  const dayTypeOptions = useMemo(() => ['all', ...Array.from(new Set(contacts.map((c) => String(c.dayType ?? '0'))))], [contacts]);

  const filteredContacts = contacts
    .filter((contact) => contact.name.toLowerCase().includes(searchQuery.toLowerCase()) || contact.phone.includes(searchQuery) || contact.loanId.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((contact) => contactAppTypeFilter === 'all' ? true : (contact.appType || '').toLowerCase() === contactAppTypeFilter)
    .filter((contact) => contactDayTypeFilter === 'all' ? true : String(contact.dayType ?? '0') === contactDayTypeFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (contactSortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (contactSortBy === 'amount') cmp = (a.amount || 0) - (b.amount || 0);
      else if (contactSortBy === 'loanId') cmp = a.loanId.localeCompare(b.loanId);
      else cmp = b.createdAt.getTime() - a.createdAt.getTime();
      return contactSortDir === 'asc' ? cmp : -cmp;
    });

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleDeleteSelectedContacts = async () => {
    if (!user || selectedContactIds.length === 0) return;
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
    if (!user || !selectedTemplateId || selectedContactIds.length === 0) return;
    setSendingBulk(true);
    try {
      const { data: settings } = await supabase.from('whatsapp_settings').select('*').eq('user_id', user.id).single();
      if (!settings?.api_token || !settings?.phone_number_id) {
        toast({ title: 'WhatsApp not configured', variant: 'destructive' });
        return;
      }

      const selectedContacts = contacts.filter((c) => selectedContactIds.includes(c.id));
      const appTemplate = appTemplates.find((t) => t.id === selectedTemplateId);
      const metaTemplate = metaTemplates.find((t) => t.id === selectedTemplateId);

      for (const contact of selectedContacts) {
        if (bulkSource === 'app' && appTemplate) {
          const content = resolveTemplate(appTemplate.body, contact);
          const { data } = await supabase.functions.invoke('whatsapp-api', {
            body: {
              action: 'send_message', token: settings.api_token, phoneNumberId: settings.phone_number_id,
              to: contact.phone, type: 'text', content,
            },
          });

          await supabase.from('messages').insert({
            user_id: user.id, contact_id: contact.id, content, type: 'text',
            status: data?.success ? 'sent' : 'failed', is_outgoing: true, whatsapp_message_id: data?.messageId || null,
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
              action: 'send_message', token: settings.api_token, phoneNumberId: settings.phone_number_id,
              to: contact.phone, type: 'template', templateName: metaTemplate.name, templateParams: {},
            },
          });
        }
      }

      toast({ title: `Queued messages to ${selectedContactIds.length} contact(s)` });
      setSelectedContactIds([]);
      setContactSelectionMode(false);
      setShowBulkDialog(false);
    } catch (error: any) {
      toast({ title: 'Bulk send failed', description: error.message, variant: 'destructive' });
    } finally {
      setSendingBulk(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel border-r border-panel-border">
      <div className="flex items-center justify-between px-4 pt-3 pb-1 bg-panel shrink-0">
        <h1 className="text-[32px] sm:text-[28px] font-extrabold tracking-tight text-foreground ios-header">{viewMode === 'contacts' ? 'Contacts' : 'Chats'}</h1>
        <div className="flex items-center gap-1">
          {viewMode === 'chats' && (
            <>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-black" onClick={() => setShowLabelManager(true)}><Settings2 className="h-5 w-5 stroke-[2.8px]" /></Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-black" onClick={onNewChat}><SquarePen className="h-5 w-5 stroke-[2.8px]" /></Button>
            </>
          )}
          {viewMode === 'contacts' && (
            <>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-black" onClick={() => setShowAddContactModal(true)}><Plus className="h-5 w-5 stroke-[2.8px]" /></Button>
              <Button variant={contactSelectionMode ? 'default' : 'ghost'} size="icon" className="h-10 w-10" onClick={() => { setContactSelectionMode((v) => !v); setSelectedContactIds([]); }}><CheckSquare className="h-5 w-5" /></Button>
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-2 shrink-0">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={viewMode === 'contacts' ? 'Search contacts' : 'Search'} />
      </div>

      {viewMode === 'chats' && (
        <div className="px-4 pb-2 shrink-0 flex flex-wrap gap-2">
          <Button size="sm" variant={chatFilter === 'all' ? 'default' : 'secondary'} className={cn('rounded-full', chatFilter === 'all' && 'text-white')} onClick={() => setChatFilter('all')}>All</Button>
          <Button size="sm" variant={chatFilter === 'unread' ? 'default' : 'secondary'} className={cn('rounded-full', chatFilter === 'unread' && 'text-white')} onClick={() => setChatFilter('unread')}>Unread</Button>
          <Button size="sm" variant={chatFilter === 'archived' ? 'default' : 'secondary'} className={cn('rounded-full', chatFilter === 'archived' && 'text-white')} onClick={() => setChatFilter('archived')}><Archive className="h-3.5 w-3.5 mr-1" />Archived</Button>
          {labels.map((label) => (
            <Button key={label.id} size="sm" variant={selectedLabelId === label.id ? 'default' : 'secondary'} className="rounded-full" onClick={() => setSelectedLabelId((prev) => prev === label.id ? null : label.id)}>
              <span className="h-2 w-2 rounded-full mr-1" style={{ backgroundColor: label.color }} />
              {label.name}
            </Button>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="secondary" className="rounded-full"><SortAsc className="h-3.5 w-3.5 mr-1" />Sort</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy('recent')}>Recent</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('name')}>Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('amount')}>Amount</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>{sortDir === 'asc' ? 'Descending' : 'Ascending'}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {viewMode === 'contacts' && (
        <div className="px-4 pb-2 shrink-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" variant="secondary" className="rounded-full"><SortAsc className="h-3.5 w-3.5 mr-1" />Sort</Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setContactSortBy('name')}>Name</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setContactSortBy('recent')}>Recent</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setContactSortBy('amount')}>Amount</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setContactSortBy('loanId')}>Loan ID</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setContactSortDir(contactSortDir === 'asc' ? 'desc' : 'asc')}>{contactSortDir === 'asc' ? <><SortDesc className='h-3.5 w-3.5 mr-1' />Descending</> : <><SortAsc className='h-3.5 w-3.5 mr-1' />Ascending</>}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <select value={contactDayTypeFilter} onChange={(e) => setContactDayTypeFilter(e.target.value)} className="h-8 rounded-full px-3 text-xs border bg-secondary">
              {dayTypeOptions.map((v) => <option key={v} value={v}>{v === 'all' ? 'All day types' : `Day ${v}`}</option>)}
            </select>

            <select value={contactAppTypeFilter} onChange={(e) => setContactAppTypeFilter(e.target.value)} className="h-8 rounded-full px-3 text-xs border bg-secondary">
              {appTypeOptions.map((v) => <option key={v} value={v}>{v === 'all' ? 'All app types' : v.toUpperCase()}</option>)}
            </select>
          </div>

          {contactSelectionMode && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="destructive" onClick={handleDeleteSelectedContacts} disabled={selectedContactIds.length === 0}><Trash2 className="h-4 w-4 mr-1" />Delete ({selectedContactIds.length})</Button>
              <Button size="sm" onClick={() => setShowBulkDialog(true)} disabled={selectedContactIds.length === 0}><Send className="h-4 w-4 mr-1" />Message ({selectedContactIds.length})</Button>
            </div>
          )}
        </div>
      )}

      <div ref={listContainerRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {viewMode === 'chats' && (
          filteredChats.length === 0
            ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4"><MessageCircle className="h-14 w-14 mb-3 opacity-40" /><p className="text-[15px]">No chats yet</p></div>
            : filteredChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={activeChat?.id === chat.id}
                onClick={() => { setActiveChat(chat); onChatSelect?.(chat); }}
                chatLabels={labels.filter((l) => (chatLabelMap[chat.id] || []).includes(l.id))}
                allLabels={labels}
              />
            ))
        )}

        {viewMode === 'contacts' && (
          <>
            <button onClick={() => setShowAddContactModal(true)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 border-b border-panel-border">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center"><Plus className="h-5 w-5 text-primary-foreground" /></div>
              <span className="text-[17px] font-medium text-primary">New Contact</span>
            </button>

            {filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-4"><Users className="h-14 w-14 mb-3 opacity-40" /><p className="text-[15px]">No contacts found</p></div>
            ) : filteredContacts.map((contact) => (
              <ContactListItem
                key={contact.id}
                contact={contact}
                labels={labels.filter((l) => (chatLabelMap[contact.id] || []).includes(l.id))}
                selectionMode={contactSelectionMode}
                selected={selectedContactIds.includes(contact.id)}
                onToggleSelect={toggleContactSelection}
                onClick={() => {
                  const chat = chats.find((c) => c.contact.id === contact.id);
                  if (chat) {
                    setActiveChat(chat);
                    onChatSelect?.(chat);
                    setViewMode('chats');
                  }
                }}
              />
            ))}
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
            <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="w-full h-10 border rounded-md px-3 bg-background">
              <option value="">Select a template</option>
              {(bulkSource === 'app' ? appTemplates : metaTemplates).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Button className="w-full" onClick={handleBulkTemplateSend} disabled={sendingBulk || !selectedTemplateId || selectedContactIds.length === 0}>{sendingBulk ? 'Sending...' : `Send to ${selectedContactIds.length} contact(s)`}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
