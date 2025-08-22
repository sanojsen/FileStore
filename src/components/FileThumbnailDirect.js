import { useState, useEffect } from 'react';

const FileThumbnailDirect = ({ file, size = 'w-16 h-16', className = '' }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [fallbackError, setFallbackError] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL || 'https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev';
  
  // Reset states when file changes
  useEffect(() => {
    setImageError(false);
    setFallbackError(false);
    setImageLoading(true);
  }, [file._id]);

  // Determine the best image source to use
  const getImageSrc = () => {
    // First priority: Use thumbnail if available and no error
    if (file.thumbnailPath && !imageError) {
      return `${baseUrl}${file.thumbnailPath}`;
    }
    
    // Second priority: For images and videos, try original file if thumbnail failed
    if ((file.fileType === 'image' || file.fileType === 'video') && imageError && !fallbackError) {
      return `${baseUrl}${file.filePath}`;
    }
    
    return null;
  };

  const imageSrc = getImageSrc();
  
  // Show image/video using regular img tag (not Next.js Image)
  if (imageSrc) {
    return (
      <div className={`${size} relative overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}>
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <div className="animate-pulse bg-gray-300 w-full h-full"></div>
          </div>
        )}
        <img
          src={imageSrc}
          alt={file.originalName || file.fileName}
          className={`w-full h-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoad={() => {
            console.log('✅ Image loaded successfully:', imageSrc);
            setImageLoading(false);
          }}
          onError={() => {
            console.error('❌ Image failed to load:', imageSrc);
            console.log('File info:', {
              originalName: file.originalName,
              fileType: file.fileType,
              thumbnailPath: file.thumbnailPath,
              filePath: file.filePath,
              currentError: imageError,
              fallbackError: fallbackError
            });
            setImageLoading(false);
            if (!imageError && file.thumbnailPath) {
              // Try original file if thumbnail failed
              console.log('🔄 Switching to original file...');
              setImageError(true);
            } else {
              // Show generic icon
              console.log('🔄 Showing generic icon...');
              setFallbackError(true);
            }
          }}
        />
        
        {/* Debug indicator */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
            {!imageError ? 'T' : 'O'}
          </div>
        )}
      </div>
    );
  }

  // Generic thumbnails for different file types
  const getFileIcon = (fileType) => {
    const iconClass = `${size} flex items-center justify-center flex-shrink-0 ${className}`;
    
    switch (fileType) {
      case 'image':
        return (
          <div className={`${iconClass} bg-gradient-to-br from-green-100 to-green-200`}>
            <svg className="w-1/3 h-1/3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        );
      
      case 'video':
        return (
          <div className={`${iconClass} bg-gradient-to-br from-red-100 to-red-200`}>
            <svg className="w-1/3 h-1/3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        );
      
      default:
        return (
          <div className={`${iconClass} bg-gradient-to-br from-gray-100 to-gray-200`}>
            <svg className="w-1/3 h-1/3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
    }
  };

  return getFileIcon(file.fileType);
};

export default FileThumbnailDirect;
