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
          scope: '/'
        })
        .then((registration) => {
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // SW ready to update
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
        console.log('Message from SW:', event.data);
      });

      // Handle service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('SW controller changed - reloading page');
        window.location.reload();
      });
    } else {
      console.warn('Service Worker not supported');
    }
  }, []);

  return null; // This component doesn't render anything
}
