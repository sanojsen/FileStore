import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import r2Client from '../../../../lib/r2Client';
import { v4 as uuidv4 } from 'uuid';
export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { files } = await request.json();
    // Validation
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided or invalid format' },
        { status: 400 }
      );
    }
    // File size limit (1GB per file to support large video files)
    const maxSize = 1024 * 1024 * 1024; // 1GB
    const userId = session.user.id;
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const uploadData = [];
    for (const file of files) {
      const { fileName, fileSize, mimeType } = file;
      // Validation for each file
      if (!fileName || !fileSize || !mimeType) {
        return NextResponse.json(
          { error: 'Missing required fields: fileName, fileSize, mimeType for one or more files' },
          { status: 400 }
        );
      }
      if (fileSize > maxSize) {
        return NextResponse.json(
          { error: `File "${fileName}" exceeds 1GB limit` },
          { status: 400 }
        );
      }
      // Generate unique file name to avoid conflicts
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      // Create the file path in R2
      const filePath = `/uploads/${userId}/${year}/${month}/${day}/${uniqueFileName}`;
      const key = filePath.substring(1); // Remove leading slash for S3 key
      // Create thumbnail path for images/videos
      const thumbnailPath = `/uploads/${userId}/${year}/${month}/${day}/thumbnails/${uniqueFileName.replace(/\.[^/.]+$/, '_thumb.jpg')}`;
      const thumbnailKey = thumbnailPath.substring(1);
      // Generate presigned URL for main file
      const command = new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
        Key: key,
        ContentType: mimeType,
        Metadata: {
          'original-name': fileName,
          'user-id': userId,
          'upload-timestamp': date.toISOString(),
          'file-size': fileSize.toString()
        }
      });
      const presignedUrl = await getSignedUrl(r2Client, command, { 
        expiresIn: 3600 // 1 hour
      });
      // Generate presigned URL for thumbnail (for images/videos)
      let thumbnailPresignedUrl = null;
      if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
        const thumbnailCommand = new PutObjectCommand({
          Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
          Key: thumbnailKey,
          ContentType: 'image/jpeg',
          Metadata: {
            'original-file': uniqueFileName,
            'user-id': userId,
            'type': 'thumbnail'
          }
        });
        thumbnailPresignedUrl = await getSignedUrl(r2Client, thumbnailCommand, { 
          expiresIn: 3600 
        });
      }
      uploadData.push({
        originalName: fileName,
        fileName: uniqueFileName,
        filePath,
        thumbnailPath: mimeType.startsWith('image/') || mimeType.startsWith('video/') ? thumbnailPath : null,
        presignedUrl,
        thumbnailPresignedUrl,
        key,
        thumbnailKey: mimeType.startsWith('image/') || mimeType.startsWith('video/') ? thumbnailKey : null
      });
    }
    return NextResponse.json({
      success: true,
      uploads: uploadData
    });
  } catch (error) {
    console.error('Error generating presigned URLs:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URLs' },
      { status: 500 }
    );
  }
}