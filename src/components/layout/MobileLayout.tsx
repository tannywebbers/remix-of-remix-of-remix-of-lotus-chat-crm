import { useState } from 'react';
import { MessageCircle, Users, Settings, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ChatList } from '@/components/chat/ChatList';
import { ChatView } from '@/components/chat/ChatView';
import { ContactPanel } from '@/components/contacts/ContactPanel';
import { AddContactModal } from '@/components/contacts/AddContactModal';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ViewMode } from '@/types';

const navItems: { mode: ViewMode; icon: typeof MessageCircle; label: string }[] = [
  { mode: 'chats', icon: MessageCircle, label: 'Chats' },
  { mode: 'contacts', icon: Users, label: 'Contacts' },
  { mode: 'settings', icon: Settings, label: 'Settings' },
];

export function MobileLayout() {
  const { viewMode, setViewMode, activeChat, setActiveChat, showContactPanel, setShowContactPanel } = useAppStore();
  const [showChatView, setShowChatView] = useState(false);

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

  // Default: Show chat list with bottom navigation
  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ChatList onChatSelect={handleOpenChat} />
      </div>

      {/* Bottom Navigation */}
      <nav className="flex items-center justify-around bg-panel-header border-t border-panel-border py-2 pb-safe shrink-0">
        {navItems.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors',
              viewMode === mode 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-6 w-6" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </nav>

      <AddContactModal />
    </div>
  );
}
