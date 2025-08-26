import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import exifr from 'exifr';

// Helper function to extract creation date from various file types
async function extractCreationDate(buffer, mimeType, fileName) {
  let creationDate = null;
  
  try {
    // PDF files - check for creation date in PDF metadata
    if (mimeType === 'application/pdf') {
      // Look for PDF creation date in header
      const pdfText = buffer.toString('binary', 0, Math.min(buffer.length, 2048));
      
      // Match PDF creation date patterns
      const creationDateMatch = pdfText.match(/\/CreationDate\s*\(D:(\d{14})/);
      if (creationDateMatch) {
        const dateStr = creationDateMatch[1];
        // Format: YYYYMMDDHHMMSS
        const year = parseInt(dateStr.substr(0, 4));
        const month = parseInt(dateStr.substr(4, 2)) - 1; // Month is 0-indexed
        const day = parseInt(dateStr.substr(6, 2));
        const hour = parseInt(dateStr.substr(8, 2));
        const minute = parseInt(dateStr.substr(10, 2));
        const second = parseInt(dateStr.substr(12, 2));
        
        creationDate = new Date(year, month, day, hour, minute, second);
      }
    }
    
    // Microsoft Office documents
    else if (mimeType.includes('officedocument') || mimeType.includes('ms-office')) {
      // Try to extract from Office document properties
      const docText = buffer.toString('binary', 0, Math.min(buffer.length, 4096));
      
      // Look for creation time in Office document metadata
      const patterns = [
        /<dcterms:created[^>]*>([^<]+)</i,
        /<meta name="created"[^>]*content="([^"]+)"/i,
        /<o:Created>([^<]+)<\/o:Created>/i
      ];
      
      for (const pattern of patterns) {
        const match = docText.match(pattern);
        if (match) {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            creationDate = date;
            break;
          }
        }
      }
    }
    
    // Archive files - check for oldest file in archive (simplified)
    else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) {
      // For ZIP files, try to read the file header for timestamps
      if (mimeType.includes('zip')) {
        // ZIP file structure: Look for local file header signatures
        const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
        let offset = buffer.indexOf(zipSignature);
        
        if (offset !== -1) {
          // Read timestamp from first file entry (offset + 10 for last mod time)
          if (buffer.length > offset + 10) {
            const dosTime = buffer.readUInt16LE(offset + 10);
            const dosDate = buffer.readUInt16LE(offset + 12);
            
            // Convert DOS date/time to JavaScript Date
            const year = ((dosDate >> 9) & 0x7F) + 1980;
            const month = ((dosDate >> 5) & 0x0F) - 1;
            const day = dosDate & 0x1F;
            const hour = (dosTime >> 11) & 0x1F;
            const minute = (dosTime >> 5) & 0x3F;
            const second = (dosTime & 0x1F) * 2;
            
            if (year >= 1980 && month >= 0 && month < 12 && day >= 1 && day <= 31) {
              creationDate = new Date(year, month, day, hour, minute, second);
            }
          }
        }
      }
    }
    
    // Text files and source code - use embedded timestamps if available
    else if (mimeType.startsWith('text/') || mimeType.includes('javascript') || 
             mimeType.includes('json') || mimeType.includes('xml')) {
      const textContent = buffer.toString('utf-8', 0, Math.min(buffer.length, 2048));
      
      // Look for common timestamp patterns in comments or headers
      const timestampPatterns = [
        /Created?:?\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
        /Date:?\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
        /Generated:?\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
        /\*\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,
        /@created\s+(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
        /"created":\s*"([^"]+)"/i
      ];
      
      for (const pattern of timestampPatterns) {
        const match = textContent.match(pattern);
        if (match) {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            creationDate = date;
            break;
          }
        }
      }
    }
    
  } catch (error) {
    console.warn(`Error extracting creation date for ${fileName}:`, error);
  }
  
  return creationDate;
}
export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let metadata = {};
    
    // Try to extract creation date from file content (for all file types)
    const extractedCreationDate = await extractCreationDate(buffer, file.type, file.name);
    if (extractedCreationDate) {
      metadata.dateTime = {
        taken: extractedCreationDate.toISOString()
      };
    }

    // Extract EXIF metadata for images
    if (file.type.startsWith('image/')) {
      try {
        const exifData = await exifr.parse(buffer);
        if (exifData) {
          // Helper function to convert GPS coordinates
          const convertGpsToDecimal = (gpsArray, gpsRef) => {
            if (!Array.isArray(gpsArray) || gpsArray.length < 3) return null;
            const [degrees, minutes, seconds] = gpsArray;
            let decimal = degrees + (minutes / 60) + (seconds / 3600);
            if (gpsRef === 'S' || gpsRef === 'W') decimal = -decimal;
            return decimal;
          };
          metadata = {
            ...metadata, // Preserve any existing metadata from file content extraction
            camera: {
              make: exifData.Make,
              model: exifData.Model,
              software: exifData.Software
            },
            settings: {
              iso: exifData.ISO,
              fNumber: exifData.FNumber,
              exposureTime: exifData.ExposureTime,
              focalLength: exifData.FocalLength,
              flash: exifData.Flash
            },
            dateTime: {
              // Prioritize EXIF dates over file content extraction
              taken: exifData.DateTimeOriginal || exifData.DateTime || exifData.CreateDate || 
                     (metadata.dateTime ? metadata.dateTime.taken : null),
              digitized: exifData.DateTimeDigitized
            }
          };

          // Add dimensions if available
          if (exifData.ImageWidth && exifData.ImageHeight) {
            metadata.dimensions = {
              width: exifData.ImageWidth,
              height: exifData.ImageHeight
            };
          }
          // GPS location if available
          if (exifData.GPSLatitude && exifData.GPSLongitude) {
            const latitude = convertGpsToDecimal(exifData.GPSLatitude, exifData.GPSLatitudeRef);
            const longitude = convertGpsToDecimal(exifData.GPSLongitude, exifData.GPSLongitudeRef);
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
        console.warn('Error extracting EXIF data:', exifError);
      }
    }

    // Extract metadata from video files
    if (file.type.startsWith('video/')) {
      try {
        // Try to extract basic video metadata using exifr (works for some video formats)
        const videoExif = await exifr.parse(buffer, {
          // Enable more comprehensive parsing for videos
          multiSegment: true,
          mergeOutput: true,
          translateKeys: true,
          translateValues: true,
          reviveValues: true,
          sanitize: true,
          // Include QuickTime and other video-specific tags
          pick: [
            'CreationDate', 'CreateDate', 'DateTimeOriginal', 'MediaCreateDate',
            'TrackCreateDate', 'MediaModifyDate', 'TrackModifyDate',
            'Duration', 'ImageWidth', 'ImageHeight', 'VideoFrameRate',
            'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef',
            'GPSAltitude', 'GPSDateTime', 'GPSDateStamp', 'GPSTimeStamp',
            // iOS/Apple specific
            'com.apple.quicktime.creationdate',
            'com.apple.quicktime.location.date',
            'com.apple.quicktime.location.accuracy.horizontal',
            'com.apple.quicktime.make',
            'com.apple.quicktime.model',
            'com.apple.quicktime.software',
            // Android/Google specific
            'com.google.photos.people.rating',
            'com.google.photos.image.cta',
            // General video metadata
            'VideoCodec', 'AudioCodec', 'Bitrate', 'FrameRate',
            'Make', 'Model', 'Software'
          ]
        });
        
        if (videoExif) {
          metadata = {
            ...metadata, // Preserve any existing metadata from file content extraction
            dateTime: {
              // Try multiple video creation date fields in order of preference
              taken: videoExif['com.apple.quicktime.creationdate'] || // iOS videos first
                     videoExif.CreationDate || 
                     videoExif.DateTimeOriginal || 
                     videoExif.CreateDate || 
                     videoExif.MediaCreateDate ||
                     videoExif.TrackCreateDate ||
                     videoExif['com.apple.quicktime.location.date'] || // iOS location date
                     (metadata.dateTime ? metadata.dateTime.taken : null)
            }
          };

          // Add video-specific metadata
          if (videoExif.ImageWidth && videoExif.ImageHeight) {
            metadata.dimensions = {
              width: videoExif.ImageWidth,
              height: videoExif.ImageHeight
            };
          }

          // Duration
          if (videoExif.Duration) {
            metadata.duration = videoExif.Duration;
          }

          // Frame rate
          if (videoExif.VideoFrameRate || videoExif.FrameRate) {
            metadata.frameRate = videoExif.VideoFrameRate || videoExif.FrameRate;
          }

          // Device information
          if (videoExif.Make || videoExif.Model || videoExif.Software ||
              videoExif['com.apple.quicktime.make'] || 
              videoExif['com.apple.quicktime.model'] ||
              videoExif['com.apple.quicktime.software']) {
            metadata.device = {
              make: videoExif.Make || videoExif['com.apple.quicktime.make'],
              model: videoExif.Model || videoExif['com.apple.quicktime.model'],
              software: videoExif.Software || videoExif['com.apple.quicktime.software']
            };
          }

          // GPS location for videos (especially mobile videos)
          if (videoExif.GPSLatitude && videoExif.GPSLongitude) {
            const convertGpsToDecimal = (gpsArray, gpsRef) => {
              if (!Array.isArray(gpsArray) || gpsArray.length < 3) return null;
              const [degrees, minutes, seconds] = gpsArray;
              let decimal = degrees + (minutes / 60) + (seconds / 3600);
              if (gpsRef === 'S' || gpsRef === 'W') decimal = -decimal;
              return decimal;
            };

            const latitude = convertGpsToDecimal(videoExif.GPSLatitude, videoExif.GPSLatitudeRef);
            const longitude = convertGpsToDecimal(videoExif.GPSLongitude, videoExif.GPSLongitudeRef);
            if (latitude !== null && longitude !== null) {
              metadata.location = {
                latitude: latitude,
                longitude: longitude,
                altitude: videoExif.GPSAltitude,
                timestamp: videoExif.GPSDateTime || videoExif.GPSDateStamp
              };
            }
          }

          console.log('Extracted video metadata fields:', Object.keys(videoExif));
        }
      } catch (videoError) {
        console.warn('Error extracting video metadata:', videoError);
      }
    }
    return NextResponse.json({
      success: true,
      metadata
    });
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return NextResponse.json(
      { error: 'Failed to extract metadata' },
      { status: 500 }
    );
  }
}
