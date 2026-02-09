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

  // Handle opening a chat
  const handleOpenChat = (chat: any) => {
    setActiveChat(chat);
    setShowChatView(true);
  };

  // Handle going back from chat view
  const handleBackFromChat = () => {
    setShowChatView(false);
    setActiveChat(null);
  };

  // Handle new chat selection
  const handleNewChatSelect = (contact: any) => {
    const chat = chats.find(c => c.contact.id === contact.id);
    if (chat) {
      handleOpenChat(chat);
    }
    setShowNewChatModal(false);
  };

  // Show settings as full page
  if (viewMode === 'settings') {
    return (
      <div className="h-[100dvh] flex flex-col bg-background">
        <div className="flex items-center gap-2 px-4 py-3 bg-panel-header border-b border-panel-border shrink-0">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setViewMode('chats')}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
        <div className="flex-1 overflow-hidden">
          <SettingsPage />
        </div>
        <AddContactModal />
      </div>
    );
  }

  // Show contact panel as full screen on mobile
  if (showContactPanel && activeChat) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background">
        <div className="flex items-center gap-2 px-4 py-3 bg-panel-header border-b border-panel-border shrink-0">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowContactPanel(false)}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Contact Info</h1>
        </div>
        <div className="flex-1 overflow-hidden">
          <ContactPanel />
        </div>
        <AddContactModal />
      </div>
    );
  }

  // Show full screen chat view when a chat is selected
  if (showChatView && activeChat) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
        <ChatView onBack={handleBackFromChat} showBackButton={true} />
        <AddContactModal />
      </div>
    );
  }

  // Default: Show chat/contacts list with bottom navigation
  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ChatList 
          onChatSelect={handleOpenChat} 
          onNewChat={() => setShowNewChatModal(true)}
        />
      </div>

      {/* Bottom Navigation - iOS Tab Bar Style */}
      <nav className="flex items-center justify-around bg-panel-header border-t border-panel-border py-2 pb-safe shrink-0">
        {navItems.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-lg transition-colors min-w-[72px]',
              viewMode === mode 
                ? 'text-primary' 
                : 'text-muted-foreground'
            )}
          >
            <Icon className="h-6 w-6" />
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