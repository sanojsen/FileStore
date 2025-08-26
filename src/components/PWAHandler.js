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

      if (isPWA && status === 'loading') {
        // If we're in PWA mode and still loading auth, wait a bit longer
        const timeout = setTimeout(() => {
          if (status === 'loading') {
            console.log('PWA: Auth taking too long, refreshing...');
            window.location.reload();
          }
        }, 5000);

        return () => clearTimeout(timeout);
      }
    };

    handlePWANavigation();

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          // Handle service worker updates
          console.log('PWA: Update available');
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
