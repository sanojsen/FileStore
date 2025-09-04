/**
 * Thumbnail Service - Optimized for Vercel Free Tier
 * Uses lightweight client-side generation with robust HEIC support
 */

import HEICConverter from './heicConverter.js';

export class ThumbnailService {
  static SUPPORTED_CLIENT_FORMATS = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp'
  ];

  static UNSUPPORTED_CLIENT_FORMATS = [
    'image/heic',
    'image/heif',
    'image/avif',
    'image/tiff',
    'image/raw'
  ];

  /**
   * Check if a file can be processed client-side
   */
  static canProcessClientSide(file) {
    // Check MIME type
    if (this.SUPPORTED_CLIENT_FORMATS.includes(file.type.toLowerCase())) {
      return true;
    }

    // Check file extension as fallback (but exclude HEIC - they need special handling)
    const ext = this.getFileExtension(file.name).toLowerCase();
    const supportedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
    return supportedExts.includes(ext);
  }

  /**
   * Check if a file is HEIC/HEIF
   */
  static isHEIC(file) {
    const mimeType = file.type.toLowerCase();
    const ext = this.getFileExtension(file.name).toLowerCase();
    
    return (
      mimeType === 'image/heic' || 
      mimeType === 'image/heif' ||
      ext === 'heic' || 
      ext === 'heif'
    );
  }

  /**
   * Get file extension from filename
   */
  static getFileExtension(filename) {
    return filename.split('.').pop() || '';
  }

  /**
   * Create thumbnail using best available method
   */
  static async createThumbnail(file, maxSize = 300) {
    try {
      // Handle HEIC files first (they need special conversion)
      if (this.isHEIC(file)) {
        try {
          return await this.createHEICThumbnail(file, maxSize);
        } catch (heicError) {
          console.warn('HEIC thumbnail failed, creating placeholder:', heicError.message);
          return this.createPlaceholderThumbnail(file, maxSize);
        }
      }

      // Handle video files with canvas-based thumbnail generation
      if (file.type.startsWith('video/')) {
        try {
          return await this.createVideoThumbnail(file, maxSize);
        } catch (videoError) {
          console.warn('Video thumbnail failed, creating placeholder:', videoError.message);
          return this.createPlaceholderThumbnail(file, maxSize);
        }
      }

      // Handle standard image formats with client-side processing
      if (this.canProcessClientSide(file)) {
        try {
          return await this.createClientThumbnail(file, maxSize);
        } catch (clientError) {
          console.warn('Client thumbnail failed, trying FileReader approach:', clientError.message);
          try {
            return await this.createThumbnailWithFileReader(file, maxSize);
          } catch (fileReaderError) {
            console.warn('FileReader thumbnail also failed, creating placeholder:', fileReaderError.message);
            return this.createPlaceholderThumbnail(file, maxSize);
          }
        }
      }

      // For non-image files, create placeholder
      return this.createPlaceholderThumbnail(file, maxSize);

    } catch (error) {
      console.error('❌ Thumbnail creation failed:', error.message);
      // Always return a placeholder rather than null
      return this.createPlaceholderThumbnail(file, maxSize);
    }
  }

  /**
   * Create client-side thumbnail using Canvas with enhanced error handling
   */
  static async createClientThumbnail(file, maxSize) {
    return new Promise((resolve, reject) => {
      // Validate file first
      if (!file || !file.type || !file.type.startsWith('image/')) {
        reject(new Error(`Invalid image file: ${file?.type || 'unknown type'}`));
        return;
      }

      // Check file size (limit to reasonable size for client processing)
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        reject(new Error(`Image file too large: ${(file.size / 1024 / 1024).toFixed(1)}MB`));
        return;
      }

      // Additional validation - check if file is actually readable
      if (!file.size || file.size === 0) {
        reject(new Error(`Invalid file size: ${file.size} bytes`));
        return;
      }

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let objectUrl = null;

      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error(`Image loading timeout after 10 seconds for ${file.name}`));
      }, 10000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          // Clean up object URL immediately
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
          
          // Validate image dimensions
          if (img.width === 0 || img.height === 0) {
            reject(new Error(`Invalid image dimensions: ${img.width}x${img.height}`));
            return;
          }
          
          // Calculate dimensions
          const { width: newWidth, height: newHeight } = this.calculateDimensions(
            img.width, 
            img.height, 
            maxSize
          );

          canvas.width = newWidth;
          canvas.height = newHeight;

          // Draw image
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          // Convert to blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve({
                blob,
                width: newWidth,
                height: newHeight,
                mimeType: 'image/jpeg',
                source: 'client'
              });
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          }, 'image/jpeg', 0.85);
        } catch (error) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          reject(new Error(`Canvas processing failed: ${error.message}`));
        }
      };

      img.onerror = (event) => {
        clearTimeout(timeout);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
        
        // More detailed error information
        const errorDetails = [];
        errorDetails.push(`File: ${file.name}`);
        errorDetails.push(`Type: ${file.type}`);
        errorDetails.push(`Size: ${(file.size / 1024).toFixed(1)}KB`);
        
        if (event && event.type) {
          errorDetails.push(`Event: ${event.type}`);
        }
        
        reject(new Error(`Failed to load image for thumbnail - ${errorDetails.join(', ')}`));
      };

      try {
        // Create object URL with error handling
        objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`Failed to create object URL: ${error.message}`));
      }
    });
  }

  /**
   * Alternative thumbnail creation using FileReader (fallback method)
   */
  static async createThumbnailWithFileReader(file, maxSize) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
          try {
            // Validate image dimensions
            if (img.width === 0 || img.height === 0) {
              reject(new Error(`Invalid image dimensions: ${img.width}x${img.height}`));
              return;
            }
            
            // Calculate dimensions
            const { width: newWidth, height: newHeight } = this.calculateDimensions(
              img.width, 
              img.height, 
              maxSize
            );

            canvas.width = newWidth;
            canvas.height = newHeight;

            // Draw image
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // Convert to blob
            canvas.toBlob((blob) => {
              if (blob) {
                resolve({
                  blob,
                  width: newWidth,
                  height: newHeight,
                  mimeType: 'image/jpeg',
                  source: 'client_filereader'
                });
              } else {
                reject(new Error('Failed to create thumbnail blob with FileReader'));
              }
            }, 'image/jpeg', 0.85);
          } catch (error) {
            reject(new Error(`Canvas processing failed with FileReader: ${error.message}`));
          }
        };

        img.onerror = () => {
          reject(new Error(`Failed to load image with FileReader: ${file.name}`));
        };

        img.src = e.target.result;
      };

      reader.onerror = () => {
        reject(new Error(`FileReader failed to read file: ${file.name}`));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Create HEIC thumbnail using robust client-side conversion
   */
  static async createHEICThumbnail(file, maxSize) {
    try {
      // Check if file is too large for client processing
      if (file.size > 25 * 1024 * 1024) { // 25MB limit
        return this.createPlaceholderThumbnail(file, maxSize);
      }

      // Check if HEIC conversion is supported
      const isSupported = await HEICConverter.isSupported();
      if (!isSupported) {
        return this.createPlaceholderThumbnail(file, maxSize);
      }

      try {
        // Convert HEIC to JPEG file
        const jpegFile = await HEICConverter.convertToJPEGFile(file, 0.85);

        // Generate thumbnail from the converted JPEG
        const thumbnail = await this.createClientThumbnail(jpegFile, maxSize);
        
        if (thumbnail) {
          thumbnail.source = 'heic_converted';
          return thumbnail;
        } else {
          throw new Error('Failed to create thumbnail from converted JPEG');
        }

      } catch (conversionError) {
        console.error('❌ HEIC conversion failed:', conversionError.message);
        // Creating placeholder thumbnail for HEIC file
        return this.createPlaceholderThumbnail(file, maxSize);
      }

    } catch (error) {
      console.error('❌ HEIC thumbnail creation failed:', error.message);
      return this.createPlaceholderThumbnail(file, maxSize);
    }
  }

  /**
   * Create video thumbnail using Canvas API
   */
  static async createVideoThumbnail(file, maxSize = 300) {
    return new Promise((resolve, reject) => {
      // Validate file
      if (!file || !file.type || !file.type.startsWith('video/')) {
        reject(new Error(`Invalid video file: ${file?.type || 'unknown type'}`));
        return;
      }

      // Check file size (limit to reasonable size for client processing)
      if (file.size > 100 * 1024 * 1024) { // 100MB limit for videos
        reject(new Error(`Video file too large: ${(file.size / 1024 / 1024).toFixed(1)}MB`));
        return;
      }

      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let objectUrl = null;
      let attemptCount = 0;
      const maxAttempts = 3;

      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error(`Video thumbnail timeout after 20 seconds for ${file.name}`));
      }, 20000);

      const tryCapture = (seekTime) => {
        video.onseeked = () => {
          try {
            // Add a small delay to ensure the frame is fully rendered
            setTimeout(() => {
              try {
                
                // Calculate new dimensions while maintaining aspect ratio
                const { width: newWidth, height: newHeight } = this.calculateDimensions(
                  video.videoWidth, 
                  video.videoHeight, 
                  maxSize
                );

                canvas.width = newWidth;
                canvas.height = newHeight;

                // Clear canvas with white background first
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, newWidth, newHeight);

                // Draw video frame to canvas
                ctx.drawImage(video, 0, 0, newWidth, newHeight);

                // Check if the captured frame is mostly black
                const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
                const data = imageData.data;
                let brightPixels = 0;
                const totalPixels = newWidth * newHeight;
                
                // Sample every 10th pixel to check brightness
                for (let i = 0; i < data.length; i += 40) { // 40 = 4 * 10 (RGBA * sample rate)
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];
                  const brightness = (r + g + b) / 3;
                  if (brightness > 30) { // If pixel is not very dark
                    brightPixels++;
                  }
                }

                const brightRatio = brightPixels / (totalPixels / 10);

                // If frame is too dark and we haven't exhausted attempts, try another timestamp
                if (brightRatio < 0.1 && attemptCount < maxAttempts - 1) {
                  attemptCount++;
                  const newSeekTime = Math.min(attemptCount * 2, video.duration * 0.5);
                  tryCapture(newSeekTime);
                  return;
                }

                // Convert to blob
                canvas.toBlob((blob) => {
                  clearTimeout(timeout);
                  
                  // Clean up object URL
                  if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                    objectUrl = null;
                  }

                  if (blob) {
                    resolve({
                      blob,
                      width: newWidth,
                      height: newHeight,
                      mimeType: 'image/jpeg',
                      source: 'video_canvas'
                    });
                  } else {
                    reject(new Error('Failed to create video thumbnail blob'));
                  }
                }, 'image/jpeg', 0.85);
              } catch (error) {
                clearTimeout(timeout);
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                reject(new Error(`Canvas processing failed for video: ${error.message}`));
              }
            }, 100); // 100ms delay to ensure frame is rendered
          } catch (error) {
            clearTimeout(timeout);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            reject(new Error(`Video frame capture failed: ${error.message}`));
          }
        };

        video.currentTime = seekTime;
      };

      video.onloadedmetadata = () => {
        try {
          // Validate video dimensions
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            clearTimeout(timeout);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            reject(new Error(`Invalid video dimensions: ${video.videoWidth}x${video.videoHeight}`));
            return;
          }

          // Validate video duration
          if (!video.duration || video.duration === 0) {
            clearTimeout(timeout);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            reject(new Error('Video has no duration or is corrupted'));
            return;
          }

          // Start with seeking to 1 second or 5% of duration, whichever is smaller
          const initialSeekTime = Math.min(1, video.duration * 0.05);
          tryCapture(initialSeekTime);
        } catch (error) {
          clearTimeout(timeout);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to process video metadata: ' + error.message));
        }
      };

      video.onloadeddata = () => {
        // Video data loaded
      };

      video.onerror = (event) => {
        clearTimeout(timeout);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
        
        // More detailed error information
        const errorDetails = [];
        errorDetails.push(`File: ${file.name}`);
        errorDetails.push(`Type: ${file.type}`);
        errorDetails.push(`Size: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
        
        if (event && event.type) {
          errorDetails.push(`Event: ${event.type}`);
        }
        
        if (video.error) {
          errorDetails.push(`Code: ${video.error.code}`);
          errorDetails.push(`Message: ${video.error.message || 'Unknown error'}`);
        }
        
        reject(new Error(`Failed to load video for thumbnail - ${errorDetails.join(', ')}`));
      };

      try {
        // Set video properties for thumbnail generation
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.crossOrigin = 'anonymous'; // In case of cross-origin videos
        
        // Create object URL and set as source
        objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`Failed to create video object URL: ${error.message}`));
      }
    });
  }

  /**
   * Create a placeholder thumbnail for unsupported formats
   */
  static createPlaceholderThumbnail(file, maxSize) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = maxSize;
      canvas.height = maxSize;

      // Determine if this is a HEIC file
      const isHEIC = this.isHEIC(file);

      // Create gradient background based on file type
      const gradient = ctx.createLinearGradient(0, 0, maxSize, maxSize);
      if (isHEIC) {
        // Special styling for HEIC files
        gradient.addColorStop(0, '#fef3c7'); // Yellow-100
        gradient.addColorStop(1, '#f59e0b'); // Yellow-600
      } else {
        gradient.addColorStop(0, '#f3f4f6'); // Gray-100
        gradient.addColorStop(1, '#e5e7eb'); // Gray-200
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, maxSize, maxSize);

      // Add file type text
      ctx.fillStyle = isHEIC ? '#92400e' : '#6b7280'; // Brown-800 for HEIC, Gray-600 for others
      ctx.font = `bold ${maxSize * 0.15}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const ext = this.getFileExtension(file.name).toUpperCase() || 'FILE';
      ctx.fillText(ext, maxSize / 2, maxSize * 0.35);

      // Add size info for HEIC files
      if (isHEIC) {
        ctx.font = `${maxSize * 0.08}px Arial`;
        const sizeText = `${(file.size / 1024 / 1024).toFixed(1)}MB`;
        ctx.fillText(sizeText, maxSize / 2, maxSize * 0.55);
        
        ctx.font = `${maxSize * 0.07}px Arial`;
        ctx.fillText('Conversion', maxSize / 2, maxSize * 0.7);
        ctx.fillText('Required', maxSize / 2, maxSize * 0.8);
      }

      canvas.toBlob((blob) => {
        resolve({
          blob,
          width: maxSize,
          height: maxSize,
          mimeType: 'image/jpeg',
          source: 'placeholder'
        });
      }, 'image/jpeg', 0.8);
    });
  }

  /**
   * Calculate thumbnail dimensions
   */
  static calculateDimensions(originalWidth, originalHeight, maxSize) {
    const aspectRatio = originalWidth / originalHeight;
    let width, height;

    if (aspectRatio > 1) {
      width = Math.min(maxSize, originalWidth);
      height = Math.round(width / aspectRatio);
    } else {
      height = Math.min(maxSize, originalHeight);
      width = Math.round(height * aspectRatio);
    }

    return { width, height };
  }
}
