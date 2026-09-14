// Service Worker for Raj Tube Pro - v26.0 (Multi-Channel Select Box & Batch Post Engine)
const CACHE_NAME = 'raj-tube-pro-v26';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => caches.delete(k)) // Purge all old caches completely!
      );
    })
  );
  self.clients.claim();
});

// Network First strategy for static assets, ZERO cache for data.json / API calls
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never cache or intercept data.json or API requests - ALWAYS live from network
  if (url.includes('data.json') || url.includes('/api/')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
