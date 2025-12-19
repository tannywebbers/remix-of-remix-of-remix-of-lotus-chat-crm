import { ChatList } from '@/components/chat/ChatList';
import { ChatView } from '@/components/chat/ChatView';
import { ContactPanel } from '@/components/contacts/ContactPanel';
import { AddContactModal } from '@/components/contacts/AddContactModal';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { useAppStore } from '@/store/appStore';

export function DesktopLayout() {
  const { showContactPanel, activeChat, viewMode } = useAppStore();

  // Show full settings page on desktop
  if (viewMode === 'settings') {
    return (
      <div className="h-screen flex overflow-hidden bg-background">
        {/* Sidebar */}
        <div className="w-80 lg:w-96 shrink-0">
          <ChatList />
        </div>

        {/* Settings Content - Full Width */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-4xl mx-auto">
            <SettingsPage />
          </div>
        </div>

        <AddContactModal />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Chat List Panel */}
      <div className="w-80 lg:w-96 shrink-0">
        <ChatList />
      </div>

      {/* Chat View */}
      <ChatView />

      {/* Contact Details Panel */}
      {activeChat && showContactPanel && <ContactPanel />}

      {/* Add Contact Modal */}
      <AddContactModal />
    </div>
  );
}
