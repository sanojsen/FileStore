/**
 * Client-side thumbnail generator using Canvas API
 * Works in the browser without server-side processing
 */
export class ClientThumbnailGenerator {
  static async createImageThumbnail(file, maxSize = 300) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          const { width: newWidth, height: newHeight } = this.calculateDimensions(
            img.width, 
            img.height, 
            maxSize
          );
          canvas.width = newWidth;
          canvas.height = newHeight;
          // Draw and resize image
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          // Convert to blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve({
                blob,
                width: newWidth,
                height: newHeight,
                mimeType: 'image/jpeg'
              });
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          }, 'image/jpeg', 0.8);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      // Create object URL for the file
      img.src = URL.createObjectURL(file);
    });
  }
  static async createVideoThumbnail(file, maxSize = 300) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      video.onloadedmetadata = () => {
        try {
          // Seek to 1 second into the video (or 10% of duration)
          const seekTime = Math.min(1, video.duration * 0.1);
          video.currentTime = seekTime;
        } catch (error) {
          reject(new Error('Failed to seek video: ' + error.message));
        }
      };
      video.onseeked = () => {
        try {
          // Calculate new dimensions
          const { width: newWidth, height: newHeight } = this.calculateDimensions(
            video.videoWidth, 
            video.videoHeight, 
            maxSize
          );
          canvas.width = newWidth;
          canvas.height = newHeight;
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, newWidth, newHeight);
          // Convert to blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve({
                blob,
                width: newWidth,
                height: newHeight,
                mimeType: 'image/jpeg'
              });
            } else {
              reject(new Error('Failed to create video thumbnail blob'));
            }
            // Clean up
            URL.revokeObjectURL(video.src);
          }, 'image/jpeg', 0.8);
        } catch (error) {
          reject(error);
          URL.revokeObjectURL(video.src);
        }
      };
      video.onerror = () => {
        reject(new Error('Failed to load video'));
        URL.revokeObjectURL(video.src);
      };
      // Set video properties for thumbnail generation
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
    });
  }
  static calculateDimensions(originalWidth, originalHeight, maxSize) {
    const aspectRatio = originalWidth / originalHeight;
    let width, height;
    if (aspectRatio > 1) {
      // Landscape: limit by width
      width = Math.min(maxSize, originalWidth);
      height = Math.round(width / aspectRatio);
    } else {
      // Portrait or square: limit by height  
      height = Math.min(maxSize, originalHeight);
      width = Math.round(height * aspectRatio);
    }
    return { width, height };
  }
  static async createThumbnail(file, maxSize = 300) {
    try {
      if (file.type.startsWith('image/')) {
        return await this.createImageThumbnail(file, maxSize);
      } else if (file.type.startsWith('video/')) {
        return await this.createVideoThumbnail(file, maxSize);
      } else {
        throw new Error('Unsupported file type for thumbnail generation');
      }
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return null;
    }
  }
}