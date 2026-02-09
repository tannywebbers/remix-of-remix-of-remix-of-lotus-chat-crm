import { useState } from 'react';
import { MessageCircle, Users, Settings, ArrowLeft, Plus } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ChatList } from '@/components/chat/ChatList';
import { ChatView } from '@/components/chat/ChatView';
import { ContactPanel } from '@/components/contacts/ContactPanel';
import { AddContactModal } from '@/components/contacts/AddContactModal';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ViewMode } from '@/types';

const navItems: { mode: ViewMode; icon: typeof MessageCircle; label: string }[] = [
  { mode: 'chats', icon: MessageCircle, label: 'Chats' },
  { mode: 'contacts', icon: Users, label: 'Contacts' },
  { mode: 'settings', icon: Settings, label: 'Settings' },
];

export function MobileLayout() {
  const { viewMode, setViewMode, activeChat, setActiveChat, showContactPanel, setShowContactPanel, chats } = useAppStore();
  const [showChatView, setShowChatView] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const handleOpenChat = (chat: any) => {
    setActiveChat(chat);
    setShowChatView(true);
  };

  const handleBackFromChat = () => {
    setShowChatView(false);
    setActiveChat(null);
  };

  const handleNewChatSelect = (contact: any) => {
    const chat = chats.find(c => c.contact.id === contact.id);
    if (chat) {
      handleOpenChat(chat);
    }
    setShowNewChatModal(false);
  };

  // Show contact panel as full screen
  if (showContactPanel && activeChat) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background">
        <div className="flex items-center gap-2 px-4 py-3 bg-panel-header border-b border-panel-border shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setShowContactPanel(false)} className="h-9 w-9">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-[17px] font-semibold">Contact Info</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ContactPanel />
        </div>
        <AddContactModal />
      </div>
    );
  }

  // Full screen chat view when a chat is selected
  if (showChatView && activeChat) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
        <ChatView onBack={handleBackFromChat} showBackButton={true} />
        <AddContactModal />
      </div>
    );
  }

  // Main tabbed layout — tabs always visible
  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {viewMode === 'chats' && (
          <ChatList 
            onChatSelect={handleOpenChat} 
            onNewChat={() => setShowNewChatModal(true)}
          />
        )}
        {viewMode === 'contacts' && (
          <ChatList 
            onChatSelect={handleOpenChat} 
            onNewChat={() => setShowNewChatModal(true)}
          />
        )}
        {viewMode === 'settings' && (
          <SettingsPage />
        )}
      </div>

      {/* Bottom Tab Bar - iOS Style - ALWAYS VISIBLE */}
      <nav className="flex items-center justify-around bg-panel-header/95 backdrop-blur-lg border-t border-panel-border shrink-0 pb-safe">
        {navItems.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-6 py-2 min-w-[72px] transition-colors',
              viewMode === mode 
                ? 'text-primary' 
                : 'text-muted-foreground'
            )}
          >
            <Icon className={cn("h-[26px] w-[26px]", viewMode === mode && "stroke-[2.5px]")} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </nav>

      <AddContactModal />
      <NewChatModal 
        open={showNewChatModal} 
        onClose={() => setShowNewChatModal(false)}
        onSelectContact={handleNewChatSelect}
      />
    </div>
  );
}
