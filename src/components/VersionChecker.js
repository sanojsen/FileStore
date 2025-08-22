'use client';

import { useState, useEffect } from 'react';

export default function VersionChecker() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [newVersion, setNewVersion] = useState(null);

  useEffect(() => {
    // Check for version updates periodically
    const checkVersion = async () => {
      try {
        // Get current app version from package.json via API
        const response = await fetch('/api/version');
        if (response.ok) {
          const { version } = await response.json();
          setNewVersion(version);
          
          // Get stored version from localStorage
          const storedVersion = localStorage.getItem('filestores-version');
          
          // If we have a stored version and it's different from current, show update prompt
          if (storedVersion && storedVersion !== version) {
            console.log(`Version update detected: ${storedVersion} → ${version}`);
            setCurrentVersion(storedVersion);
            
            // Check if user dismissed this version update in current session
            const dismissed = sessionStorage.getItem(`filestores-dismissed-${version}`);
            if (!dismissed) {
              setShowUpdatePrompt(true);
            }
          } else {
            // Store current version
            localStorage.setItem('filestores-version', version);
            setCurrentVersion(version);
          }
        }
      } catch (error) {
        console.error('Version check failed:', error);
      }
    };

    // Initial check
    checkVersion();
    
    // Check every 30 minutes
    const interval = setInterval(checkVersion, 30 * 60 * 1000);
    
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker controller changed - checking version');
        // Small delay to ensure new service worker is ready
        setTimeout(checkVersion, 500);
      });
      
      // Listen for waiting service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          console.log('Service worker reported update available');
          setShowUpdatePrompt(true);
        }
      });
    }

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      // Store the new version immediately to prevent showing prompt again
      if (newVersion) {
        localStorage.setItem('filestores-version', newVersion);
      }
      
      if ('serviceWorker' in navigator) {
        // First, unregister the current service worker
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.unregister();
          console.log('Service worker unregistered');
        }
        
        // Clear all caches manually
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => {
              console.log('Deleting cache:', cacheName);
              return caches.delete(cacheName);
            })
          );
          console.log('All caches cleared');
        }
        
        // Wait a moment for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force reload to register new service worker and load fresh content
        window.location.reload(true);
      } else {
        // Fallback: just reload
        window.location.reload(true);
      }
    } catch (error) {
      console.error('Update failed:', error);
      // Fallback: just reload
      window.location.reload(true);
    }
  };

  const dismissUpdate = () => {
    setShowUpdatePrompt(false);
    // Store dismissal for current session to prevent showing again immediately
    sessionStorage.setItem(`filestores-dismissed-${newVersion}`, 'true');
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900">
              New Version Available
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              A new version of FileStores is available.
              {currentVersion && newVersion && (
                <span className="block text-xs mt-1">
                  Current: {currentVersion} → New: {newVersion}
                </span>
              )}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Update now to get the latest features and bug fixes.
            </p>
          </div>
          
          <button
            onClick={dismissUpdate}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mt-4 flex space-x-3">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            {isUpdating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Updating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Update Now</span>
              </>
            )}
          </button>
          
          <button
            onClick={dismissUpdate}
            disabled={isUpdating}
            className="px-3 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 text-sm font-medium transition-colors duration-200"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
