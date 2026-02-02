/**
 * Firebase Client Configuration
 *
 * Initializes Firebase for the web application.
 * Handles messaging, auth, and other Firebase services.
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

// VAPID key for web push
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// ============================================================================
// Firebase App Initialization
// ============================================================================

let firebaseApp: FirebaseApp | null = null;
let messaging: Messaging | null = null;

/**
 * Initialize Firebase App
 */
export function initializeFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') {
    return null; // Don't initialize on server
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  // Check if Firebase is already initialized
  const apps = getApps();
  if (apps.length > 0) {
    firebaseApp = apps[0];
    return firebaseApp;
  }

  // Check if config is available
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase configuration not found. Push notifications will be disabled.');
    return null;
  }

  try {
    firebaseApp = initializeApp(firebaseConfig);
    console.log('Firebase initialized');
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

/**
 * Get Firebase Messaging instance
 */
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (messaging) {
    return messaging;
  }

  const app = initializeFirebaseApp();
  if (!app) {
    return null;
  }

  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return null;
  }

  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported');
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

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return null;
  }

  // Check current permission
  if (Notification.permission === 'denied') {
    console.warn('Notifications are blocked by user');
    return null;
  }

  // Request permission
  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    console.log('Notification permission not granted');
    return null;
  }

  // Get FCM token
  return getFCMToken();
}

/**
 * Get FCM token (assumes permission is already granted)
 */
export async function getFCMToken(): Promise<string | null> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return null;
  }

  if (!VAPID_KEY) {
    console.warn('Firebase VAPID key not configured');
    return null;
  }

  try {
    // Register service worker first
    const registration = await registerServiceWorker();
    if (!registration) {
      console.warn('Service worker not registered');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('FCM token obtained');
      return token;
    } else {
      console.warn('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Register service worker for FCM
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    console.log('Service worker registered');
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

// ============================================================================
// Message Handling
// ============================================================================

export interface ForegroundMessage {
  notification?: {
    title?: string;
    body?: string;
    image?: string;
  };
  data?: Record<string, string>;
}

/**
 * Set up foreground message handler
 */
export function onForegroundMessage(
  callback: (message: ForegroundMessage) => void
): (() => void) | null {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return null;
  }

  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload as ForegroundMessage);
  });
}

// ============================================================================
// Device Registration
// ============================================================================

/**
 * Register device token with backend
 */
export async function registerDeviceToken(token: string): Promise<boolean> {
  try {
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();
    const platform = 'web';

    const response = await fetch('/api/devices/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        token,
        platform,
        deviceId,
        deviceName,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to register device: ${response.status}`);
    }

    const data = await response.json();
    console.log('Device registered:', data);
    return true;
  } catch (error) {
    console.error('Failed to register device token:', error);
    return false;
  }
}

/**
 * Unregister device token from backend
 */
export async function unregisterDeviceToken(token?: string): Promise<boolean> {
  try {
    const deviceId = getDeviceId();

    const response = await fetch('/api/devices/unregister', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        token,
        deviceId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to unregister device: ${response.status}`);
    }

    console.log('Device unregistered');
    return true;
  } catch (error) {
    console.error('Failed to unregister device token:', error);
    return false;
  }
}

/**
 * Refresh FCM token
 */
export async function refreshFCMToken(oldToken: string, newToken: string): Promise<boolean> {
  try {
    const response = await fetch('/api/devices/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        oldToken,
        newToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    console.log('FCM token refreshed');
    return true;
  } catch (error) {
    console.error('Failed to refresh FCM token:', error);
    return false;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate or get device ID
 */
function getDeviceId(): string {
  const storageKey = 'skillancer_device_id';

  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    deviceId = `web_${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
}

/**
 * Get device name for display
 */
function getDeviceName(): string {
  const userAgent = navigator.userAgent;

  if (userAgent.includes('Chrome')) {
    return `Chrome on ${getOSName()}`;
  } else if (userAgent.includes('Firefox')) {
    return `Firefox on ${getOSName()}`;
  } else if (userAgent.includes('Safari')) {
    return `Safari on ${getOSName()}`;
  } else if (userAgent.includes('Edge')) {
    return `Edge on ${getOSName()}`;
  }

  return `Browser on ${getOSName()}`;
}

/**
 * Get OS name from user agent
 */
function getOSName(): string {
  const userAgent = navigator.userAgent;

  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad'))
    return 'iOS';

  return 'Unknown OS';
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

// ============================================================================
// Export
// ============================================================================

export { firebaseConfig, VAPID_KEY };
