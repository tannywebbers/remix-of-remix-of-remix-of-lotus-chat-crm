import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyAdminAppearance } from '@/lib/adminAppearance';

const SW_VERSION = import.meta.env.VITE_APP_VERSION || '1';
const SW_CACHE_PREFIX = `lotus-${SW_VERSION}`;

applyAdminAppearance();
window.addEventListener('storage', (event) => {
  if (event.key?.startsWith('admin_')) applyAdminAppearance();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered:', registration.scope);

      const applyWaitingUpdate = () => {
        const waiting = registration.waiting;
        if (!waiting) return;
        waiting.postMessage({ type: 'SKIP_WAITING' });
      };


      const promptKey = `lotus_sw_prompted_${SW_VERSION}`;

      const maybePromptUpdate = () => {
        const waiting = registration.waiting;
        if (!waiting || localStorage.getItem(promptKey) === '1') return;

        const confirmed = window.confirm('New version available. Update now?');
        if (confirmed) {
          waiting.postMessage({ type: 'SKIP_WAITING' });
          localStorage.setItem(promptKey, '1');
        }
      };

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            applyWaitingUpdate();
          }
        });
      });

      if (registration.waiting) applyWaitingUpdate();
            maybePromptUpdate();
          }
        });
      });

      if (registration.waiting) maybePromptUpdate();

      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        localStorage.removeItem(promptKey);
        window.location.reload();
      });

      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => key.startsWith('lotus-') && !key.startsWith(SW_CACHE_PREFIX))
          .map((key) => caches.delete(key)),
      );
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_SOUND') {
      const audio = new Audio('data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAACAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CAgICAgICAgICAgH+AgIB/gICAf4CAgH+AgIB/gICAgICAgICAgICAgICAgICAgP9/gID/f4CA/3+AgP9/gIB/gICAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CA/3+AgICAgICAgICAgICAgICAgICAgICAgICA/3+AgP9/gIB/gICAf4CAgH+AgIB/gICAgICAgICAgICAgICAgICA');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }
  });
}

let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

createRoot(document.getElementById("root")!).render(<App />);
