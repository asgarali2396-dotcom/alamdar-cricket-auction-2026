const CACHE_NAME = 'alamdar-auction-v13';
const ASSETS = [
  './',
  './index.html',
  './favicon.ico',
  './css/style.css',
  './js/data.js',
  './js/storage.js',
  './js/auction-engine.js',
  './js/sound.js',
  './js/app.js',
  './manifest.json',
  './icons/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
  './icons/favicon-48.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => console.log('Cache addAll warning:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first fetch strategy for assets; BYPASS SERVICE WORKER ENTIRELY FOR ALL API REQUESTS
self.addEventListener('fetch', (event) => {
  // CRITICAL: Live sync and API calls MUST bypass service worker cache completely
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return; // Fall through to standard browser network request
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
