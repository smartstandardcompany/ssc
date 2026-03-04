/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'ssc-track-v3';
const OFFLINE_CACHE = 'ssc-track-offline-v3';
const API_CACHE = 'ssc-track-api-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

// API endpoints to cache for offline use
const CACHEABLE_API = [
  '/api/branches',
  '/api/stock-items',
  '/api/menu-items',
  '/api/customers',
  '/api/suppliers',
  '/api/employees',
];

// Install: cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.addAll(STATIC_ASSETS).catch(() => {});
      }),
      caches.open(OFFLINE_CACHE)
    ])
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  const currentCaches = [CACHE_NAME, OFFLINE_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(n => !currentCaches.includes(n)).map(n => caches.delete(n))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Handle API calls with network-first, fallback to cache
  if (url.pathname.startsWith('/api')) {
    // Check if this is a cacheable API endpoint
    const isCacheable = CACHEABLE_API.some(endpoint => url.pathname.includes(endpoint));
    
    if (isCacheable) {
      event.respondWith(
        fetch(event.request)
          .then(function(response) {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(API_CACHE).then(function(cache) {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
          .catch(function() {
            return caches.match(event.request);
          })
      );
      return;
    }
    // Non-cacheable API - just go to network
    return;
  }

  // For navigation requests (HTML pages), always serve index.html (SPA routing)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Cache the response for offline use
          const clone = response.clone();
          caches.open(OFFLINE_CACHE).then(function(cache) {
            cache.put('/', clone);
          });
          return response;
        })
        .catch(function() {
          // Offline: serve cached index.html for any navigation request
          return caches.match('/').then(function(cached) {
            if (cached) return cached;
            return caches.match('/index.html').then(function(indexCached) {
              if (indexCached) return indexCached;
              return caches.match('/offline.html');
            });
          });
        })
    );
    return;
  }

  // For static assets (JS, CSS, images), use stale-while-revalidate
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        const fetchPromise = fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(function() {
          return cached;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }
});

// Background sync for offline actions
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  // Get pending offline actions from IndexedDB
  // This would sync sales, expenses, etc. that were recorded offline
  console.log('Background sync: syncing offline data');
}

// Push notifications
self.addEventListener('push', function(event) {
  let data = { title: 'SSC Track', body: 'New notification' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: data.priority === 'high',
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Periodic background sync (for newer browsers)
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'update-dashboard-data') {
    event.waitUntil(updateDashboardCache());
  }
});

async function updateDashboardCache() {
  // Pre-fetch dashboard data in background
  const endpoints = ['/api/dashboard/stats', '/api/branches'];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const cache = await caches.open(API_CACHE);
        await cache.put(endpoint, response);
      }
    } catch (e) {
      console.log('Background fetch failed:', endpoint);
    }
  }
}
