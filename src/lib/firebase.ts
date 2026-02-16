/**
 * Firebase Cloud Messaging initialization
 * Handles push token generation, refresh, and storage
 */

import { supabase } from '@/integrations/supabase/client';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBbM4_1d7wcKy7fRDTWJAmNLSFHSYw3Df8",
  authDomain: "waba4all.firebaseapp.com",
  projectId: "waba4all",
  storageBucket: "waba4all.firebasestorage.app",
  messagingSenderId: "155860257722",
  appId: "1:155860257722:web",
};

const VAPID_KEY = "BN76YKCyiWRL9qGFqWnwq4muGnpVsiDEW5Zat8Uyca0ljGYavlL0FUyRti9JZX-sKl6RLSWgzAlWrZsB-Cwy2iw";

let messagingInstance: any = null;

async function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;
  
  try {
    const { initializeApp } = await import('firebase/app');
    const { getMessaging, isSupported } = await import('firebase/messaging');
    
    const supported = await isSupported();
    if (!supported) {
      console.log('Firebase Messaging not supported in this browser');
      return null;
    }
    
    const app = initializeApp(FIREBASE_CONFIG);
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.error('Failed to initialize Firebase:', err);
    return null;
  }
}

export async function requestPushPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Push permission denied');
      return null;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const { getToken } = await import('firebase/messaging');
    
    // Register service worker for FCM
    const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    console.log('✅ FCM token obtained:', token?.substring(0, 20) + '...');
    return token;
  } catch (err) {
    console.error('Failed to get push token:', err);
    return null;
  }
}

export async function storePushToken(userId: string, token: string) {
  try {
    const deviceInfo = `${navigator.userAgent.substring(0, 100)}`;
    
    const { error } = await supabase
      .from('push_tokens' as any)
      .upsert(
        { user_id: userId, token, device_info: deviceInfo } as any,
        { onConflict: 'user_id,token' }
      );
    
    if (error) {
      console.error('Error storing push token:', error);
    } else {
      console.log('✅ Push token stored');
    }
  } catch (err) {
    console.error('Failed to store push token:', err);
  }
}

export async function setupForegroundMessages(onMessage: (payload: any) => void) {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;

    const { onMessage: onFCMMessage } = await import('firebase/messaging');
    onFCMMessage(messaging, (payload) => {
      console.log('📨 Foreground message:', payload);
      onMessage(payload);
    });
  } catch (err) {
    console.error('Failed to setup foreground messages:', err);
  }
}

export async function initializePushNotifications(userId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push not supported');
      return { success: false, error: 'Push not supported' };
    }

    const token = await requestPushPermission();
    if (!token) return { success: false, error: 'Permission denied or token failed' };

    await storePushToken(userId, token);

    return { success: true, token };
  } catch (err: any) {
    console.error('Push init failed:', err);
    return { success: false, error: err.message };
  }
}
