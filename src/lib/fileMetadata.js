import sharp from 'sharp';
import exifr from 'exifr';

export class FileMetadataExtractor {
  // Helper function to convert GPS coordinates from DMS to decimal degrees
  static convertGpsToDecimal(gpsArray, gpsRef) {
    if (!Array.isArray(gpsArray) || gpsArray.length < 3) {
      return null;
    }
    const [degrees, minutes, seconds] = gpsArray;
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    // Apply direction reference (S and W are negative)
    if (gpsRef === 'S' || gpsRef === 'W') {
      decimal = -decimal;
    }
    return decimal;
  }
  static async extractImageMetadata(buffer, mimeType) {
    try {
      const metadata = {};
      // Get basic image information using Sharp
      const imageInfo = await sharp(buffer).metadata();
      metadata.dimensions = {
        width: imageInfo.width,
        height: imageInfo.height,
        aspectRatio: imageInfo.width / imageInfo.height
      };
      metadata.colorSpace = imageInfo.space;
      metadata.hasAlpha = imageInfo.hasAlpha;
      metadata.density = imageInfo.density;
      // Extract EXIF data
      try {
        const exifData = await exifr.parse(buffer);
        if (exifData) {
          metadata.camera = {
            make: exifData.Make,
            model: exifData.Model,
            software: exifData.Software
          };
          metadata.settings = {
            iso: exifData.ISO,
            fNumber: exifData.FNumber,
            exposureTime: exifData.ExposureTime,
            focalLength: exifData.FocalLength,
            flash: exifData.Flash
          };
          metadata.dateTime = {
            taken: exifData.DateTimeOriginal || exifData.DateTime,
            digitized: exifData.DateTimeDigitized
          };
          if (exifData.GPSLatitude && exifData.GPSLongitude) {
            // Convert GPS coordinates from degrees, minutes, seconds to decimal degrees
            const latitude = this.convertGpsToDecimal(exifData.GPSLatitude, exifData.GPSLatitudeRef);
            const longitude = this.convertGpsToDecimal(exifData.GPSLongitude, exifData.GPSLongitudeRef);
            if (latitude !== null && longitude !== null) {
              metadata.location = {
                latitude: latitude,
                longitude: longitude,
                altitude: exifData.GPSAltitude
              };
            }
          }
        }
      } catch (exifError) {
      }
      return metadata;
    } catch (error) {
      console.error('Error extracting image metadata:', error);
      return {};
    }
  }
  static async extractVideoMetadata(buffer, mimeType) {
    try {
      // Basic video metadata (detailed extraction moved to client-side)
      const metadata = {
        type: 'video',
        mimeType: mimeType,
        size: buffer.length
      };
      
      return metadata;
    } catch (error) {
      console.error('Error extracting video metadata:', error);
      return {
        type: 'video',
        mimeType: mimeType
      };
    }
  }
  static async createThumbnail(buffer, mimeType, maxSize = 300) {
    try {
      if (mimeType.startsWith('image/')) {
        return await this.createImageThumbnail(buffer, maxSize);
      } else if (mimeType.startsWith('video/')) {
        return await this.createVideoThumbnail(buffer, maxSize);
      }
      return null;
    } catch (error) {
      console.error('FileMetadataExtractor: Error creating thumbnail:', error);
      return null;
    }
  }
  static async createImageThumbnail(buffer, maxSize = 300) {
    try {
      const originalMeta = await sharp(buffer).metadata();
      // Handle rotation from EXIF data
      let processedBuffer = buffer;
      try {
        // Auto-rotate based on EXIF orientation
        processedBuffer = await sharp(buffer)
          .rotate() // This automatically rotates based on EXIF orientation
          .toBuffer();
        // Get metadata after rotation
        const rotatedMeta = await sharp(processedBuffer).metadata();
        originalMeta.width = rotatedMeta.width;
        originalMeta.height = rotatedMeta.height;
      } catch (rotationError) {
        processedBuffer = buffer;
      }
      const aspectRatio = originalMeta.width / originalMeta.height;
      let width, height;
      if (aspectRatio > 1) {
        // Landscape: limit by width
        width = Math.min(maxSize, originalMeta.width);
        height = Math.round(width / aspectRatio);
      } else {
        // Portrait or square: limit by height
        height = Math.min(maxSize, originalMeta.height);
        width = Math.round(height * aspectRatio);
      }
      const thumbnailBuffer = await sharp(processedBuffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3 // Better quality scaling
        })
        .jpeg({ 
          quality: 90, // Higher quality
          progressive: true,
          mozjpeg: true // Better compression algorithm
        })
        .toBuffer();
      return {
        buffer: thumbnailBuffer,
        width,
        height,
        mimeType: 'image/jpeg'
      };
    } catch (error) {
      console.error('Error creating image thumbnail:', error);
      return null;
    }
  }
  static async createVideoThumbnail(buffer, maxSize = 300) {
    try {
      // Video thumbnail generation moved to client-side
      // This server-side method is deprecated
      console.warn('Server-side video thumbnail generation is deprecated. Use client-side generation.');
      return null;
    } catch (error) {
      console.error('FileMetadataExtractor: Error creating video thumbnail:', error);
      return null;
    }
  }
  
  static async createVideoThumbnailSimple(buffer, maxSize = 300) {
    try {
      // This method is now deprecated - thumbnails handled client-side
      console.warn('Server-side video thumbnail generation is deprecated. Use client-side generation.');
      return null;
    } catch (error) {
      console.error('Error creating simple video thumbnail:', error);
      return null;
    }
  }
  static getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('text') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive';
    return 'other';
  }
}
