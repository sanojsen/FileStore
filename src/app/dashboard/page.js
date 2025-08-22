'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Use dynamic import with no SSR to avoid bundling issues
const FileThumbnail = dynamic(() => import('../../components/FileThumbnail'), {
  ssr: false,
  loading: () => <div className="w-16 h-16 bg-gray-200 animate-pulse rounded"></div>
});

const LazyWrapper = dynamic(() => import('../../components/LazyWrapper'), {
  ssr: false,
  loading: () => <div className="bg-gray-100 animate-pulse rounded h-32"></div>
});

// Progressive Image Component for better loading experience
const ProgressiveImage = ({ file, className, style }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [imageWidth, setImageWidth] = useState('auto');
  const [imageError, setImageError] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL || 'https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev';
  
  // Get thumbnail and original URLs
  const thumbnailUrl = file.thumbnailUrl || (file.thumbnailPath ? `${baseUrl}${file.thumbnailPath}` : null);
  const originalUrl = file.fileType === 'image' ? `${baseUrl}${file.filePath}` : thumbnailUrl;
  
  // Use thumbnail for videos, original for images
  const lowResUrl = thumbnailUrl;
  const highResUrl = file.fileType === 'image' ? originalUrl : thumbnailUrl;
  
  useEffect(() => {
    // Reset all states when file changes
    setImageLoaded(false);
    setHighResLoaded(false);
    setImageWidth('auto');
    setImageError(false);
    
    // For images, preload the high-res version
    if (file.fileType === 'image' && originalUrl && thumbnailUrl && originalUrl !== thumbnailUrl) {
      const img = new Image();
      img.onload = () => setHighResLoaded(true);
      img.onerror = () => setHighResLoaded(true); // Show thumbnail if high-res fails
      img.src = highResUrl;
    } else {
      // For videos or when no separate high-res version exists
      setHighResLoaded(true);
    }
  }, [file._id, highResUrl, originalUrl, thumbnailUrl, file.fileType]);

  const handleImageLoad = (e) => {
    setImageLoaded(true);
    setImageError(false);
    // Set the actual width of the loaded image to the container
    const img = e.target;
    if (img.naturalWidth && img.naturalHeight) {
      const containerHeight = 256; // h-64 = 256px
      const naturalWidth = (img.naturalWidth / img.naturalHeight) * containerHeight;
      setImageWidth(`${naturalWidth}px`);
    }
  };

  const handleImageError = (e) => {
    setImageError(true);
    setImageLoaded(true); // Hide loading indicator even on error
  };

  // If no valid URL, show error immediately
  if (!lowResUrl) {
    return (
      <div className="h-full w-64 flex items-center justify-center bg-gray-100">
        <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div 
      className="h-full relative inline-block"
      style={{ 
        width: imageLoaded && imageWidth !== 'auto' ? imageWidth : 'auto', 
        minWidth: imageLoaded && imageWidth !== 'auto' ? imageWidth : '100px' 
      }}
    >
      {/* Low-res thumbnail (loads first) */}
      <img
        src={lowResUrl}
        alt={file.originalName}
        className={`${className} relative z-10 transition-opacity duration-300 ${
          highResLoaded && file.fileType === 'image' ? 'opacity-0' : 'opacity-100'
        }`}
        style={style}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {/* High-res original (for images only, loads on top) */}
      {file.fileType === 'image' && highResUrl && lowResUrl && highResUrl !== lowResUrl && !imageError && (
        <img
          src={highResUrl}
          alt={file.originalName}
          className={`${className} absolute inset-0 z-20 transition-opacity duration-300 ${
            highResLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={style}
          onError={() => setHighResLoaded(false)} // Fall back to thumbnail on error
        />
      )}
      
      {/* Loading indicator - only show when no image is loaded */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-0">
          <div className="animate-pulse bg-gray-300 rounded-full w-8 h-8"></div>
        </div>
      )}
      
      {/* Error state */}
      {imageError && (
        <div className="h-full w-64 flex items-center justify-center bg-gray-100">
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('uploadDate');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [viewableFiles, setViewableFiles] = useState([]);
  const [downloading, setDownloading] = useState(false);
  
  // Refs for infinite scroll
  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
  }, [status, router]);

  // Fetch files from the API
  const fetchFiles = useCallback(async (pageNum = 1, reset = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '12',
        sortBy: sortBy
      });

      if (filter !== 'all') {
        params.append('type', filter);
      }

      const response = await fetch(`/api/files?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch files');
      }

      if (reset || pageNum === 1) {
        setFiles(data.files);
      } else {
        setFiles(prev => [...prev, ...data.files]);
      }
      
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, sortBy]);

  // Initial load - only when session is authenticated and filter/sort changes
  useEffect(() => {
    if (status === 'authenticated' && session) {
      fetchFiles(1, true);
    }
  }, [status, fetchFiles]); // Removed session dependency to prevent re-fetches

  // Prevent tab from being discarded by keeping it active
  useEffect(() => {
    const keepAlive = () => {
      // This prevents the tab from being discarded by Chrome
      if (document.hidden) return;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && session) {
        // Tab became visible again, optionally refresh data if needed
        console.log('Tab became visible');
      }
    };

    // Keep the tab active
    const interval = setInterval(keepAlive, 30000); // Every 30 seconds
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '100px', // Start loading 100px before reaching the target
        threshold: 0.1
      }
    );

    observerRef.current = observer;

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loading]);

  // Load more files
  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      fetchFiles(page + 1, false);
    }
  }, [hasMore, loadingMore, loading, fetchFiles, page]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle file selection
  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  // Select all files in current view
  const selectAllFiles = () => {
    setSelectedFiles(new Set(files.map(file => file._id)));
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedFiles(new Set());
    setIsSelectionMode(false);
  };

  // Delete selected files
  const deleteSelectedFiles = async () => {
    if (selectedFiles.size === 0) return;

    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''}? This action cannot be undone.`);
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedFiles).map(async (fileId) => {
        const response = await fetch(`/api/files?id=${fileId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error(`Failed to delete file ${fileId}:`, errorData);
          return { success: false, fileId, error: errorData.error || response.statusText };
        }
        
        return { success: true, fileId };
      });

      const results = await Promise.all(deletePromises);
      const failedDeletes = results.filter(result => !result.success);
      const successfulDeletes = results.filter(result => result.success);

      if (failedDeletes.length > 0) {
        // Show detailed error information
        const errorMessages = failedDeletes.map(fail => `File ID ${fail.fileId}: ${fail.error}`).join('\n');
        console.error('Delete failures:', errorMessages);
        
        if (successfulDeletes.length > 0) {
          // Some succeeded, some failed
          setError(`Successfully deleted ${successfulDeletes.length} file${successfulDeletes.length !== 1 ? 's' : ''}, but failed to delete ${failedDeletes.length} file${failedDeletes.length !== 1 ? 's' : ''}. Check console for details.`);
          // Remove only the successfully deleted files from state
          const successfulIds = new Set(successfulDeletes.map(s => s.fileId));
          setFiles(prevFiles => prevFiles.filter(file => !successfulIds.has(file._id)));
          // Update selection to only include failed deletes
          setSelectedFiles(new Set(failedDeletes.map(f => f.fileId)));
        } else {
          // All failed
          throw new Error(`Failed to delete all ${failedDeletes.length} file${failedDeletes.length !== 1 ? 's' : ''}. Check console for details.`);
        }
      } else {
        // All succeeded
        setFiles(prevFiles => prevFiles.filter(file => !selectedFiles.has(file._id)));
        clearSelection();
      }
    } catch (err) {
      console.error('Error deleting files:', err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Select all files in a date group
  const selectDateGroup = (groupFiles) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    
    const groupFileIds = groupFiles.map(file => file._id);
    const allSelected = groupFileIds.every(id => selectedFiles.has(id));
    
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      
      if (allSelected) {
        // Deselect all files in the group
        groupFileIds.forEach(id => newSet.delete(id));
      } else {
        // Select all files in the group
        groupFileIds.forEach(id => newSet.add(id));
      }
      
      return newSet;
    });
  };

  // Download single file
  const downloadFile = async (file) => {
    try {
      console.log('Downloading:', file.originalName);
      
      // Use the dedicated download API endpoint with proper credentials
      const response = await fetch(`/api/files/download?id=${file._id}`, {
        method: 'GET',
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        // Get error details
        const errorText = await response.text();
        console.error('Download failed:', response.status, errorText);
        throw new Error(`Download failed (${response.status}): ${errorText}`);
      }
      
      // Get the blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Download error:', error);
      setError(`Failed to download ${file.originalName}: ${error.message}`);
    }
  };

  // Download selected files as ZIP
  const downloadSelectedFiles = async () => {
    if (selectedFiles.size === 0) return;

    setDownloading(true);
    try {
      const selectedFileIds = Array.from(selectedFiles);
      
      const response = await fetch('/api/files/download-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds: selectedFileIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create ZIP file');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      link.download = `files-${timestamp}.zip`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      setError(error.message || 'Failed to download files as ZIP');
    } finally {
      setDownloading(false);
    }
  };

  // Format dates client-side to avoid hydration mismatch
  const [formattedDates, setFormattedDates] = useState({});
  const [groupedFiles, setGroupedFiles] = useState({});
  
  useEffect(() => {
    const newFormatted = {};
    const grouped = {};
    
    files.forEach(file => {
      if (file.uploadedAt) {
        const date = new Date(file.uploadedAt);
        const dateKey = date.toDateString(); // e.g., "Mon Aug 22 2025"
        const formattedDate = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        // Store formatted date for individual files
        newFormatted[file._id] = date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Group files by date
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: date,
            formattedDate: formattedDate,
            files: []
          };
        }
        grouped[dateKey].files.push(file);
      }
    });
    
    // Sort groups by date (newest first)
    const sortedGrouped = Object.keys(grouped)
      .sort((a, b) => grouped[b].date - grouped[a].date)
      .reduce((acc, key) => {
        acc[key] = grouped[key];
        return acc;
      }, {});
    
    setFormattedDates(newFormatted);
    setGroupedFiles(sortedGrouped);
  }, [files]);

  // Handle file click (you can expand this to show file details or download)
  const handleFileClick = (file) => {
    if (isSelectionMode) {
      toggleFileSelection(file._id);
    } else {
      // Open viewer for images and videos
      if (file.fileType === 'image' || file.fileType === 'video') {
        // Get all viewable files (images and videos) in order
        const viewable = files.filter(f => f.fileType === 'image' || f.fileType === 'video');
        const index = viewable.findIndex(f => f._id === file._id);
        setViewableFiles(viewable);
        setCurrentFileIndex(index);
        setViewerOpen(true);
      } else {
        // For other file types, just log for now
        console.log('File clicked:', file);
      }
    }
  };

  // Navigate to previous file in viewer
  const goToPrevious = () => {
    setCurrentFileIndex(prev => prev > 0 ? prev - 1 : viewableFiles.length - 1);
  };

  // Navigate to next file in viewer
  const goToNext = () => {
    setCurrentFileIndex(prev => prev < viewableFiles.length - 1 ? prev + 1 : 0);
  };

  // Close viewer
  const closeViewer = () => {
    setViewerOpen(false);
    setCurrentFileIndex(0);
    setViewableFiles([]);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!viewerOpen) return;
      
      switch (e.key) {
        case 'Escape':
          closeViewer();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [viewerOpen, currentFileIndex, viewableFiles.length]);

  // Full-screen viewer component
  const FileViewer = () => {
    if (!viewerOpen || viewableFiles.length === 0) return null;
    
    const currentFile = viewableFiles[currentFileIndex];
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL || 'https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev';
    const fileUrl = `${baseUrl}${currentFile.filePath}`;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center">
        {/* Close button */}
        <button
          onClick={closeViewer}
          className="absolute top-4 right-4 z-60 text-white hover:text-gray-300 transition-colors"
          title="Close (ESC)"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Navigation arrows */}
        {viewableFiles.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-60 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full p-2"
              title="Previous (←)"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-60 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full p-2"
              title="Next (→)"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* File counter */}
        {viewableFiles.length > 1 && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-60 text-white bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm">
            {currentFileIndex + 1} of {viewableFiles.length}
          </div>
        )}

        {/* File info */}
        <div className="absolute bottom-4 left-4 right-4 z-60 text-white bg-black bg-opacity-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium truncate" title={currentFile.originalName}>
            {currentFile.originalName}
          </h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
            <span>{formatFileSize(currentFile.size)}</span>
            <span className="capitalize">{currentFile.fileType}</span>
            {formattedDates[currentFile._id] && (
              <span>{formattedDates[currentFile._id]}</span>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-full max-h-full p-8 flex items-center justify-center">
          {currentFile.fileType === 'image' ? (
            <img
              src={fileUrl}
              alt={currentFile.originalName}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: 'calc(100vh - 8rem)' }}
            />
          ) : currentFile.fileType === 'video' ? (
            <video
              src={fileUrl}
              controls
              className="max-w-full max-h-full"
              style={{ maxHeight: 'calc(100vh - 8rem)' }}
              autoPlay={false}
            >
              Your browser does not support the video tag.
            </video>
          ) : null}
        </div>

        {/* Thumbnail strip for navigation */}
        {viewableFiles.length > 1 && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-60">
            <div className="flex gap-2 bg-black bg-opacity-50 p-2 rounded-lg max-w-screen-lg overflow-x-auto">
              {viewableFiles.map((file, index) => {
                const thumbUrl = file.thumbnailUrl || (file.thumbnailPath ? `${baseUrl}${file.thumbnailPath}` : `${baseUrl}${file.filePath}`);
                return (
                  <button
                    key={file._id}
                    onClick={() => setCurrentFileIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      index === currentFileIndex 
                        ? 'border-white shadow-lg' 
                        : 'border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {file.fileType === 'image' || file.fileType === 'video' ? (
                      <img
                        src={thumbUrl}
                        alt={file.originalName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Get default icon based on file type
  const getDefaultIcon = (fileType, mimeType) => {
    const iconClass = "w-full h-full flex items-center justify-center bg-gray-100";
    
    if (fileType === 'image') {
      return (
        <div className={iconClass}>
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      );
    } else if (fileType === 'video') {
      return (
        <div className={iconClass}>
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      );
    } else if (fileType === 'audio') {
      return (
        <div className={iconClass}>
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      );
    } else if (fileType === 'pdf') {
      return (
        <div className={iconClass}>
          <svg className="w-16 h-16 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2A3,3 0 0,1 15,5V7H15A2,2 0 0,1 17,9V19A2,2 0 0,1 15,21H5A2,2 0 0,1 3,19V9A2,2 0 0,1 5,7H9V5A3,3 0 0,1 12,2M12,4A1,1 0 0,0 11,5V7H13V5A1,1 0 0,0 12,4Z" />
          </svg>
        </div>
      );
    } else if (fileType === 'document') {
      return (
        <div className={iconClass}>
          <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      );
    } else if (fileType === 'archive') {
      return (
        <div className={iconClass}>
          <svg className="w-16 h-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
      );
    } else {
      return (
        <div className={iconClass}>
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      );
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            </div>
            <button
              onClick={() => router.push('/upload')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200"
            >
              Upload Files
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className=" mx-auto px-4 sm:px-6 lg:px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* File Type Filter */}
            <div className="flex items-center space-x-2">
              <label htmlFor="filter" className="text-sm font-medium text-gray-700">
                Filter:
              </label>
              <select
                id="filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Files</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="pdf">PDFs</option>
                <option value="document">Documents</option>
                <option value="archive">Archives</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Sort Options */}
            <div className="flex items-center space-x-2">
              <label htmlFor="sort" className="text-sm font-medium text-gray-700">
                Sort by:
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="uploadDate">Upload Date</option>
                <option value="createdDate">Created Date</option>
              </select>
            </div>

            {/* File Count and Selection Controls */}
            <div className="ml-auto flex items-center gap-4">
              {isSelectionMode ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {selectedFiles.size} selected
                  </span>
                  <button
                    onClick={selectAllFiles}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteSelectedFiles}
                    disabled={selectedFiles.size === 0 || deleting}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : `Delete ${selectedFiles.size > 0 ? `(${selectedFiles.size})` : ''}`}
                  </button>
                  <button
                    onClick={downloadSelectedFiles}
                    disabled={selectedFiles.size === 0 || downloading}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloading ? 'Creating ZIP...' : `Download ${selectedFiles.size > 0 ? `(${selectedFiles.size})` : ''}`}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {files.length} files
                  </span>
                  <button
                    onClick={() => setIsSelectionMode(true)}
                    className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                  >
                    Select Files
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading your files...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && files.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === 'all' ? 'Get started by uploading your first file.' : `No ${filter} files found.`}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => router.push('/upload')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Upload Files
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Files Gallery */}
        {!loading && !error && files.length > 0 && (
          <div className="bg-white shadow-sm overflow-hidden">
            <div className="p-6">
              {Object.keys(groupedFiles).map((dateKey, groupIndex) => {
                const group = groupedFiles[dateKey];
                return (
                  <div key={dateKey} className={groupIndex > 0 ? 'mt-8' : ''}>
                    {/* Enhanced Date Header with Selection */}
                    <div className="flex items-center mb-6 group">
                      <div className="flex-grow border-t border-gray-300"></div>
                      <div 
                        onClick={() => selectDateGroup(group.files)}
                        className="relative px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer"
                      >
                        {/* Selection indicator */}
                        {(() => {
                          const groupFileIds = group.files.map(f => f._id);
                          const selectedInGroup = groupFileIds.filter(id => selectedFiles.has(id)).length;
                          const allSelected = selectedInGroup === groupFileIds.length;
                          const someSelected = selectedInGroup > 0;
                          
                          return (
                            <>
                              {/* Selection checkbox */}
                              <div className="absolute -left-2 top-1/2 transform -translate-y-1/2">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                                  allSelected 
                                    ? 'bg-blue-600 border-blue-600' 
                                    : someSelected
                                    ? 'bg-blue-100 border-blue-400'
                                    : 'bg-white border-gray-300 group-hover:border-blue-400'
                                }`}>
                                  {allSelected ? (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : someSelected ? (
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-sm"></div>
                                  ) : null}
                                </div>
                              </div>
                              
                              {/* Date content */}
                              <div className="flex items-center gap-3">
                                {/* Date text and file count */}
                                <div className="text-left">
                                  <h2 className="text-sm font-medium text-gray-700">
                                    {group.formattedDate}
                                  </h2>
                                </div>
                                
                                {/* Delete action - only show when files are selected */}
                                {someSelected && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Filter selected files to only those in this group
                                      const groupSelectedIds = groupFileIds.filter(id => selectedFiles.has(id));
                                      if (groupSelectedIds.length > 0) {
                                        const confirmDelete = window.confirm(`Delete ${groupSelectedIds.length} selected file${groupSelectedIds.length !== 1 ? 's' : ''} from ${group.formattedDate}?`);
                                        if (confirmDelete) {
                                          // Set selected files to only this group's selected files and trigger delete
                                          setSelectedFiles(new Set(groupSelectedIds));
                                          setTimeout(() => deleteSelectedFiles(), 0);
                                        }
                                      }
                                    }}
                                    className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                    title={`Delete ${selectedInGroup} selected file${selectedInGroup !== 1 ? 's' : ''}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex-grow border-t border-gray-300"></div>
                    </div>
                    
                    {/* Files for this date */}
                    <div className="flex flex-wrap gap-1">
                      {group.files.map((file) => (
                        <LazyWrapper
                          key={file._id}
                          className="group cursor-pointer bg-gray-50 overflow-hidden hover:shadow-md transition-shadow duration-200 relative h-64 inline-block"
                          rootMargin="100px"
                        >
                          <div
                            onClick={() => handleFileClick(file)}
                            className="w-full h-full"
                          >
                          {/* Selection Checkbox */}
                          {isSelectionMode && (
                            <div className="absolute top-2 right-2 z-30">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFileSelection(file._id);
                                }}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                                  selectedFiles.has(file._id)
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'bg-white border-gray-300 hover:border-blue-400'
                                }`}
                              >
                                {selectedFiles.has(file._id) && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Thumbnail with aspect ratio maintained */}
                          <div className="h-full relative">
                            {file.thumbnailUrl || (file.fileType === 'image' || file.fileType === 'video') ? (
                              <ProgressiveImage 
                                file={file}
                                className="h-full w-auto object-contain"
                                style={{ maxWidth: 'none' }}
                              />
                            ) : (
                              <div className="h-full w-64 flex items-center justify-center bg-gray-100">
                                {getDefaultIcon(file.fileType, file.mimeType)}
                              </div>
                            )}
                            
                            {/* File Info Overlay - appears on hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end z-25">
                              <div className="p-3 text-white">
                                <h3 className="text-sm font-medium truncate drop-shadow-lg" title={file.originalName}>
                                  {file.originalName}
                                </h3>
                                <p className="text-xs mt-1 opacity-90 drop-shadow-lg">
                                  {formatFileSize(file.size)}
                                </p>
                                <p className="text-xs mt-1 opacity-75 drop-shadow-lg">
                                  {formattedDates[file._id] || ''}
                                </p>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium drop-shadow-lg ${
                                    file.fileType === 'image' ? 'bg-green-500 text-white' :
                                    file.fileType === 'video' ? 'bg-red-500 text-white' :
                                    file.fileType === 'audio' ? 'bg-purple-500 text-white' :
                                    file.fileType === 'pdf' ? 'bg-red-600 text-white' :
                                    file.fileType === 'document' ? 'bg-blue-500 text-white' :
                                    file.fileType === 'archive' ? 'bg-yellow-600 text-white' :
                                    'bg-gray-500 text-white'
                                  }`}>
                                    {file.fileType}
                                  </span>
                                  
                                  {/* Download button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadFile(file);
                                    }}
                                    className="ml-2 p-1 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
                                    title="Download file"
                                  >
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          </div>
                        </LazyWrapper>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Intersection Observer Target for Infinite Scroll */}
            {hasMore && (
              <div 
                ref={loadMoreRef}
                className="border-t border-gray-200 p-6 text-center"
              >
                {loadingMore ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">Loading more files...</span>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm">
                    Scroll down to load more files
                  </div>
                )}
              </div>
            )}
            
            {/* End of results indicator */}
            {!hasMore && files.length > 0 && (
              <div className="border-t border-gray-200 p-6 text-center">
                <div className="text-gray-400 text-sm">
                  You've reached the end. No more files to load.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-screen File Viewer */}
      <FileViewer />
    </div>
  );
}