const CACHE_NAME = 'route-finder-v2-2026-08-04';
const CACHE_PREFIX = 'route-finder-';

// Change CACHE_NAME every time you want installed copies to refresh.
const CORE_ASSETS = [
  './',
  './index.html'
];

async function cacheSuccessfulResponse(request, response) {
  if (!response || !(response.ok || response.type === 'opaque')) {
    return;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('Route Finder could not cache a response.', error);
  }
}

async function networkFirst(request, fallbackUrl = '') {
  try {
    // Always ask GitHub/the network for the newest copy first.
    const response = await fetch(request, { cache: 'no-store' });
    await cacheSuccessfulResponse(request, response);
    return response;
  } catch (error) {
    // If the phone is offline, use the most recently saved copy.
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (fallbackUrl) {
      const fallbackResponse = await caches.match(fallbackUrl);

      if (fallbackResponse) {
        return fallbackResponse;
      }
    }

    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // "reload" prevents the install step from re-saving an old HTTP-cached page.
      await cache.addAll(
        CORE_ASSETS.map(
          (url) => new Request(url, { cache: 'reload' })
        )
      );

      // Activate this version without waiting for every old app window to close.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      // Only remove old Route Finder caches. Do not erase caches belonging
      // to Barcode Buddy, Rate It Up, or other apps on the same GitHub domain.
      const oldRouteFinderCaches = cacheNames.filter(
        (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
      );

      await Promise.all(
        oldRouteFinderCaches.map((name) => caches.delete(name))
      );

      await self.clients.claim();

      // Existing installed users may initially open the old cached page.
      // Once this new worker activates, reload Route Finder one time so the
      // newly published GitHub version appears without user instructions.
      if (oldRouteFinderCaches.length > 0) {
        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });

        await Promise.all(
          windowClients.map(async (client) => {
            try {
              const clientUrl = new URL(client.url);

              if (clientUrl.origin === self.location.origin) {
                await client.navigate(client.url);
              }
            } catch (error) {
              console.warn('Route Finder could not refresh an open window.', error);
            }
          })
        );
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (!['http:', 'https:'].includes(requestUrl.protocol)) {
    return;
  }

  // Pages, scripts, styles, images, and Excel files all check the network
  // first. The saved copy is used only when the phone cannot reach the network.
  event.respondWith(
    networkFirst(
      request,
      request.mode === 'navigate' ? './index.html' : ''
    )
  );
});
