import { ChatList } from '@/components/chat/ChatList';
import { ChatView } from '@/components/chat/ChatView';
import { ContactPanel } from '@/components/contacts/ContactPanel';
import { AddContactModal } from '@/components/contacts/AddContactModal';
import { useAppStore } from '@/store/appStore';

export function DesktopLayout() {
  const { showContactPanel, activeChat } = useAppStore();

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
