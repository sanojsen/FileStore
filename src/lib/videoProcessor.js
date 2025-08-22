import { spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

export class VideoProcessor {
  // Helper function to get the correct ffmpeg path
  static async getFFmpegPath() {
    try {
      // Dynamically import ffmpeg-static for Turbopack compatibility
      const ffmpegStaticModule = await import('ffmpeg-static');
      const ffmpegPath = ffmpegStaticModule.default;
      console.log('VideoProcessor: Raw ffmpeg-static path:', ffmpegPath);
      
      // Handle Turbopack's \ROOT\ prefix
      if (ffmpegPath.startsWith('\\ROOT\\')) {
        const relativePath = ffmpegPath.replace('\\ROOT\\', '');
        const absolutePath = path.resolve(process.cwd(), relativePath);
        console.log('VideoProcessor: Resolved Turbopack path:', absolutePath);
        
        // Verify the resolved path exists
        if (fs.existsSync(absolutePath)) {
          return absolutePath;
        } else {
          console.warn('VideoProcessor: Resolved path does not exist:', absolutePath);
        }
      } else {
        // Normal path, verify it exists
        if (fs.existsSync(ffmpegPath)) {
          console.log('VideoProcessor: Using ffmpeg-static path:', ffmpegPath);
          return ffmpegPath;
        }
      }
    } catch (error) {
      console.error('VideoProcessor: Error with ffmpeg-static:', error);
    }
    
    // Fallback to manual search
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules/ffmpeg-static/ffmpeg.exe'),
      path.join(process.cwd(), 'node_modules\\ffmpeg-static\\ffmpeg.exe'),
      'ffmpeg' // fallback to system ffmpeg
    ];
    
    for (const testPath of possiblePaths) {
      if (testPath === 'ffmpeg') {
        console.log('VideoProcessor: Using system ffmpeg');
        return testPath;
      }
      if (fs.existsSync(testPath)) {
        console.log('VideoProcessor: Found ffmpeg at:', testPath);
        return testPath;
      }
    }
    
    console.log('VideoProcessor: Defaulting to system ffmpeg');
    return 'ffmpeg';
  }

  static async createVideoThumbnail(buffer, maxSize = 300) {
    console.log('VideoProcessor: Starting video thumbnail creation');
    
    const tempVideoPath = path.join(os.tmpdir(), `video_${Math.random().toString(36).substr(2, 9)}.mp4`);
    const tempThumbPath = path.join(os.tmpdir(), `thumb_${Math.random().toString(36).substr(2, 9)}.jpg`);
    
    try {
      console.log('VideoProcessor: Writing video to temp file:', tempVideoPath);
      await writeFile(tempVideoPath, buffer);
      
      console.log('VideoProcessor: Extracting thumbnail with FFmpeg');
      const success = await this.extractThumbnailWithFFmpeg(tempVideoPath, tempThumbPath, maxSize);
      
      if (!success) {
        console.error('VideoProcessor: FFmpeg extraction failed');
        throw new Error('Failed to extract video thumbnail');
      }

      console.log('VideoProcessor: Reading generated thumbnail');
      const thumbnailBuffer = await fs.promises.readFile(tempThumbPath);
      
      console.log('VideoProcessor: Processing with Sharp for optimization');
      const optimizedThumbnail = await sharp(thumbnailBuffer)
        .jpeg({ 
          quality: 90, 
          progressive: true,
          mozjpeg: true 
        })
        .toBuffer();

      console.log('VideoProcessor: Video thumbnail created successfully, size:', optimizedThumbnail.length);
      return optimizedThumbnail;
    } catch (error) {
      console.error('VideoProcessor: Error creating video thumbnail:', error);
      throw error;
    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(tempVideoPath)) {
          await unlink(tempVideoPath);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup input file:', cleanupError);
      }
      
      try {
        if (fs.existsSync(tempThumbPath)) {
          await unlink(tempThumbPath);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup output file:', cleanupError);
      }
    }
  }

  static async extractThumbnailWithFFmpeg(inputPath, outputPath, maxSize = 300) {
    console.log('VideoProcessor: Starting FFmpeg extraction');
    
    return new Promise(async (resolve) => {
      try {
        // Use the helper function to get the correct path
        const ffmpegPath = await this.getFFmpegPath();

        const args = [
          '-i', inputPath,
          '-ss', '00:00:01.000', // Seek to 1 second
          '-vframes', '1', // Extract only 1 frame
          '-vf', `scale='min(${maxSize},iw)':'min(${maxSize},ih)':force_original_aspect_ratio=decrease`, // Scale maintaining aspect ratio
          '-q:v', '2', // High quality (1-31, lower is better)
          '-y', // Overwrite output file
          outputPath
        ];

        console.log('VideoProcessor: Spawning FFmpeg with path:', ffmpegPath);
        console.log('VideoProcessor: Spawning FFmpeg with args:', args);

        const ffmpegProcess = spawn(ffmpegPath, args);
        let processComplete = false;
        
        // Set a timeout for the FFmpeg process
        const timeout = setTimeout(() => {
          if (!processComplete) {
            console.log('VideoProcessor: FFmpeg timeout, killing process');
            ffmpegProcess.kill('SIGKILL');
            resolve(false);
          }
        }, 30000); // 30 second timeout

        ffmpegProcess.stderr.on('data', (data) => {
          console.log('VideoProcessor: FFmpeg stderr:', data.toString());
        });

        ffmpegProcess.on('error', (error) => {
          console.error('VideoProcessor: FFmpeg spawn error:', error);
          clearTimeout(timeout);
          processComplete = true;
          resolve(false);
        });

        ffmpegProcess.on('close', (code) => {
          console.log('VideoProcessor: FFmpeg process closed with code:', code);
          clearTimeout(timeout);
          processComplete = true;
          
          if (code === 0) {
            console.log('VideoProcessor: FFmpeg extraction successful');
            resolve(true);
          } else {
            console.error('VideoProcessor: FFmpeg failed with code:', code);
            resolve(false);
          }
        });
      } catch (error) {
        console.error('VideoProcessor: Error in extractThumbnailWithFFmpeg:', error);
        resolve(false);
      }
    });
  }

  static async getVideoMetadata(buffer) {
    console.log('VideoProcessor: Getting video metadata');
    return await this.extractMetadataWithFFprobe(buffer);
  }

  static async extractMetadataWithFFprobe(buffer) {
    console.log('VideoProcessor: Starting metadata extraction with FFprobe');
    
    const tempVideoPath = path.join(os.tmpdir(), `video_probe_${Math.random().toString(36).substr(2, 9)}.mp4`);
    
    try {
      await writeFile(tempVideoPath, buffer);
      
      return new Promise(async (resolve) => {
        try {
          // Try to dynamically import ffprobe-static for Turbopack compatibility
          let ffprobePath;
          try {
            const ffprobeStaticModule = await import('ffprobe-static');
            ffprobePath = ffprobeStaticModule.default;
            console.log('VideoProcessor: Raw ffprobe path:', ffprobePath);
            
            // Handle Turbopack's \ROOT\ prefix for ffprobe too
            if (ffprobePath.startsWith('\\ROOT\\')) {
              const relativePath = ffprobePath.replace('\\ROOT\\', '');
              ffprobePath = path.resolve(process.cwd(), relativePath);
              console.log('VideoProcessor: Resolved ffprobe path:', ffprobePath);
            }
          } catch (importError) {
            console.log('VideoProcessor: Could not import ffprobe-static, using fallback');
            ffprobePath = 'ffprobe'; // fallback to system ffprobe
          }

          const args = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            tempVideoPath
          ];

          console.log('VideoProcessor: Spawning FFprobe with path:', ffprobePath);
          const ffprobeProcess = spawn(ffprobePath, args);
          
          let stdout = '';
          let stderr = '';

          ffprobeProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          ffprobeProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          ffprobeProcess.on('error', (error) => {
            console.error('FFprobe spawn error:', error);
            resolve({ type: 'video', mimeType: 'video/mp4' }); // fallback
          });

          ffprobeProcess.on('close', (code) => {
            if (code === 0 && stdout) {
              try {
                const metadata = JSON.parse(stdout);
                console.log('VideoProcessor: FFprobe metadata extracted successfully');
                resolve({
                  type: 'video',
                  mimeType: 'video/mp4',
                  duration: metadata.format?.duration ? parseFloat(metadata.format.duration) : undefined,
                  width: metadata.streams?.[0]?.width,
                  height: metadata.streams?.[0]?.height,
                  bitrate: metadata.format?.bit_rate ? parseInt(metadata.format.bit_rate) : undefined
                });
              } catch (parseError) {
                console.error('VideoProcessor: Error parsing FFprobe output:', parseError);
                resolve({ type: 'video', mimeType: 'video/mp4' }); // fallback
              }
            } else {
              console.error('FFprobe error:', stderr);
              resolve({ type: 'video', mimeType: 'video/mp4' }); // fallback
            }
          });
        } catch (error) {
          console.error('VideoProcessor: Error in extractMetadataWithFFprobe:', error);
          resolve({ type: 'video', mimeType: 'video/mp4' }); // fallback
        }
      });
    } catch (error) {
      console.error('VideoProcessor: Error writing temp file for FFprobe:', error);
      return { type: 'video', mimeType: 'video/mp4' }; // fallback
    } finally {
      // Cleanup temp file
      try {
        if (fs.existsSync(tempVideoPath)) {
          await unlink(tempVideoPath);
        }
      } catch (cleanupError) {
        console.warn('VideoProcessor: Failed to cleanup probe temp file:', cleanupError);
      }
    }
  }
}
