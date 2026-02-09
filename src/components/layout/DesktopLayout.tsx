import { ChatList } from '@/components/chat/ChatList';
import { ChatView } from '@/components/chat/ChatView';
import { ContactPanel } from '@/components/contacts/ContactPanel';
import { AddContactModal } from '@/components/contacts/AddContactModal';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { useAppStore } from '@/store/appStore';

export function DesktopLayout() {
  const { showContactPanel, activeChat, viewMode } = useAppStore();

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Sidebar - always shows ChatList/Contacts/Settings based on viewMode */}
      <div className="w-[380px] lg:w-[420px] shrink-0 flex flex-col border-r border-panel-border">
        {viewMode === 'settings' ? (
          <SettingsPage />
        ) : (
          <ChatList />
        )}
      </div>

      {/* Chat View */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatView />
      </div>

      {/* Contact Details Panel */}
      {activeChat && showContactPanel && <ContactPanel />}

      <AddContactModal />
    </div>
  );
}
