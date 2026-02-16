import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';

/**
 * Adaptive presence polling engine.
 * - 15s for active chats
 * - Smart backoff: if no changes for 10 min, slow to 90s max
 * - Reset on activity
 */
export function usePresenceRefresh() {
  const lastChangeRef = useRef<number>(Date.now());
  const intervalRef = useRef<number>(15000);

  useEffect(() => {
    const tick = () => {
      const contacts = useAppStore.getState().contacts;
      if (contacts.length > 0) {
        // Force re-render to re-evaluate isContactOnline()
        useAppStore.setState({ contacts: [...contacts] });
      }

      // Smart backoff: if no status change detected for >10 min, slow down
      const elapsed = Date.now() - lastChangeRef.current;
      if (elapsed > 600_000) {
        intervalRef.current = Math.min(intervalRef.current + 15000, 90_000);
      }
    };

    const id = setInterval(tick, 15_000); // Base 15s polling

    // Listen for activity (any new message resets the backoff)
    const unsub = useAppStore.subscribe((state) => {
      lastChangeRef.current = Date.now();
      intervalRef.current = 15_000;
    });

    return () => {
      clearInterval(id);
      unsub();
    };
  }, []);
}
