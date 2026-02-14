/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// Claim clients immediately
clientsClaim();

// Clean up old caches
cleanupOutdatedCaches();

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache strategies
registerRoute(
  ({ url }) => url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.svg'),
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.endsWith('.woff2') || url.pathname.endsWith('.woff'),
  new CacheFirst({
    cacheName: 'fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// API calls - Network first with cache fallback
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 5, // 5 minutes
      }),
    ],
  })
);

// 🔔 PUSH NOTIFICATION HANDLER
self.addEventListener('push', (event: PushEvent) => {
  console.log('📨 Push received:', event);

  let data: any = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = { title: 'New Message', body: event.data?.text() || 'You have a new message' };
  }

  const title = data.title || 'Lotus CRM';
  const options: NotificationOptions = {
    body: data.body || 'You have a new message',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'lotus-notification',
    data: data.data || {},
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 🔔 NOTIFICATION CLICK HANDLER
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('🖱️ Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if none found
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// 📲 BACKGROUND SYNC for offline message sending
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'send-messages') {
    event.waitUntil(sendQueuedMessages());
  }
});

async function sendQueuedMessages() {
  // Implementation for sending queued messages when back online
  console.log('🔄 Syncing queued messages...');
}

// 🎵 NOTIFICATION SOUND HANDLER
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
    // Service worker can't play audio directly, but we can message clients
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'PLAY_SOUND' });
      });
    });
  }
});

// Skip waiting and activate immediately
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✅ Service Worker loaded with Push API support');
