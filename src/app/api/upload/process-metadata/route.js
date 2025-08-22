import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { FileMetadataExtractor } from '../../../../lib/fileMetadata';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import r2Client from '../../../../lib/r2Client';
import sharp from 'sharp';

export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const thumbnailKey = formData.get('thumbnailKey');
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Sanitize filename for HTTP headers
    const sanitizeForHeader = (str) => {
      if (!str) return '';
      // Remove or replace characters that are not allowed in HTTP headers
      return str.replace(/[^\w\-_.]/g, '_').substring(0, 255);
    };

    const sanitizedFileName = sanitizeForHeader(file.name);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let metadata = {};
    let thumbnailInfo = null;

    // Extract metadata based on file type
    if (file.type.startsWith('image/')) {
      metadata = await FileMetadataExtractor.extractImageMetadata(buffer, file.type);
      
      // Create thumbnail
      if (thumbnailKey) {
        const thumbnail = await FileMetadataExtractor.createThumbnail(buffer, file.type);
        if (thumbnail) {
          // Upload thumbnail to R2
          const thumbnailCommand = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
            Key: thumbnailKey,
            Body: thumbnail.buffer,
            ContentType: thumbnail.mimeType,
            Metadata: {
              'original-file': sanitizedFileName,
              'user-id': session.user.id,
              'type': 'thumbnail',
              'width': thumbnail.width.toString(),
              'height': thumbnail.height.toString()
            }
          });

          await r2Client.send(thumbnailCommand);
          
          thumbnailInfo = {
            width: thumbnail.width,
            height: thumbnail.height,
            size: thumbnail.buffer.length
          };
        }
      }
    } else if (file.type.startsWith('video/')) {
      console.log('Processing video file:', file.name);
      metadata = await FileMetadataExtractor.extractVideoMetadata(buffer, file.type);
      console.log('Video metadata extracted:', metadata);
      
      // Create thumbnail for video
      if (thumbnailKey) {
        console.log('Creating video thumbnail for key:', thumbnailKey);
        const thumbnail = await FileMetadataExtractor.createThumbnail(buffer, file.type);
        console.log('Video thumbnail result:', thumbnail ? 'Success' : 'Failed');
        
        if (thumbnail) {
          console.log('Uploading video thumbnail to R2');
          
          // Get thumbnail dimensions using Sharp
          const thumbnailMetadata = await sharp(thumbnail.buffer).metadata();
          
          // Upload thumbnail to R2
          const thumbnailCommand = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
            Key: thumbnailKey,
            Body: thumbnail.buffer,
            ContentType: thumbnail.mimeType,
            Metadata: {
              'original-file': sanitizedFileName,
              'user-id': session.user.id,
              'type': 'video-thumbnail',
              'width': (thumbnailMetadata.width || 300).toString(),
              'height': (thumbnailMetadata.height || 169).toString()
            }
          });

          await r2Client.send(thumbnailCommand);
          console.log('Video thumbnail uploaded successfully');
          
          thumbnailInfo = {
            width: thumbnailMetadata.width || 300,
            height: thumbnailMetadata.height || 169,
            size: thumbnail.buffer.length
          };
        } else {
          console.log('Video thumbnail creation failed, continuing without thumbnail');
        }
      }
    }

    return NextResponse.json({
      success: true,
      metadata,
      thumbnail: thumbnailInfo
    });

  } catch (error) {
    console.error('Error processing file metadata:', error);
    return NextResponse.json(
      { error: 'Failed to process file metadata' },
      { status: 500 }
    );
  }
}
