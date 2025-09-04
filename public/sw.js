const APP_VERSION = '1.0.0'; // Production version
const CACHE_NAME = `filestores-v${APP_VERSION}`;
const STATIC_CACHE_URLS = [
  '/',
  '/register',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png'
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Install event - cache static assets with better error handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Use Promise.allSettled to handle individual failures gracefully
        return Promise.allSettled(
          STATIC_CACHE_URLS.map(url => 
            cache.add(new Request(url, { cache: 'reload' }))
              .catch(error => console.warn(`Failed to cache ${url}:`, error))
          )
        );
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
  // Force immediate activation
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const oldCaches = cacheNames.filter(cache => cache !== CACHE_NAME);
      
      if (oldCaches.length > 0) {
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
    // Skip caching for authentication-related API calls
    if (event.request.url.includes('/api/auth/')) {
      return; // Always fetch fresh for auth
    }
    
    // Only cache specific API responses that are safe to cache
    if (event.request.url.includes('/api/files/stats')) {
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
        return response || fetch(event.request, { redirect: 'follow' })
          .then((fetchResponse) => {
            // Don't cache redirected responses or non-successful responses
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic' || fetchResponse.redirected) {
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
          // For HTML pages, try root first, then dashboard
          return caches.match('/').then(response => {
            if (response) return response;
            return caches.match('/dashboard');
          }).then(response => {
            if (response) return response;
            // Create a simple offline page if nothing cached
            return new Response(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>FileStores - Offline</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body { font-family: sans-serif; text-align: center; padding: 50px; background: #f9fafb; }
                    .container { max-width: 400px; margin: 0 auto; }
                    .icon { font-size: 64px; margin-bottom: 20px; }
                    button { background: #4f46e5; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="icon">📱</div>
                    <h1>You're Offline</h1>
                    <p>Please check your internet connection and try again.</p>
                    <button onclick="window.location.reload()">Retry</button>
                  </div>
                </body>
              </html>
            `, {
              headers: { 'Content-Type': 'text/html' }
            });
          });
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
    event.ports[0].postMessage({ 
      success: true, 
      version: APP_VERSION,
      cacheName: CACHE_NAME
    });
    return;
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        // Notify the client that cache is cleared
        event.ports[0].postMessage({ success: true });
      }).catch((error) => {
        console.error('Service Worker: Error clearing caches', error);
        event.ports[0].postMessage({ success: false, error: error.message });
      })
    );
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
