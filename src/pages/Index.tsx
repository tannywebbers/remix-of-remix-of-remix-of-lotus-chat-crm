import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/appStore';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { loadData, loading, dataLoaded, addMessage, addContact, contacts } = useAppStore();

  // Apply persisted theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('app_theme') || 'light';
    const isDark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Load data from server on auth
  useEffect(() => {
    if (user) {
      loadData(user.id);
    }
  }, [user, loadData]);

  // Global realtime listener for new incoming messages (works across all chats)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const m = payload.new as any;
        if (!m.is_outgoing) {
          const msg = {
            id: m.id, contactId: m.contact_id, content: m.content,
            type: m.type as any, status: m.status as any,
            isOutgoing: false, timestamp: new Date(m.created_at),
            mediaUrl: m.media_url || undefined,
            whatsappMessageId: m.whatsapp_message_id || undefined,
          };
          // Check if the contact exists
          const state = useAppStore.getState();
          const contactExists = state.contacts.find(c => c.id === m.contact_id);
          if (!contactExists) {
            // Reload data to pick up webhook-created contacts
            loadData(user.id);
          } else {
            addMessage(m.contact_id, msg);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading && !dataLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
};

export default Index;
