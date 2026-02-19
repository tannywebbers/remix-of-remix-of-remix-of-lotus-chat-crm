import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';

export function useTabBadge() {
  useEffect(() => {
    const apply = () => {
      const unread = useAppStore.getState().totalUnread();
      document.title = unread > 0 ? `(${unread}) waba` : 'waba';

      const nav: any = navigator;
      if (typeof nav.setAppBadge === 'function') {
        if (unread > 0) nav.setAppBadge(unread).catch(() => {});
        else if (typeof nav.clearAppBadge === 'function') nav.clearAppBadge().catch(() => {});
      }
    };

    apply();
    const unsub = useAppStore.subscribe(() => apply());
    return () => { unsub(); };
  }, []);
}
