'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Check if we're in a secure context
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn('Service Worker requires HTTPS or localhost');
        return;
      }

      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
          updateViaCache: 'none' // Don't aggressively check for updates
        })
        .then((registration) => {
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // SW ready to update - show non-intrusive notification
                  const updateEvent = new CustomEvent('sw-update-available', {
                    detail: { worker: newWorker }
                  });
                  window.dispatchEvent(updateEvent);
                }
              });
            }
          });
        })
        .catch((registrationError) => {
          console.error('SW registration failed:', registrationError);
        });

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE' && !event.data.silent) {
          // Only show notification if not marked as silent
          console.log('Update available:', event.data.version);
          // Could show a toast notification here if desired
        }
      });

      // Handle service worker updates - don't automatically reload
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('SW controller changed - update available but not forcing reload');
        // Don't reload automatically - let user choose when to refresh
      });
    } else {
      console.warn('Service Worker not supported');
    }
  }, []);

  return null; // This component doesn't render anything
}
