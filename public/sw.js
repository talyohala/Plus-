const CACHE_NAME = 'shechen-plus-v3';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('fetch', (e) => {
  // חייב לכלול אירוע fetch כדי שהדפדפן יאשר התקנה
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
