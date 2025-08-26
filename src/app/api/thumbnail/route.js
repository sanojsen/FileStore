import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';

/**
 * Lightweight thumbnail generation for Vercel free tier
 * This endpoint is designed to work within the 10-second timeout limit
 */
export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileUrl, fileType, fileName } = await request.json();

    if (!fileUrl || !fileType) {
      return NextResponse.json({ error: 'Missing file URL or type' }, { status: 400 });
    }

    // For Vercel free tier, we'll return placeholder info instead of heavy processing
    const isHEIC = fileType === 'image/heic' || fileType === 'image/heif' || 
                   fileName?.toLowerCase().endsWith('.heic') || fileName?.toLowerCase().endsWith('.heif');

    if (isHEIC) {
      // Return metadata for HEIC files without actual processing
      return NextResponse.json({
        success: true,
        message: 'HEIC file detected',
        thumbnail: {
          generated: false,
          reason: 'HEIC processing requires premium hosting for server-side conversion',
          recommendation: 'Consider converting HEIC files to JPEG before upload',
          placeholder: true
        },
        metadata: {
          fileType: 'image',
          format: 'heic',
          supportedOperations: ['view', 'download'],
          thumbnailAvailable: false
        }
      });
    }

    // For other image types, return success (client-side generation should handle these)
    if (fileType.startsWith('image/')) {
      return NextResponse.json({
        success: true,
        message: 'Standard image format - processed client-side',
        thumbnail: {
          generated: true,
          method: 'client-side',
          format: 'jpeg'
        }
      });
    }

    // For non-image files
    return NextResponse.json({
      success: true,
      message: 'Non-image file - no thumbnail needed',
      thumbnail: {
        generated: false,
        reason: 'File type does not support thumbnails'
      }
    });

  } catch (error) {
    console.error('Thumbnail API error:', error);
    return NextResponse.json(
      { 
        error: 'Thumbnail processing failed',
        details: error.message,
        suggestion: 'Try uploading in JPEG or PNG format for better compatibility'
      },
      { status: 500 }
    );
  }
}

export const maxDuration = 5; // 5 seconds max - well under Vercel's 10s limit
