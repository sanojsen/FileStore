'use client';

import { useState, useEffect } from 'react';

export default function CacheManager({ showButton = true, className = '' }) {
  const [isClearing, setIsClearing] = useState(false);
  const [lastCleared, setLastCleared] = useState(null);
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    // Get cache information if possible
    getCacheInfo();
  }, []);

  const getCacheInfo = async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setCacheSize(estimate.usage || 0);
      }
    } catch (error) {
      console.error('Error getting cache info:', error);
    }
  };

  const clearPWACache = async () => {
    setIsClearing(true);
    
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        if (registration.active) {
          // Create a message channel to communicate with service worker
          const messageChannel = new MessageChannel();
          
          // Promise to wait for service worker response
          const response = new Promise((resolve, reject) => {
            messageChannel.port1.onmessage = (event) => {
              if (event.data.success) {
                resolve(event.data);
              } else {
                reject(new Error(event.data.error || 'Failed to clear cache'));
              }
            };
            
            setTimeout(() => {
              reject(new Error('Cache clearing timeout'));
            }, 10000);
          });
          
          // Send message to service worker
          registration.active.postMessage(
            { type: 'CLEAR_CACHE' },
            [messageChannel.port2]
          );
          
          await response;
          
          // Also clear browser caches
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map(name => caches.delete(name))
            );
          }
          
          setLastCleared(new Date());
          setCacheSize(0);
          
          // Optional: reload the page to get fresh content
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          
        } else {
          throw new Error('No active service worker found');
        }
      } else {
        throw new Error('Service workers not supported');
      }
    } catch (error) {
      console.error('Error clearing PWA cache:', error);
      alert('Failed to clear cache: ' + error.message);
    } finally {
      setIsClearing(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!showButton) {
    return null;
  }

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      {/* Cache Info */}
      <div className="text-xs text-gray-500 space-y-1">
        {cacheSize > 0 && (
          <div>Cache size: {formatBytes(cacheSize)}</div>
        )}
        {lastCleared && (
          <div>Last cleared: {formatTime(lastCleared)}</div>
        )}
      </div>
      
      {/* Clear Cache Button */}
      <button
        onClick={clearPWACache}
        disabled={isClearing}
        className={`
          inline-flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg
          transition-all duration-200 transform hover:scale-105
          ${isClearing 
            ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
            : 'bg-orange-100 hover:bg-orange-200 text-orange-800 hover:shadow-md'
          }
        `}
        title="Clear PWA cache and reload fresh content"
      >
        {isClearing ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Clearing...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Clear Cache</span>
          </>
        )}
      </button>
    </div>
  );
}
