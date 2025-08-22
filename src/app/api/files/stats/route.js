import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { connectToDatabase } from '../../../../lib/mongodb';
import File from '../../../../models/File';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get file statistics
    const totalFiles = await File.countDocuments({ userId: session.user.id });
    
    // Get total size
    const sizeResult = await File.aggregate([
      { $match: { userId: session.user.id } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } }
    ]);
    
    const totalSize = sizeResult[0]?.totalSize || 0;

    // Get last upload
    const lastFile = await File.findOne(
      { userId: session.user.id },
      {},
      { sort: { uploadedAt: -1 } }
    );

    const stats = {
      totalFiles,
      totalSize,
      lastUpload: lastFile?.uploadedAt || null
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching file stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
