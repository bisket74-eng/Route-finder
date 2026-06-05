const CACHE_NAME = 'route-finder-v1';
// Files required to make the core app open offline
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

// Install the application assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Clean up old caches
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

// Handle data requests intelligently (The Bulletproof Rule)
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // If the app is asking for an Excel file, force it to bypass the local cache
  if (requestUrl.pathname.endsWith('.xlsx')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Keep a backup copy in the cache just in case they lose cell service entirely
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // If they are completely offline, pull the last saved backup copy
          return caches.match(event.request);
        })
    );
  } else {
    // For standard web files (HTML/CSS), look in the cache first for instant loading
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});
