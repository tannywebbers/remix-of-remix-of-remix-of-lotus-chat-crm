import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 🔧 SERVICE WORKER REGISTRATION
// Enables offline support and push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                console.log('🔄 New version available. Reload to update.');
                
                // Optional: Show update prompt to user
                if (confirm('New version available! Reload to update?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch(error => {
        console.error('❌ Service Worker registration failed:', error);
      });

    // Handle controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 Service Worker updated');
    });
  });
}

// 🎵 NOTIFICATION SOUND HANDLER
// Listen for sound play messages from service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_SOUND') {
      // Play notification sound
      const audio = new Audio('data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAACAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CAgICAgICAgICAgH+AgIB/gICAf4CAgH+AgIB/gICAgICAgICAgICAgICAgICAgP9/gID/f4CA/3+AgP9/gIB/gICAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CA/3+AgICAgICAgICAgICAgICAgICAgICAgICA/3+AgP9/gIB/gICAf4CAgH+AgIB/gICAgICAgICAgICAgICAgICA');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }
  });
}

// 📱 PWA INSTALL PROMPT
let deferredPrompt: any;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent default mini-infobar
  e.preventDefault();
  // Store event for later use
  deferredPrompt = e;
  console.log('💾 PWA install prompt available');

  // Optionally show custom install button
  // You can create a custom UI to trigger: deferredPrompt.prompt()
});

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installed');
  deferredPrompt = null;
});

// 🚀 RENDER APP
createRoot(document.getElementById("root")!).render(<App />);

// 📊 PERFORMANCE MONITORING (optional)
if (import.meta.env.DEV) {
  // Log performance metrics in development
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (perfData) {
        console.log('⚡ Performance Metrics:');
        console.log('  DOM Load:', Math.round(perfData.domContentLoadedEventEnd - perfData.fetchStart), 'ms');
        console.log('  Full Load:', Math.round(perfData.loadEventEnd - perfData.fetchStart), 'ms');
        console.log('  First Paint:', Math.round(perfData.responseEnd - perfData.fetchStart), 'ms');
      }
    }, 0);
  });
}
