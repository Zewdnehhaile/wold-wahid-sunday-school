// Service Worker for Wold Wahid Sunday School PWA - Cache-busting & push notification worker

self.addEventListener('install', (event) => {
  // Clear any existing caches immediately
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge all legacy caches and take control immediately
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network only: Always fetch live content, never serve stale cached index.html or assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => {
      // Offline fallback only when network completely unreachable
      return new Response('Offline - please check your internet connection.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    })
  );
});

// Push notification listener
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : 'አዲስ መልእክት ከሰንበት ት/ቤቱ ደርሶዎታል' };
  }

  const title = data.title || 'ወልደ ዋሕድ ሰንበት ት/ቤት';
  const options = {
    body: data.body || 'አዲስ ማስታወቂያ አለ። ለመመልከት ይጫኑ።',
    icon: '/assets/aistudio/image_2e12d320.png',
    badge: '/assets/aistudio/image_2e12d320.png',
    data: data.url || '/',
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
