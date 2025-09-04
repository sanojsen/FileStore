'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function PWAHandler() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Handle PWA-specific navigation issues
    const handlePWANavigation = () => {
      // Check if running as PWA
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                    window.navigator.standalone ||
                    document.referrer.includes('android-app://');

      if (isPWA) {
        console.log('PWA: Running in standalone mode');
        
        // Handle auth loading state for PWA
        if (status === 'loading') {
          const timeout = setTimeout(() => {
            if (status === 'loading') {
              console.log('PWA: Auth taking too long, attempting refresh...');
              // Try to refresh the page once, then redirect to home
              if (!sessionStorage.getItem('pwa-refresh-attempted')) {
                sessionStorage.setItem('pwa-refresh-attempted', 'true');
                window.location.reload();
              } else {
                sessionStorage.removeItem('pwa-refresh-attempted');
                router.push('/');
              }
            }
          }, 8000); // Increased timeout for slower networks

          return () => clearTimeout(timeout);
        } else {
          // Clear the refresh flag when auth completes
          sessionStorage.removeItem('pwa-refresh-attempted');
        }

        // Handle PWA navigation state
        if (status === 'unauthenticated') {
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/upload')) {
            console.log('PWA: Redirecting unauthenticated user to home');
            router.push('/');
          }
        }
      }
    };

    handlePWANavigation();

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          console.log('PWA: Update available, version:', event.data.version);
          // Optionally show user notification about update
          // For now, just log it
        }
      });

      // Register service worker if not already registered
      navigator.serviceWorker.getRegistration().then(registration => {
        if (!registration) {
          console.log('PWA: Registering service worker...');
          navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('PWA: Service worker registered'))
            .catch(err => console.error('PWA: Service worker registration failed', err));
        }
      });
    }

    // Handle PWA install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      // Store the event for later use
      window.deferredPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [status, router]);

  // Handle PWA-specific session issues
  useEffect(() => {
    if (status === 'unauthenticated') {
      const currentPath = window.location.pathname;
      
      // If we're on a protected route and unauthenticated, redirect to home
      if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/upload')) {
        router.push('/');
      }
    }
  }, [status, router]);

  return null; // This component doesn't render anything
}
