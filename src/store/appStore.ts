import { create } from 'zustand';
import { Contact, Chat, Message, ViewMode } from '@/types';

interface AppState {
  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  
  // Contacts
  contacts: Contact[];
  addContact: (contact: Contact) => void;
  addContacts: (contacts: Contact[]) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  
  // Chats
  chats: Chat[];
  activeChat: Chat | null;
  setActiveChat: (chat: Chat | null) => void;
  
  // Messages
  messages: Record<string, Message[]>;
  addMessage: (contactId: string, message: Message) => void;
  
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

// Mock data for demo
const mockContacts: Contact[] = [
  {
    id: '1',
    loanId: 'LN-001',
    name: 'Rahul Sharma',
    phone: '+91 98765 43210',
    amount: 50000,
    isOnline: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    accountDetails: [
      { id: '1', bank: 'HDFC Bank', accountNumber: '1234567890', accountName: 'Rahul Sharma' }
    ]
  },
  {
    id: '2',
    loanId: 'LN-002',
    name: 'Priya Patel',
    phone: '+91 87654 32109',
    amount: 75000,
    isOnline: false,
    lastSeen: new Date(Date.now() - 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    loanId: 'LN-003',
    name: 'Amit Kumar',
    phone: '+91 76543 21098',
    amount: 100000,
    isOnline: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockChats: Chat[] = mockContacts.map(contact => ({
  id: contact.id,
  contact,
  unreadCount: Math.floor(Math.random() * 5),
  lastMessage: {
    id: '1',
    contactId: contact.id,
    content: 'Thank you for the update on my loan status.',
    type: 'text' as const,
    status: 'read' as const,
    isOutgoing: false,
    timestamp: new Date(Date.now() - Math.random() * 86400000),
  },
}));

const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: '1',
      contactId: '1',
      content: 'Hello! I wanted to check on my loan application status.',
      type: 'text',
      status: 'read',
      isOutgoing: false,
      timestamp: new Date(Date.now() - 7200000),
    },
    {
      id: '2',
      contactId: '1',
      content: 'Hi Rahul! Your loan application LN-001 has been approved. The amount of ₹50,000 will be disbursed within 24 hours.',
      type: 'text',
      status: 'read',
      isOutgoing: true,
      timestamp: new Date(Date.now() - 7100000),
    },
    {
      id: '3',
      contactId: '1',
      content: 'That\'s great news! Thank you so much for the quick processing.',
      type: 'text',
      status: 'read',
      isOutgoing: false,
      timestamp: new Date(Date.now() - 7000000),
    },
    {
      id: '4',
      contactId: '1',
      content: 'You\'re welcome! Please let me know if you have any questions.',
      type: 'text',
      status: 'delivered',
      isOutgoing: true,
      timestamp: new Date(Date.now() - 3600000),
    },
  ],
};

export const useAppStore = create<AppState>((set) => ({
  viewMode: 'chats',
  setViewMode: (mode) => set({ viewMode: mode }),
  
  contacts: mockContacts,
  addContact: (contact) => set((state) => ({ 
    contacts: [...state.contacts, contact],
    chats: [...state.chats, { id: contact.id, contact, unreadCount: 0 }]
  })),
  addContacts: (contacts) => set((state) => ({ 
    contacts: [...state.contacts, ...contacts],
    chats: [...state.chats, ...contacts.map(c => ({ id: c.id, contact: c, unreadCount: 0 }))]
  })),
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
  
  chats: mockChats,
  activeChat: null,
  setActiveChat: (chat) => set({ activeChat: chat, showContactPanel: false }),
  
  messages: mockMessages,
  addMessage: (contactId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [contactId]: [...(state.messages[contactId] || []), message],
    },
    chats: state.chats.map(chat =>
      chat.id === contactId ? { ...chat, lastMessage: message } : chat
    ),
  })),
  
  showContactPanel: false,
  setShowContactPanel: (show) => set({ showContactPanel: show }),
  
  showAddContactModal: false,
  setShowAddContactModal: (show) => set({ showAddContactModal: show }),
  
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
