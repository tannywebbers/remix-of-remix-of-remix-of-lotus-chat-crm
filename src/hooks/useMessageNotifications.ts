// Add this to your main App.tsx or layout component

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/appStore';

export function useMessageNotifications() {
  const { user } = useAuth();
  const { activeChat, contacts, addMessage } = useAppStore();

  useEffect(() => {
    if (!user) return;

    console.log('🔔 Notification listener started');

    // Listen for new incoming messages
    const channel = supabase
      .channel('realtime-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const message = payload.new as any;
          console.log('📨 New message received:', message);

          // Don't notify for outgoing messages
          if (message.is_outgoing) {
            console.log('↗️ Outgoing message, skip notification');
            return;
          }

          // Don't notify if this is the active chat (user is already viewing it)
          if (activeChat?.id === message.contact_id) {
            console.log('👁️ Message in active chat, skip notification');
            return;
          }

          // Get notification settings
          const settingsJson = localStorage.getItem('notification_settings');
          let enabled = false;
          let showPreview = true;

          if (settingsJson) {
            try {
              const settings = JSON.parse(settingsJson);
              enabled = settings.enabled && Notification.permission === 'granted';
              showPreview = settings.preview !== false;
            } catch (e) {
              console.error('Error parsing notification settings:', e);
            }
          }

          // Find contact name
          const contact = contacts.find(c => c.id === message.contact_id);
          const contactName = contact?.name || 'Unknown Contact';
          const messageContent = message.content || 'New message';

          console.log('📬 Notification for:', contactName);

          // Show browser notification
          if (enabled && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const notification = new Notification(contactName, {
                body: showPreview ? messageContent : 'You have a new message',
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
                tag: `message-${message.contact_id}`,
                requireInteraction: false,
                silent: false,
              });

              // Click to focus window
              notification.onclick = () => {
                window.focus();
                notification.close();
              };

              // Auto close after 5 seconds
              setTimeout(() => notification.close(), 5000);

              console.log('✅ Notification shown');
            } catch (error) {
              console.error('❌ Notification error:', error);
            }
          } else {
            console.log('🔕 Notifications disabled or not permitted');
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('🔕 Notification listener stopped');
      supabase.removeChannel(channel);
    };
  }, [user, activeChat?.id, contacts]);
}

// Usage in your App.tsx or main layout:
/*
import { useMessageNotifications } from '@/hooks/useMessageNotifications';

function App() {
  useMessageNotifications(); // Add this line
  
  return (
    // your app
  );
}
*/
