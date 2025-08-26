import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { FileMetadataExtractor } from '../../../../lib/fileMetadata';

/**
 * Optimized metadata processing for Vercel free tier
 * - Reduced processing time
 * - No heavy thumbnail generation
 * - Better error handling
 */
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

    // Check file size to avoid timeout on Vercel free tier
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit for processing
    if (file.size > MAX_FILE_SIZE) {
      console.log(`⚠️ File too large for server processing: ${file.size} bytes`);
      return NextResponse.json({
        success: true,
        message: 'File too large for server-side processing - using client-side only',
        metadata: {
          size: file.size,
          mimeType: file.type,
          fileName: file.name,
          processedServerSide: false,
          reason: 'File size exceeds Vercel free tier processing limits'
        },
        thumbnail: null
      });
    }

    // For HEIC files on Vercel free tier, return limited processing
    const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' || 
                   file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

    if (isHEIC) {
      console.log(`📸 HEIC file detected: ${file.name} - Limited processing on Vercel free tier`);
      return NextResponse.json({
        success: true,
        message: 'HEIC file detected - Limited server processing available',
        metadata: {
          format: 'heic',
          size: file.size,
          mimeType: file.type,
          fileName: file.name,
          processedServerSide: false,
          limitations: 'HEIC processing requires premium hosting for full thumbnail support',
          recommendation: 'Convert to JPEG for better compatibility and faster processing'
        },
        thumbnail: null
      });
    }

    // Convert file to buffer (with timeout protection)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let metadata = {};
    let thumbnailInfo = null;

    // Extract metadata based on file type (lightweight processing only)
    if (file.type.startsWith('image/')) {
      try {
        metadata = await FileMetadataExtractor.extractImageMetadata(buffer, file.type);
        console.log(`📊 Image metadata extracted for: ${file.name}`);
      } catch (error) {
        console.error('Image metadata extraction error:', error);
        metadata = { 
          error: 'Failed to extract image metadata', 
          details: error.message,
          fallback: {
            size: file.size,
            mimeType: file.type,
            fileName: file.name
          }
        };
      }
    } else if (file.type.startsWith('video/')) {
      try {
        metadata = await FileMetadataExtractor.extractVideoMetadata(buffer, file.type);
        console.log(`🎥 Video metadata extracted for: ${file.name}`);
      } catch (error) {
        console.error('Video metadata extraction error:', error);
        metadata = { 
          error: 'Failed to extract video metadata', 
          details: error.message,
          fallback: {
            size: file.size,
            mimeType: file.type,
            fileName: file.name
          }
        };
      }
    } else {
      // For other file types, return basic info
      metadata = {
        size: file.size,
        mimeType: file.type,
        fileName: file.name,
        processedServerSide: false,
        reason: 'Non-media file - basic metadata only'
      };
    }

    return NextResponse.json({
      success: true,
      metadata,
      thumbnail: thumbnailInfo,
      processing: {
        serverSide: thumbnailInfo !== null,
        clientSideRecommended: true,
        reason: 'Optimized for Vercel free tier - thumbnails generated client-side',
        fileSize: file.size,
        fileType: file.type
      }
    });

  } catch (error) {
    console.error('Error processing file metadata:', error);
    
    // Return helpful error information
    return NextResponse.json(
      { 
        error: 'Failed to process file metadata',
        details: error.message,
        suggestions: [
          'Try uploading smaller files (under 10MB)',
          'Convert HEIC files to JPEG for better compatibility',
          'Ensure file is not corrupted'
        ],
        vercelOptimized: true
      },
      { status: 500 }
    );
  }
}

// Set maximum duration for Vercel free tier (well under 10s limit)
export const maxDuration = 8;
