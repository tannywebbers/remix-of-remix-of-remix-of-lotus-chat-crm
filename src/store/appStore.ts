import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { ViewMode, Message, Chat, Contact } from '@/types';

interface AppState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  addContacts: (contacts: Contact[]) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;

  chats: Chat[];
  setChats: (chats: Chat[]) => void;
  activeChat: Chat | null;
  setActiveChat: (chat: Chat | null) => void;

  messages: Record<string, Message[]>;
  setMessages: (contactId: string, messages: Message[]) => void;
  addMessage: (contactId: string, message: Message) => void;
  updateMessageStatus: (contactId: string, messageId: string, status: Message['status']) => void;

  drafts: Record<string, string>;
  setDraft: (contactId: string, text: string) => void;

  loading: boolean;
  setLoading: (loading: boolean) => void;
  loadData: (userId: string) => Promise<void>;

  showContactPanel: boolean;
  setShowContactPanel: (show: boolean) => void;

  showAddContactModal: boolean;
  setShowAddContactModal: (show: boolean) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      viewMode: 'chats',
      setViewMode: (mode) => set({ viewMode: mode }),

      contacts: [],
      setContacts: (contacts) => set({ contacts }),
      addContact: (contact) => {
        set((state) => ({
          contacts: [...state.contacts, contact],
          chats: [...state.chats, { id: contact.id, contact, unreadCount: 0 }],
        }));
      },
      addContacts: (contacts) => {
        set((state) => ({
          contacts: [...state.contacts, ...contacts],
          chats: [...state.chats, ...contacts.map(c => ({ id: c.id, contact: c, unreadCount: 0 }))],
        }));
      },
      updateContact: (id, updates) => set((state) => ({
        contacts: state.contacts.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c),
        chats: state.chats.map(chat =>
          chat.contact.id === id ? { ...chat, contact: { ...chat.contact, ...updates, updatedAt: new Date() } } : chat
        ),
        activeChat: state.activeChat?.id === id
          ? { ...state.activeChat, contact: { ...state.activeChat.contact, ...updates, updatedAt: new Date() } }
          : state.activeChat,
      })),
      deleteContact: (id) => set((state) => ({
        contacts: state.contacts.filter(c => c.id !== id),
        chats: state.chats.filter(c => c.id !== id),
        activeChat: state.activeChat?.id === id ? null : state.activeChat,
      })),

      chats: [],
      setChats: (chats) => set({ chats }),
      activeChat: null,
      setActiveChat: (chat) => set({ activeChat: chat, showContactPanel: false }),

      messages: {},
      setMessages: (contactId, messages) => set((state) => ({
        messages: { ...state.messages, [contactId]: messages },
      })),
      addMessage: (contactId, message) => set((state) => ({
        messages: {
          ...state.messages,
          [contactId]: [...(state.messages[contactId] || []), message],
        },
        chats: state.chats.map(chat =>
          chat.id === contactId ? { ...chat, lastMessage: message } : chat
        ),
      })),
      updateMessageStatus: (contactId, messageId, status) => set((state) => ({
        messages: {
          ...state.messages,
          [contactId]: (state.messages[contactId] || []).map(m =>
            m.id === messageId ? { ...m, status } : m
          ),
        },
      })),

      drafts: {},
      setDraft: (contactId, text) => set((state) => ({
        drafts: { ...state.drafts, [contactId]: text },
      })),

      loading: true,
      setLoading: (loading) => set({ loading }),

      loadData: async (userId: string) => {
        const cached = get();
        if (cached.contacts.length > 0) {
          set({ loading: false });
        } else {
          set({ loading: true });
        }

        try {
          const { data: contactsData, error: contactsError } = await supabase
            .from('contacts')
            .select(`*, account_details (*)`)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (contactsError) throw contactsError;

          const contacts: Contact[] = (contactsData || []).map((c: any) => ({
            id: c.id, loanId: c.loan_id, name: c.name, phone: c.phone,
            amount: c.amount ? Number(c.amount) : undefined,
            appType: c.app_type || 'tloan', dayType: c.day_type ?? 0,
            isOnline: c.is_online || false,
            lastSeen: c.last_seen ? new Date(c.last_seen) : undefined,
            avatar: c.avatar_url || undefined,
            isPinned: c.is_pinned || false, isMuted: c.is_muted || false, isArchived: c.is_archived || false,
            createdAt: new Date(c.created_at), updatedAt: new Date(c.updated_at),
            accountDetails: (c.account_details || []).map((ad: any) => ({
              id: ad.id, bank: ad.bank, accountNumber: ad.account_number, accountName: ad.account_name,
            })),
          }));

          const { data: messagesData, error: messagesError } = await supabase
            .from('messages').select('*').eq('user_id', userId).order('created_at', { ascending: true });

          if (messagesError) throw messagesError;

          const messagesMap: Record<string, Message[]> = {};
          const lastMessages: Record<string, Message> = {};

          (messagesData || []).forEach((m: any) => {
            const message: Message = {
              id: m.id, contactId: m.contact_id, content: m.content,
              type: m.type as Message['type'], status: m.status as Message['status'],
              isOutgoing: m.is_outgoing, timestamp: new Date(m.created_at),
              mediaUrl: m.media_url || undefined,
              whatsappMessageId: m.whatsapp_message_id || undefined,
              templateName: m.template_name || undefined,
              templateParams: m.template_params as Record<string, string> || undefined,
            };
            if (!messagesMap[m.contact_id]) messagesMap[m.contact_id] = [];
            messagesMap[m.contact_id].push(message);
            lastMessages[m.contact_id] = message;
          });

          const chats: Chat[] = contacts.filter(c => !c.isArchived).map(contact => ({
            id: contact.id, contact,
            lastMessage: lastMessages[contact.id], unreadCount: 0,
            isPinned: contact.isPinned, isMuted: contact.isMuted, isArchived: contact.isArchived,
          }));

          chats.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const aTime = a.lastMessage?.timestamp.getTime() || 0;
            const bTime = b.lastMessage?.timestamp.getTime() || 0;
            return bTime - aTime;
          });

          set({ contacts, chats, messages: messagesMap, loading: false });
        } catch (error) {
          console.error('Error loading data:', error);
          set({ loading: false });
        }
      },

      showContactPanel: false,
      setShowContactPanel: (show) => set({ showContactPanel: show }),

      showAddContactModal: false,
      setShowAddContactModal: (show) => set({ showAddContactModal: show }),

      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: 'lotus-crm-store',
      partialize: (state) => ({
        viewMode: state.viewMode,
        contacts: state.contacts,
        chats: state.chats,
        messages: state.messages,
        drafts: state.drafts,
      }),
    }
  )
);
