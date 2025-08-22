import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import r2Client from '../../../lib/r2';
import File from '../../../models/File';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const session = await getServerSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const isPublic = formData.get('isPublic') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 100MB limit' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const key = `uploads/${session.user.id}/${uniqueFilename}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudflare R2
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ContentLength: file.size,
    });

    await r2Client.send(uploadCommand);

    // Generate public URL
    const publicUrl = `${process.env.CLOUDFLARE_PUBLIC_URL}/${key}`;

    // Save file metadata to MongoDB
    const fileData = {
      filename: uniqueFilename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      key: key,
      url: publicUrl,
      userId: session.user.id,
      isPublic: isPublic
    };

    const savedFile = await File.create(fileData);

    return NextResponse.json(
      {
        message: 'File uploaded successfully',
        file: {
          id: savedFile._id,
          filename: savedFile.filename,
          originalName: savedFile.originalName,
          size: savedFile.size,
          mimeType: savedFile.mimeType,
          url: savedFile.url,
          uploadedAt: savedFile.uploadedAt
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;

    const files = await File.findByUserId(session.user.id, limit, offset);
    const stats = await File.getStats(session.user.id);

    return NextResponse.json({
      files,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: files.length === limit
      }
    });

  } catch (error) {
    console.error('Fetch files error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
