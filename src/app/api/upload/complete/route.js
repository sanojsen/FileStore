import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { connectToDatabase } from '../../../../lib/mongodb';
import File from '../../../../models/File';
export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectToDatabase();
    const {
      originalName,
      fileName,
      fileSize,
      mimeType,
      filePath,
      thumbnailPath,
      isPublic = false,
      metadata = {},
      tags = [],
      description = ''
    } = await request.json();
    // Validation
    if (!originalName || !fileName || !fileSize || !mimeType || !filePath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    // Enhanced date determination strategy for different file types:
    // 1. EXIF DateTimeOriginal (photos/videos - when content was captured)  
    // 2. File content metadata (PDF creation date, Office document properties, etc.)
    // 3. File system metadata (when file was created/modified on device)
    // 4. Current time (upload time) as last resort
    const uploadTime = new Date(); // Store the upload time
    let createdAt = uploadTime; // Default to upload time as last resort
    let dateSource = 'upload'; // Track where the date came from for logging
    // First, check if metadata contains date information (EXIF or file content)
    if (metadata && metadata.dateTime && metadata.dateTime.taken) {
      try {
        const exifDate = new Date(metadata.dateTime.taken);
        if (!isNaN(exifDate.getTime()) && exifDate.getTime() > 0) {
          createdAt = exifDate;
          dateSource = mimeType.startsWith('image/') ? 'exif-photo' : 
                      mimeType.startsWith('video/') ? 'exif-video' : 'content-metadata';
          console.log(`📅 Using ${dateSource} date for ${originalName}: ${exifDate.toISOString()}`);
        }
      } catch (dateError) {
        console.warn('Invalid content date, trying file system date:', dateError);
      }
    }
    // If no EXIF date, try file system metadata (file modification date)
    if (dateSource === 'upload' && metadata && metadata.fileSystemDate) {
      try {
        const fsDate = new Date(metadata.fileSystemDate);
        if (!isNaN(fsDate.getTime()) && fsDate.getTime() > 0) {
          createdAt = fsDate;
          dateSource = 'filesystem';
          console.log(`📁 Using file system date for ${originalName}: ${fsDate.toISOString()}`);
        }
      } catch (fsError) {
        console.warn('Invalid file system date, using upload time:', fsError);
      }
    }

    // Log final result for upload time fallback
    if (dateSource === 'upload') {
      console.log(`⏰ Using upload time for ${originalName}: ${uploadTime.toISOString()}`);
    }

    // Create file document
    const file = new File({
      userId: session.user.id,
      originalName,
      fileName,
      size: fileSize, // Note: using 'size' instead of 'fileSize'
      mimeType,
      fileType: File.getFileType(mimeType),
      filePath, // Store only the path, not full URL
      thumbnailPath,
      isPublic,
      createdAt: createdAt,
      metadata: {
        uploadMethod: 'direct-r2',
        dateSource: dateSource, // Store where the createdAt date came from
        tags,
        description,
        ...metadata // Include extracted metadata (EXIF, dimensions, etc.)
      }
    });
    const savedFile = await file.save();
    return NextResponse.json({
      success: true,
      file: {
        id: savedFile._id,
        originalName: savedFile.originalName,
        fileName: savedFile.fileName,
        size: savedFile.size,
        mimeType: savedFile.mimeType,
        fileType: savedFile.fileType,
        filePath: savedFile.filePath,
        thumbnailPath: savedFile.thumbnailPath,
        isPublic: savedFile.isPublic,
        uploadedAt: savedFile.uploadedAt,
        createdAt: savedFile.createdAt,
        metadata: savedFile.metadata
      }
    });
  } catch (error) {
    console.error('Error saving file metadata:', error);
    return NextResponse.json(
      { error: 'Failed to save file metadata' },
      { status: 500 }
    );
  }
}
