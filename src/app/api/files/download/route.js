import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { connectToDatabase } from '../../../../lib/mongodb';
import File from '../../../../models/File';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import r2Client from '../../../../lib/r2Client';

export async function GET(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('Download API: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Download API: Valid session found for user:', session.user.id);

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const userId = session.user.id;

    // Find the file and ensure it belongs to the user
    const file = await File.findOne({ _id: fileId, userId }).lean();
    
    if (!file) {
      console.log('Download API: File not found for fileId:', fileId, 'userId:', userId);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    console.log('Download API: File found successfully:', {
      _id: file._id,
      originalName: file.originalName,
      filePath: file.filePath
    });

    // Get file from R2
    const key = file.filePath.startsWith('/') ? file.filePath.substring(1) : file.filePath;
    
    console.log('Download API: Attempting to fetch from R2:', {
      bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      key: key,
      originalPath: file.filePath
    });
    
    // Check for range request
    const range = request.headers.get('range');
    let command;
    
    if (range) {
      // Parse range header (e.g., "bytes=0-1023")
      const matches = range.match(/^bytes=(\d+)-(\d*)/);
      if (matches) {
        const start = parseInt(matches[1], 10);
        const end = matches[2] ? parseInt(matches[2], 10) : undefined;
        
        command = new GetObjectCommand({
          Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
          Key: key,
          Range: end !== undefined ? `bytes=${start}-${end}` : `bytes=${start}-`,
        });
      } else {
        command = new GetObjectCommand({
          Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
          Key: key,
        });
      }
    } else {
      command = new GetObjectCommand({
        Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
        Key: key,
      });
    }

    try {
      console.log('Download API: Sending R2 command:', {
        command: 'GetObjectCommand',
        bucket: process.env.CLOUDFLARE_BUCKET_NAME,
        key: key
      });
      
      const response = await r2Client.send(command);
      
      // Convert the ReadableStream to a Response stream
      const stream = response.Body;
      
      // Set appropriate headers for download
      const headers = new Headers();
      headers.set('Content-Type', file.mimeType || 'application/octet-stream');
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      
      if (response.ContentLength) {
        headers.set('Content-Length', response.ContentLength.toString());
      }
      
      // Handle range requests
      if (range && response.ContentRange) {
        headers.set('Content-Range', response.ContentRange);
        headers.set('Accept-Ranges', 'bytes');
        return new Response(stream, {
          status: 206, // Partial Content
          headers,
        });
      } else {
        headers.set('Accept-Ranges', 'bytes');
      }
      
      // Add cache headers
      headers.set('Cache-Control', 'private, no-cache');
      
      // Add security headers
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'DENY');
      
      return new Response(stream, {
        status: 200,
        headers,
      });
      
    } catch (r2Error) {
      console.error('Error fetching file from R2:', {
        error: r2Error.message,
        name: r2Error.name,
        code: r2Error.Code,
        bucket: process.env.CLOUDFLARE_BUCKET_NAME,
        key: key,
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT
      });
      
      // If file not found in R2, return 404
      if (r2Error.name === 'NoSuchKey') {
        return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch file from storage',
        details: r2Error.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in download API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
