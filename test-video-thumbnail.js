// Simple test script to verify video thumbnail creation
import { VideoProcessor } from './src/lib/videoProcessor.js';
import fs from 'fs';
import path from 'path';

async function testVideoThumbnail() {
  try {
    console.log('Testing video thumbnail generation...');
    
    // Check if ffmpeg is available
    const ffmpegPath = path.join(process.cwd(), 'node_modules/ffmpeg-static/ffmpeg.exe');
    console.log('FFmpeg path:', ffmpegPath);
    console.log('FFmpeg exists:', fs.existsSync(ffmpegPath));
    
    // For testing, create a small test buffer (this would normally be video data)
    const testBuffer = Buffer.from('test video data');
    
    console.log('Creating video thumbnail...');
    const result = await VideoProcessor.createVideoThumbnail(testBuffer, 300);
    
    if (result) {
      console.log('SUCCESS: Video thumbnail created!');
      console.log('Result:', result);
    } else {
      console.log('FAILED: Video thumbnail creation failed');
    }
    
  } catch (error) {
    console.error('ERROR:', error);
  }
}

testVideoThumbnail();
