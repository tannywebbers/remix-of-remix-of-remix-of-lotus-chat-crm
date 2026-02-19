import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/appStore';

// Notification sound — short beep encoded as data URI (no external file needed)
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAACAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CAgICAgICAgICAgH+AgIB/gICAf4CAgH+AgIB/gICAgICAgICAgICAgICAgICAgP9/gID/f4CA/3+AgP9/gIB/gICAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CA/3+AgICAgICAgICAgICAgICAgICAgICAgICA/3+AgP9/gIB/gICAf4CAgH+AgIB/gICAgICAgICAgICAgICAgICA';

let notificationAudio: HTMLAudioElement | null = null;

function playNotificationSound() {
  try {
    const settingsJson = localStorage.getItem('notification_settings');
    const settings = settingsJson ? JSON.parse(settingsJson) : { sound: true };
    if (settings.sound === false) return;

    const adminTone = localStorage.getItem('admin_notification_sound') || 'default';

    if (!notificationAudio) {
      notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
      notificationAudio.preload = 'auto';
      notificationAudio.volume = adminTone === 'iphone' ? 0.65 : adminTone === 'whatsapp' ? 0.55 : 0.5;
    }

    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {
      // WebAudio fallback for autoplay-restricted contexts
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = adminTone === 'iphone' ? 'triangle' : 'sine';
      o.frequency.value = adminTone === 'whatsapp' ? 880 : 740;
      g.gain.value = 0.03;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.08);
    });
  } catch {}
}

export function useMessageNotifications() {
  const { user } = useAuth();
  const activeChatRef = useRef<string | null>(null);

  // Keep ref in sync to avoid re-subscribing on chat change
  useEffect(() => {
    activeChatRef.current = useAppStore.getState().activeChat?.id || null;
    const unsub = useAppStore.subscribe((state) => {
      activeChatRef.current = state.activeChat?.id || null;
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notification-messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const message = payload.new as any;
        if (message.is_outgoing) return;
        if (activeChatRef.current === message.contact_id) return;

        // Play sound
        playNotificationSound();

        // Browser notification
        const settingsJson = localStorage.getItem('notification_settings');
        let enabled = false;
        let showPreview = true;
        if (settingsJson) {
          try {
            const s = JSON.parse(settingsJson);
            enabled = s.enabled && Notification.permission === 'granted';
            showPreview = s.preview !== false;
          } catch {}
        }

        if (enabled && 'Notification' in window && Notification.permission === 'granted') {
          const contacts = useAppStore.getState().contacts;
          const contact = contacts.find(c => c.id === message.contact_id);
          const contactName = contact?.name || 'Unknown Contact';
          try {
            const n = new Notification(contactName, {
              body: showPreview ? (message.content || 'New message') : 'You have a new message',
              icon: '/pwa-192x192.png',
              tag: `message-${message.contact_id}`,
              silent: true, // We play our own sound
            });
            n.onclick = () => { window.focus(); n.close(); };
            setTimeout(() => n.close(), 5000);
          } catch {}
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);
}
