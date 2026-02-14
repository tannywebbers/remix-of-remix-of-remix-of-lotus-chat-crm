import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';

/**
 * Every 30 seconds, re-evaluate online status for all contacts
 * by forcing a re-render. Presence is computed from lastSeen
 * in the presence utility, so a tick-based forceUpdate is enough.
 */
export function usePresenceRefresh() {
  useEffect(() => {
    const interval = setInterval(() => {
      // Trigger a shallow update on contacts to force UI re-render
      const contacts = useAppStore.getState().contacts;
      if (contacts.length > 0) {
        useAppStore.setState({ contacts: [...contacts] });
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, []);
}
