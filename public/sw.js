const APP_VERSION = '1.0.1'; // Updated for mobile image fix
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
  // Don't force immediate activation - wait for user interaction
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const oldCaches = cacheNames.filter(cache => cache !== CACHE_NAME);
      
      if (oldCaches.length > 0) {
        // Quietly notify clients about update without forcing reload
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'UPDATE_AVAILABLE',
              version: APP_VERSION,
              silent: true // Don't force immediate action
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
  // Only claim new clients, don't force existing ones to reload
  return self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle image requests from R2/Cloudflare specifically
  if (event.request.url.includes('r2.dev') || event.request.url.includes('r2.cloudflarestorage.com')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            // Return cached image immediately for better mobile performance
            return response;
          }
          
          // Fetch from network and cache for future use
          return fetch(event.request, { redirect: 'follow' })
            .then((fetchResponse) => {
              if (fetchResponse && fetchResponse.status === 200) {
                const responseToCache = fetchResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return fetchResponse;
            })
            .catch(() => {
              // Return a placeholder for images if offline
              return new Response(
                '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af">Offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            });
        })
    );
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

  // Use network-first strategy for HTML pages to prevent reload loops
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request, { redirect: 'follow' })
        .then((fetchResponse) => {
          if (fetchResponse && fetchResponse.status === 200 && !fetchResponse.redirected) {
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return fetchResponse;
        })
        .catch(() => {
          // Only serve from cache if network fails
          return caches.match(event.request).then(response => {
            if (response) return response;
            return caches.match('/').then(fallback => {
              if (fallback) return fallback;
              // Simple offline page
              return new Response(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>FileStores - Offline</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>body { font-family: sans-serif; text-align: center; padding: 50px; }</style>
                  </head>
                  <body>
                    <h1>You're offline</h1>
                    <p>Please check your internet connection.</p>
                  </body>
                </html>
              `, { headers: { 'Content-Type': 'text/html' } });
            });
          });
        })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        // Network fallback for cache misses
        return fetch(event.request, { redirect: 'follow' })
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
        // Offline fallback for other resources
        if (event.request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f3f4f6"/><text x="100" y="100" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="#9ca3af">Offline</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
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
