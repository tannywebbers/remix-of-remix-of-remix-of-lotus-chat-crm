import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/appStore';

const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAACAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CAgICAgICAgICAgH+AgIB/gICAf4CAgH+AgIB/gICAgICAgICAgICAgICAgICAgP9/gID/f4CA/3+AgP9/gIB/gICAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CA/3+AgICAgICAgICAgICAgICAgICAgICAgICA/3+AgP9/gIB/gICAf4CAgH+AgIB/gICAgICAgICAgICAgICAgICA';

let baseAudio: HTMLAudioElement | null = null;

function playNotificationSound() {
  try {
    const settingsJson = localStorage.getItem('notification_settings');
    const settings = settingsJson ? JSON.parse(settingsJson) : { sound: true };
    if (settings.sound === false) return;

    if (!baseAudio) {
      baseAudio = new Audio(NOTIFICATION_SOUND_URL);
      baseAudio.preload = 'auto';
      baseAudio.volume = 0.65;
    }

    const sound = baseAudio.cloneNode(true) as HTMLAudioElement;
    sound.volume = baseAudio.volume;
    sound.play().catch(() => {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 840;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    });
  } catch {
    // no-op
  }
}

export function useMessageNotifications() {
  const { user } = useAuth();
  const activeChatRef = useRef<string | null>(null);

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
        event: 'INSERT', schema: 'public', table: 'messages', filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const message = payload.new as any;
        if (message.is_outgoing || activeChatRef.current === message.contact_id) return;

        playNotificationSound();

        const settingsJson = localStorage.getItem('notification_settings');
        let enabled = false;
        let showPreview = true;
        if (settingsJson) {
          try {
            const s = JSON.parse(settingsJson);
            enabled = s.enabled && Notification.permission === 'granted';
            showPreview = s.preview !== false;
          } catch {
            enabled = false;
          }
        }

        if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;

        const contacts = useAppStore.getState().contacts;
        const contact = contacts.find((c) => c.id === message.contact_id);
        const contactName = contact?.name || 'Unknown Contact';

        try {
          const n = new Notification(contactName, {
            body: showPreview ? (message.content || 'New message') : 'You have a new message',
            icon: '/pwa-192x192.png',
            tag: `message-${message.contact_id}`,
            silent: true,
          });
          n.onclick = () => { window.focus(); n.close(); };
          setTimeout(() => n.close(), 5000);
        } catch {
          // ignore
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);
}
