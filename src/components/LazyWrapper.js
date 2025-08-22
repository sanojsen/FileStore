'use client';

import { useState, useEffect, useRef, memo } from 'react';

const LazyWrapper = memo(({ children, className = '', rootMargin = '50px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setHasBeenVisible(true);
          // Once visible, we can disconnect the observer for this element
          observer.unobserve(entry.target);
        }
      },
      {
        root: null,
        rootMargin: rootMargin,
        threshold: 0.1
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [rootMargin]);

  return (
    <div ref={elementRef} className={className}>
      {hasBeenVisible ? children : (
        <div className="w-full h-full bg-gray-100 animate-pulse rounded"></div>
      )}
    </div>
  );
});

LazyWrapper.displayName = 'LazyWrapper';

export default LazyWrapper;
