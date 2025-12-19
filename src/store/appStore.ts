import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { ViewMode } from '@/types';

interface Contact {
  id: string;
  loanId: string;
  name: string;
  phone: string;
  amount?: number;
  appType?: string;
  dayType?: number;
  accountDetails?: AccountDetail[];
  avatar?: string;
  lastSeen?: Date;
  isOnline?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AccountDetail {
  id: string;
  bank: string;
  accountNumber: string;
  accountName: string;
}

interface Message {
  id: string;
  contactId: string;
  content: string;
  type: 'text' | 'image' | 'document';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isOutgoing: boolean;
  timestamp: Date;
  mediaUrl?: string;
}

interface Chat {
  id: string;
  contact: Contact;
  lastMessage?: Message;
  unreadCount: number;
}

interface AppState {
  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  
  // Contacts
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  addContacts: (contacts: Contact[]) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  
  // Chats
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
  activeChat: Chat | null;
  setActiveChat: (chat: Chat | null) => void;
  
  // Messages
  messages: Record<string, Message[]>;
  setMessages: (contactId: string, messages: Message[]) => void;
  addMessage: (contactId: string, message: Message) => void;
  
  // Data loading
  loading: boolean;
  setLoading: (loading: boolean) => void;
  loadData: (userId: string) => Promise<void>;
  
  // Contact Panel
  showContactPanel: boolean;
  setShowContactPanel: (show: boolean) => void;
  
  // Add Contact Modal
  showAddContactModal: boolean;
  setShowAddContactModal: (show: boolean) => void;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  viewMode: 'chats',
  setViewMode: (mode) => set({ viewMode: mode }),
  
  contacts: [],
  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) => {
    set((state) => ({ 
      contacts: [...state.contacts, contact],
      chats: [...state.chats, { id: contact.id, contact, unreadCount: 0 }]
    }));
  },
  addContacts: (contacts) => {
    set((state) => ({ 
      contacts: [...state.contacts, ...contacts],
      chats: [...state.chats, ...contacts.map(c => ({ id: c.id, contact: c, unreadCount: 0 }))]
    }));
  },
  updateContact: (id, updates) => set((state) => ({
    contacts: state.contacts.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c),
    chats: state.chats.map(chat => 
      chat.contact.id === id 
        ? { ...chat, contact: { ...chat.contact, ...updates, updatedAt: new Date() } }
        : chat
    ),
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
    messages: { ...state.messages, [contactId]: messages }
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
  
  loading: true,
  setLoading: (loading) => set({ loading }),
  
  loadData: async (userId: string) => {
    set({ loading: true });
    
    try {
      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          *,
          account_details (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (contactsError) throw contactsError;

      const contacts: Contact[] = (contactsData || []).map(c => ({
        id: c.id,
        loanId: c.loan_id,
        name: c.name,
        phone: c.phone,
        amount: c.amount ? Number(c.amount) : undefined,
        appType: c.app_type || 'tloan',
        dayType: c.day_type ?? 0,
        isOnline: c.is_online || false,
        lastSeen: c.last_seen ? new Date(c.last_seen) : undefined,
        avatar: c.avatar_url || undefined,
        createdAt: new Date(c.created_at),
        updatedAt: new Date(c.updated_at),
        accountDetails: (c.account_details || []).map((ad: any) => ({
          id: ad.id,
          bank: ad.bank,
          accountNumber: ad.account_number,
          accountName: ad.account_name,
        })),
      }));

      // Fetch messages for all contacts
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      const messagesMap: Record<string, Message[]> = {};
      const lastMessages: Record<string, Message> = {};

      (messagesData || []).forEach(m => {
        const message: Message = {
          id: m.id,
          contactId: m.contact_id,
          content: m.content,
          type: m.type as 'text' | 'image' | 'document',
          status: m.status as Message['status'],
          isOutgoing: m.is_outgoing,
          timestamp: new Date(m.created_at),
          mediaUrl: m.media_url || undefined,
        };
        
        if (!messagesMap[m.contact_id]) {
          messagesMap[m.contact_id] = [];
        }
        messagesMap[m.contact_id].push(message);
        lastMessages[m.contact_id] = message;
      });

      // Create chats from contacts
      const chats: Chat[] = contacts.map(contact => ({
        id: contact.id,
        contact,
        lastMessage: lastMessages[contact.id],
        unreadCount: 0,
      }));

      set({ 
        contacts, 
        chats, 
        messages: messagesMap,
        loading: false 
      });
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
}));
