import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { connectToDatabase } from '../../../lib/mongodb';
import File from '../../../models/File';
import { deleteFromR2 } from '../../../lib/r2';
export async function GET(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const sortBy = searchParams.get('sortBy') || 'uploadDate';
    const fileType = searchParams.get('type'); // Filter by file type
    const offset = (page - 1) * limit;
    const userId = session.user.id;
    // Build sort criteria
    let sortCriteria = {};
    if (sortBy === 'uploadDate') {
      sortCriteria = { uploadedAt: -1 };
    } else if (sortBy === 'createdDate') {
      sortCriteria = { createdAt: -1, uploadedAt: -1 };
    } else if (sortBy === 'createdAt') {
      sortCriteria = { createdAt: -1, uploadedAt: -1 };
    } else {
      sortCriteria = { uploadedAt: -1 };
    }
    // Build filter criteria
    let filterCriteria = { userId };
    if (fileType) {
      filterCriteria.fileType = fileType;
    }
    // Get files with pagination
    const files = await File.find(filterCriteria)
      .sort(sortCriteria)
      .skip(offset)
      .limit(limit + 1) // Get one extra to check if there are more
      .lean();
    const hasMore = files.length > limit;
    if (hasMore) {
      files.pop(); // Remove the extra file
    }
    return NextResponse.json({
      success: true,
      files,
      hasMore,
      pagination: {
        page,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
export async function DELETE(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }
    const userId = session.user.id;
    // Find the file to ensure it belongs to the user
    const file = await File.findOne({ _id: fileId, userId });
    if (!file) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 });
    }
    // Delete from R2 storage
    try {
      if (file.filePath) {
        await deleteFromR2(file.filePath);
      }
      if (file.thumbnailPath) {
        await deleteFromR2(file.thumbnailPath);
      }
    } catch (storageError) {
      console.error('Error deleting from R2:', storageError);
      // Continue with database deletion even if storage deletion fails
    }
    // Delete from database
    await File.deleteOne({ _id: fileId, userId });
    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}