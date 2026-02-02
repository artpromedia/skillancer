/**
 * Firebase Client Configuration for Admin
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

// ============================================================================
// Configuration
// ============================================================================

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// ============================================================================
// Firebase App Initialization
// ============================================================================

let firebaseApp: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function initializeFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (firebaseApp) return firebaseApp;

  const apps = getApps();
  if (apps.length > 0) {
    firebaseApp = apps[0];
    return firebaseApp;
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase configuration not found.');
    return null;
  }

  try {
    firebaseApp = initializeApp(firebaseConfig);
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (messaging) return messaging;

  const app = initializeFirebaseApp();
  if (!app) return null;

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    messaging = getMessaging(app);
    return messaging;
  } catch (error) {
    console.error('Failed to get Firebase Messaging:', error);
    return null;
  }
}

// ============================================================================
// FCM Token Management
// ============================================================================

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function getFCMToken(): Promise<string | null> {
  const messaging = getFirebaseMessaging();
  if (!messaging || !VAPID_KEY) return null;

  try {
    const registration = await registerServiceWorker();
    if (!registration) return null;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

// ============================================================================
// Message Handling
// ============================================================================

export interface ForegroundMessage {
  notification?: { title?: string; body?: string; image?: string };
  data?: Record<string, string>;
}

export function onForegroundMessage(
  callback: (message: ForegroundMessage) => void
): (() => void) | null {
  const messaging = getFirebaseMessaging();
  if (!messaging) return null;
  return onMessage(messaging, (payload) => callback(payload as ForegroundMessage));
}

// ============================================================================
// Device Registration
// ============================================================================

export async function registerDeviceToken(token?: string): Promise<boolean> {
  try {
    const fcmToken = token || (await getFCMToken());
    if (!fcmToken) return false;

    const response = await fetch('/api/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        token: fcmToken,
        platform: 'web',
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to register device token:', error);
    return false;
  }
}

export async function unregisterDeviceToken(token?: string): Promise<boolean> {
  try {
    const response = await fetch('/api/devices/unregister', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, deviceId: getDeviceId() }),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to unregister device token:', error);
    return false;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getDeviceId(): string {
  const storageKey = 'skillancer_device_id';
  let deviceId = localStorage.getItem(storageKey);
  if (!deviceId) {
    deviceId = `web_${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, deviceId);
  }
  return deviceId;
}

function getDeviceName(): string {
  const userAgent = navigator.userAgent;
  let browser = 'Browser';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  return `${browser} on ${getOSName()}`;
}

function getOSName(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone')) return 'iOS';
  return 'Unknown';
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getNotificationPermission(): 'default' | 'granted' | 'denied' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

export { firebaseConfig, VAPID_KEY };
