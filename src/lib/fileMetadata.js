import sharp from 'sharp';
import exifr from 'exifr';
import { VideoProcessor } from './videoProcessor.js';

export class FileMetadataExtractor {
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
            metadata.location = {
              latitude: exifData.GPSLatitude,
              longitude: exifData.GPSLongitude,
              altitude: exifData.GPSAltitude
            };
          }
        }
      } catch (exifError) {
        console.log('No EXIF data found or error reading EXIF:', exifError.message);
      }

      return metadata;
    } catch (error) {
      console.error('Error extracting image metadata:', error);
      return {};
    }
  }

  static async extractVideoMetadata(buffer, mimeType) {
    try {
      // Use the VideoProcessor to extract detailed metadata
      const videoMetadata = await VideoProcessor.getVideoMetadata(buffer);
      
      const metadata = {
        type: 'video',
        mimeType: mimeType,
        ...videoMetadata
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
    console.log('FileMetadataExtractor: Creating thumbnail for type:', mimeType);
    try {
      if (mimeType.startsWith('image/')) {
        console.log('FileMetadataExtractor: Processing image thumbnail');
        return await this.createImageThumbnail(buffer, maxSize);
      } else if (mimeType.startsWith('video/')) {
        console.log('FileMetadataExtractor: Processing video thumbnail');
        return await this.createVideoThumbnail(buffer, maxSize);
      }
      
      console.log('FileMetadataExtractor: Unsupported file type for thumbnail');
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
        console.log('No rotation needed or error rotating:', rotationError.message);
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
    console.log('FileMetadataExtractor: Starting video thumbnail creation');
    try {
      // Use the server-side VideoProcessor for more reliable thumbnail generation
      const result = await VideoProcessor.createVideoThumbnail(buffer, maxSize);
      console.log('FileMetadataExtractor: VideoProcessor result:', result ? 'Success' : 'Failed');
      return result;
    } catch (error) {
      console.error('FileMetadataExtractor: Error creating video thumbnail:', error);
      return null;
    }
  }

  static async createVideoThumbnailSimple(buffer, maxSize = 300) {
    try {
      // This method is now deprecated in favor of VideoProcessor
      console.log('Using VideoProcessor for video thumbnails');
      return await this.createVideoThumbnail(buffer, maxSize);
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
