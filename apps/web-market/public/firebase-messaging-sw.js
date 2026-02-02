/**
 * Firebase Messaging Service Worker
 *
 * Handles background push notifications when the app is not in focus.
 * This file must be in the public directory to be served at the root.
 */

/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Note: These values should match your Firebase config
firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: self.FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT.firebaseapp.com',
  projectId: self.FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: self.FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT.appspot.com',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: self.FIREBASE_APP_ID || 'YOUR_APP_ID',
});

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Skillancer';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/icons/notification-icon.png',
    badge: '/icons/badge-icon.png',
    image: payload.notification?.image,
    tag: payload.data?.tag || 'skillancer-notification',
    data: payload.data || {},
    requireInteraction: payload.data?.requireInteraction === 'true',
    actions: getNotificationActions(payload.data?.type),
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Handle action buttons
  if (event.action) {
    switch (event.action) {
      case 'view':
        url = data.clickAction || data.url || '/notifications';
        break;
      case 'reply':
        url = data.conversationUrl || '/messages';
        break;
      case 'dismiss':
        // Just close the notification
        return;
      default:
        url = data.clickAction || data.url || '/';
    }
  } else {
    // Default click behavior
    url = data.clickAction || data.url || '/notifications';
  }

  // Open the URL in an existing window or new tab
  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Check if a window is already open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: data,
              url: url,
            });
            return client.focus();
          }
        }

        // Open new window if no existing window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);

  // Track notification dismissal (optional analytics)
  const data = event.notification.data || {};
  if (data.notificationId) {
    // You could send this to analytics
    console.log('[SW] Notification dismissed:', data.notificationId);
  }
});

// Get notification actions based on type
function getNotificationActions(type) {
  const baseActions = [
    {
      action: 'view',
      title: 'View',
      icon: '/icons/view-icon.png',
    },
  ];

  switch (type) {
    case 'MESSAGE':
      return [
        {
          action: 'reply',
          title: 'Reply',
          icon: '/icons/reply-icon.png',
        },
        ...baseActions,
      ];
    case 'PROPOSAL':
    case 'CONTRACT':
    case 'PAYMENT':
      return baseActions;
    default:
      return [
        {
          action: 'view',
          title: 'View',
          icon: '/icons/view-icon.png',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss-icon.png',
        },
      ];
  }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SET_FIREBASE_CONFIG') {
    // Update Firebase config if needed
    self.FIREBASE_API_KEY = event.data.config.apiKey;
    self.FIREBASE_AUTH_DOMAIN = event.data.config.authDomain;
    self.FIREBASE_PROJECT_ID = event.data.config.projectId;
    self.FIREBASE_STORAGE_BUCKET = event.data.config.storageBucket;
    self.FIREBASE_MESSAGING_SENDER_ID = event.data.config.messagingSenderId;
    self.FIREBASE_APP_ID = event.data.config.appId;
  }
});

// Service worker installation
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

// Service worker activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(clients.claim());
});
