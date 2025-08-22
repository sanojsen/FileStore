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
    // Determine the createdAt date with a better fallback strategy:
    // 1. EXIF DateTimeOriginal (when photo/video was taken)
    // 2. File system metadata (when file was created/modified)  
    // 3. Current time (upload time) as last resort
    const uploadTime = new Date(); // Store the upload time
    let createdAt = uploadTime; // Default to upload time as last resort
    let dateSource = 'upload'; // Track where the date came from for logging
    // First, check if metadata contains EXIF date information
    if (metadata && metadata.dateTime && metadata.dateTime.taken) {
      try {
        const exifDate = new Date(metadata.dateTime.taken);
        if (!isNaN(exifDate.getTime()) && exifDate.getTime() > 0) {
          createdAt = exifDate;
          dateSource = 'exif';
        }
      } catch (dateError) {
        console.warn('Invalid EXIF date, trying other fallbacks:', dateError);
      }
    }
    // If no EXIF date, try file system metadata (file modification date)
    if (dateSource === 'upload' && metadata && metadata.fileSystemDate) {
      try {
        const fsDate = new Date(metadata.fileSystemDate);
        if (!isNaN(fsDate.getTime()) && fsDate.getTime() > 0) {
          createdAt = fsDate;
          dateSource = 'filesystem';
        }
      } catch (fsError) {
        console.warn('Invalid file system date, using upload time:', fsError);
      }
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