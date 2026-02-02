/**
 * Firebase Cloud Messaging Service Worker for Admin
 */

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY,
  authDomain: self.FIREBASE_AUTH_DOMAIN,
  projectId: self.FIREBASE_PROJECT_ID,
  storageBucket: self.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID,
  appId: self.FIREBASE_APP_ID,
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message:', payload);

  const notificationTitle = payload.notification?.title || 'Skillancer Admin';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: payload.data?.tag || 'notification',
    data: payload.data,
    requireInteraction: payload.data?.requireInteraction === 'true',
    actions: getNotificationActions(payload.data?.type),
  };

  if (payload.notification?.image) {
    notificationOptions.image = payload.notification.image;
  }

  self.registration.showNotification(notificationTitle, notificationOptions);
});

function getNotificationActions(type) {
  switch (type) {
    case 'dispute':
      return [
        { action: 'review', title: 'Review' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'moderation':
      return [
        { action: 'moderate', title: 'Moderate' },
        { action: 'view', title: 'View' },
      ];
    case 'support':
      return [
        { action: 'respond', title: 'Respond' },
        { action: 'view', title: 'View' },
      ];
    default:
      return [{ action: 'view', title: 'View' }];
  }
}

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event.action);
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  if (event.action === 'view' && data.link) {
    url = data.link;
  } else if (data.link) {
    url = data.link;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data, action: event.action });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
