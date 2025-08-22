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
