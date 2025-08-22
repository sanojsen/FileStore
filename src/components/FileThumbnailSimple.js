import Image from 'next/image';
import { useState, useEffect } from 'react';

const FileThumbnailSimple = ({ file, size = 'w-16 h-16', className = '' }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL || 'https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev';
  
  // Reset states when file changes
  useEffect(() => {
    setImageError(false);
    setImageLoading(true);
  }, [file._id]);

  // For now, skip thumbnails and use original files directly for images/videos
  const getImageSrc = () => {
    if ((file.fileType === 'image' || file.fileType === 'video') && !imageError) {
      const originalUrl = `${baseUrl}${file.filePath}`;
      console.log('Using original file:', originalUrl);
      return originalUrl;
    }
    return null;
  };

  const imageSrc = getImageSrc();
  
  // Show image/video if we have a valid source
  if (imageSrc) {
    return (
      <div className={`${size} relative overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}>
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <div className="animate-pulse bg-gray-300 w-full h-full"></div>
          </div>
        )}
        <Image
          src={imageSrc}
          alt={file.originalName || file.fileName}
          fill
          className={`object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 12.5vw"
          onLoad={() => {
            console.log('Image loaded successfully:', imageSrc);
            setImageLoading(false);
          }}
          onError={() => {
            console.error('Image failed to load:', imageSrc);
            setImageLoading(false);
            setImageError(true);
          }}
        />
        
        {/* Debug indicator */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-1 py-0.5 rounded">
            ORIG
          </div>
        )}
      </div>
    );
  }

  // Generic thumbnails for different file types
  const getFileIcon = (fileType, mimeType) => {
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
      
      case 'audio':
        return (
          <div className={`${iconClass} bg-gradient-to-br from-purple-100 to-purple-200`}>
            <svg className="w-1/3 h-1/3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        );
      
      case 'pdf':
        return (
          <div className={`${iconClass} bg-gradient-to-br from-red-100 to-red-200`}>
            <svg className="w-1/3 h-1/3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
      
      case 'document':
        return (
          <div className={`${iconClass} bg-gradient-to-br from-blue-100 to-blue-200`}>
            <svg className="w-1/3 h-1/3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
      
      case 'archive':
        return (
          <div className={`${iconClass} bg-gradient-to-br from-yellow-100 to-yellow-200`}>
            <svg className="w-1/3 h-1/3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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

  return getFileIcon(file.fileType, file.mimeType);
};

export default FileThumbnailSimple;
