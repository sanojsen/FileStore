import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import exifr from 'exifr';
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
    // Only extract EXIF metadata - no heavy processing
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
              taken: exifData.DateTimeOriginal || exifData.DateTime,
              digitized: exifData.DateTimeDigitized
            }
          };
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