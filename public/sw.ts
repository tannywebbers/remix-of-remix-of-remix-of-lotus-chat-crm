/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;
declare const __APP_VERSION__: string;

const APP_VERSION = (self as any).__APP_VERSION__ || '1';
const CACHE_PREFIX = `lotus-${APP_VERSION}`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}-pages`,
  })
);

registerRoute(
  ({ url }) => url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.svg'),
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-images`,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.endsWith('.woff2') || url.pathname.endsWith('.woff'),
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-fonts`,
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({
    cacheName: `${CACHE_PREFIX}-api`,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 5 }),
    ],
  })
);

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith('lotus-') && !key.startsWith(CACHE_PREFIX))
      .map((key) => caches.delete(key)))),
  );
});

self.addEventListener('push', (event: PushEvent) => {
  let data: any = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: 'New Message', body: event.data?.text() || 'You have a new message' };
  }

  const title = data.title || 'Lotus CRM';
  const options: NotificationOptions = {
    body: data.body || 'You have a new message',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || `lotus-notification-${APP_VERSION}`,
    data: { ...(data.data || {}), version: APP_VERSION },
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
      return undefined;
    })
  );
});

self.addEventListener('sync', (event: any) => {
  if (event.tag === 'send-messages') {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'PLAY_SOUND' }));
    });
  }

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
