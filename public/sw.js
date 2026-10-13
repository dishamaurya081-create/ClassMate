// ClassMate Service Worker — Phase 3C Web Push Foundation
// Served from: /sw.js (Vite copies public/ files as-is to dist root)
// This file must NOT contain any secrets, VAPID private keys, or hard-coded timetable data.

const CLASSMATE_APP_URL = self.location.origin;

// ---------------------------------------------------------------------------
// Install — activate immediately so the SW takes over without waiting
// ---------------------------------------------------------------------------
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — claim existing clients immediately
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ---------------------------------------------------------------------------
// Fetch — pass-through listener to satisfy PWA installability requirements
// ---------------------------------------------------------------------------
self.addEventListener('fetch', () => {
  // Pass-through: allows browser default handling without network interception
});

// ---------------------------------------------------------------------------
// Push — receive a push message from the server
//
// Expected payload JSON shape (all fields optional with sensible fallbacks):
// {
//   "title": "ClassMate — Upcoming Class",
//   "body": "OOPS starts in 10 minutes. Mr. Dhaneshwar Kumar • Room 204",
//   "url": "/"
// }
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'ClassMate';
  const options = {
    body: data.body || 'You have a new reminder from ClassMate.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'classmate-push',
    data: {
      url: data.url || '/',
    },
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ---------------------------------------------------------------------------
// Notification Click — open or focus the ClassMate app window
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? new URL(event.notification.data.url, CLASSMATE_APP_URL).href
    : CLASSMATE_APP_URL;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

