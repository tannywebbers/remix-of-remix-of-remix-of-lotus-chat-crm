import { useState } from 'react';
import { MessageCircle, Users, Settings, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ChatList } from '@/components/chat/ChatList';
import { ChatView } from '@/components/chat/ChatView';
import { ContactPanel } from '@/components/contacts/ContactPanel';
import { AddContactModal } from '@/components/contacts/AddContactModal';
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

  const handleChatSelect = () => {
    setShowChatView(true);
  };

  const handleBack = () => {
    setShowChatView(false);
    setActiveChat(null);
  };

  // Show contact panel as full screen on mobile
  if (showContactPanel && activeChat) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex items-center px-2 py-2 bg-panel-header border-b border-panel-border">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowContactPanel(false)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="ml-2 font-medium">Contact Info</span>
        </div>
        <ContactPanel />
        <AddContactModal />
      </div>
    );
  }

  // Show chat view when a chat is selected
  if (showChatView && activeChat) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Back button overlay on chat header */}
        <div className="flex items-center px-2 py-2 bg-panel-header border-b border-panel-border">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex flex-col -mt-14">
          <ChatView />
        </div>
        <AddContactModal />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ChatList />
      </div>

      {/* Bottom Navigation */}
      <nav className="flex items-center justify-around bg-panel-header border-t border-panel-border py-2 safe-area-pb">
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
