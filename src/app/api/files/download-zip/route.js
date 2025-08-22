import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { connectToDatabase } from '../../../../lib/mongodb';
import File from '../../../../models/File';
import JSZip from 'jszip';
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { fileIds } = await request.json();
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'No files specified' }, { status: 400 });
    }
    // Connect to database
    await connectToDatabase();
    // Get file documents from database
    const files = await File.find({
      _id: { $in: fileIds },
      userId: session.user.id
    });
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files found' }, { status: 404 });
    }
    // Create ZIP file
    const zip = new JSZip();
    const baseUrl = process.env.CLOUDFLARE_PUBLIC_URL || 'https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev';
    // Download each file and add to ZIP
    for (const file of files) {
      try {
        const fileUrl = `${baseUrl}${file.filePath}`;
        const response = await fetch(fileUrl);
        if (response.ok) {
          const fileBuffer = await response.arrayBuffer();
          zip.file(file.originalName, fileBuffer);
        } else {
          console.warn(`Failed to download file: ${file.originalName}`);
          // Add a text file indicating the error
          zip.file(`ERROR_${file.originalName}.txt`, `Failed to download: ${file.originalName}\nReason: HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`Error downloading file ${file.originalName}:`, error);
        // Add a text file indicating the error
        zip.file(`ERROR_${file.originalName}.txt`, `Failed to download: ${file.originalName}\nReason: ${error.message}`);
      }
    }
    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="files-${new Date().toISOString().slice(0, 10)}.zip"`,
        'Content-Length': zipBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error creating ZIP:', error);
    return NextResponse.json(
      { error: 'Failed to create ZIP file' },
      { status: 500 }
    );
  }
}