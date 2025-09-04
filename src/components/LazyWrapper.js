'use client';
import { useState, useEffect, useRef, memo } from 'react';

const LazyWrapper = memo(({ children, className = '', rootMargin = '100px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const elementRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    // Disconnect previous observer if it exists
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasBeenVisible) {
          setIsVisible(true);
          setHasBeenVisible(true);
          // Once visible, disconnect to prevent further observations
          observer.unobserve(entry.target);
        }
      },
      {
        root: null,
        rootMargin: rootMargin,
        threshold: 0.1
      }
    );
    
    observerRef.current = observer;

    if (elementRef.current && !hasBeenVisible) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [rootMargin, hasBeenVisible]); // Added hasBeenVisible to dependencies

  return (
    <div ref={elementRef} className={className}>
      {hasBeenVisible ? children : (
        <div className="w-full h-full bg-gray-100 animate-pulse rounded min-h-[100px]"></div>
      )}
    </div>
  );
});

LazyWrapper.displayName = 'LazyWrapper';
export default LazyWrapper;
