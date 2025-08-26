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
        console.log('� HEIC file detected, starting conversion:', file.name);
        return await this.createHEICThumbnail(file, maxSize);
      }

      // Handle standard image formats with client-side processing
      if (this.canProcessClientSide(file)) {
        console.log('�️ Creating client-side thumbnail for:', file.name);
        return await this.createClientThumbnail(file, maxSize);
      }

      // For other unsupported formats, try client-side anyway as fallback
      console.log('⚠️ Attempting client-side thumbnail for unsupported format:', file.type);
      return await this.createClientThumbnail(file, maxSize);

    } catch (error) {
      console.error('❌ Thumbnail creation failed:', error.message);
      return null;
    }
  }

  /**
   * Create client-side thumbnail using Canvas
   */
  static async createClientThumbnail(file, maxSize) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        try {
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
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Create HEIC thumbnail using robust client-side conversion
   */
  static async createHEICThumbnail(file, maxSize) {
    try {
      console.log('📸 HEIC file detected:', file.name, `(${(file.size / 1024 / 1024).toFixed(1)}MB)`);

      // Check if file is too large for client processing
      if (file.size > 25 * 1024 * 1024) { // 25MB limit
        console.log('📁 File too large for HEIC conversion, creating placeholder');
        return this.createPlaceholderThumbnail(file, maxSize);
      }

      // Check if HEIC conversion is supported
      const isSupported = await HEICConverter.isSupported();
      if (!isSupported) {
        console.log('⚠️ HEIC conversion not supported, creating placeholder');
        return this.createPlaceholderThumbnail(file, maxSize);
      }

      console.log('🔄 Starting HEIC to JPEG conversion...');

      try {
        // Convert HEIC to JPEG file
        const jpegFile = await HEICConverter.convertToJPEGFile(file, 0.85);
        console.log('✅ HEIC converted successfully');

        // Generate thumbnail from the converted JPEG
        const thumbnail = await this.createClientThumbnail(jpegFile, maxSize);
        
        if (thumbnail) {
          thumbnail.source = 'heic_converted';
          console.log('✅ HEIC thumbnail created successfully');
          return thumbnail;
        } else {
          throw new Error('Failed to create thumbnail from converted JPEG');
        }

      } catch (conversionError) {
        console.error('❌ HEIC conversion failed:', conversionError.message);
        console.log('🎨 Creating placeholder thumbnail for HEIC file');
        return this.createPlaceholderThumbnail(file, maxSize);
      }

    } catch (error) {
      console.error('❌ HEIC thumbnail creation failed:', error.message);
      return this.createPlaceholderThumbnail(file, maxSize);
    }
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
