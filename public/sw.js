const APP_VERSION = '0.1.1'; // This should match package.json version
const CACHE_NAME = `filestores-v${APP_VERSION}`;
const STATIC_CACHE_URLS = [
  '/',
  '/dashboard',
  '/upload',
  '/register',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .catch((error) => {
        console.log('Service Worker: Cache failed', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const oldCaches = cacheNames.filter(cache => cache !== CACHE_NAME);
      
      if (oldCaches.length > 0) {
        console.log('Service Worker: Found old caches, notifying clients of update');
        
        // Notify all clients about the update
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'UPDATE_AVAILABLE',
              version: APP_VERSION,
              cacheName: CACHE_NAME
            });
          });
        });
      }
      
      return Promise.all(
        oldCaches.map((cache) => {
          console.log('Service Worker: Deleting old cache', cache);
          return caches.delete(cache);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API calls from being cached (except for specific ones)
  if (event.request.url.includes('/api/')) {
    // Only cache specific API responses that are safe to cache
    if (event.request.url.includes('/api/auth/session')) {
      event.respondWith(
        caches.match(event.request)
          .then((response) => {
            if (response) {
              // Serve from cache but also fetch fresh data in background
              fetch(event.request).then((fetchResponse) => {
                if (fetchResponse.ok) {
                  const responseClone = fetchResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                  });
                }
              });
              return response;
            }
            return fetch(event.request);
          })
      );
    } else {
      // For other API calls, just fetch normally
      return;
    }
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
          .then((fetchResponse) => {
            // Don't cache if not a valid response
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }

            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return fetchResponse;
          });
      })
      .catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/dashboard');
        }
        
        // Return a generic offline response for images
        if (event.request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f3f4f6"/><text x="100" y="100" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="#9ca3af">Offline</text></svg>',
            { 
              headers: { 'Content-Type': 'image/svg+xml' }
            }
          );
        }
      })
  );
});

// Background sync for failed uploads (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync');
    event.waitUntil(
      // Implement background sync logic here if needed
      Promise.resolve()
    );
  }
});

// Push notifications (optional)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from FileStores',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open App'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'FileStores', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_VERSION') {
    console.log('Service Worker: Version check requested');
    event.ports[0].postMessage({ 
      success: true, 
      version: APP_VERSION,
      cacheName: CACHE_NAME
    });
    return;
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('Service Worker: Clearing all caches');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('Service Worker: Deleting cache', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        // Notify the client that cache is cleared
        event.ports[0].postMessage({ success: true });
        console.log('Service Worker: All caches cleared successfully');
      }).catch((error) => {
        console.error('Service Worker: Error clearing caches', error);
        event.ports[0].postMessage({ success: false, error: error.message });
      })
    );
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Skipping waiting');
    self.skipWaiting();
  }
});
