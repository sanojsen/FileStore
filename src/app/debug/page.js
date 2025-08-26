'use client';
import { useState } from 'react';
import { ThumbnailService } from '../../lib/thumbnailService';

// Video metadata extraction function (copied from upload page)
const extractVideoMetadata = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    
    video.preload = 'metadata';
    video.muted = true;
    
    video.onloadedmetadata = () => {
      try {
        const metadata = {
          dimensions: {
            width: video.videoWidth,
            height: video.videoHeight
          },
          duration: video.duration
        };
        
        // Try to extract creation date from file properties
        let creationDate = null;
        
        // Use file.lastModified as fallback
        if (file.lastModified) {
          creationDate = new Date(file.lastModified);
        }
        
        // For mobile videos, try to get a more accurate date from file name patterns
        if (file.name) {
          // Common mobile video naming patterns
          const patterns = [
            // iOS: IMG_1234.MOV, VID_20231225_123456.mp4
            /(?:IMG|VID)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,
            // Android: VID_20231225_123456.mp4
            /VID_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,
            // WhatsApp: VID-20231225-WA0001.mp4
            /VID-(\d{4})(\d{2})(\d{2})-/,
            // General: 20231225_123456.mp4
            /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,
            // Screen recordings: Screen Recording 2023-12-25 at 12.34.56.mov
            /(\d{4})-(\d{2})-(\d{2}) at (\d{2})\.(\d{2})\.(\d{2})/
          ];
          
          for (const pattern of patterns) {
            const match = file.name.match(pattern);
            if (match) {
              try {
                const [, year, month, day, hour, minute, second] = match;
                const extractedDate = new Date(
                  parseInt(year),
                  parseInt(month) - 1, // Month is 0-indexed
                  parseInt(day),
                  parseInt(hour) || 0,
                  parseInt(minute) || 0,
                  parseInt(second) || 0
                );
                
                if (!isNaN(extractedDate.getTime()) && extractedDate.getFullYear() > 2000) {
                  creationDate = extractedDate;
                  console.log('Extracted date from filename:', file.name, '->', creationDate);
                  break;
                }
              } catch (err) {
                console.warn('Error parsing date from filename:', err);
              }
            }
          }
        }
        
        if (creationDate) {
          metadata.dateTime = {
            taken: creationDate.toISOString()
          };
        }
        
        URL.revokeObjectURL(url);
        resolve(metadata);
      } catch (error) {
        URL.revokeObjectURL(url);
        resolve({ error: error.message });
      }
    };
    
    video.onerror = (error) => {
      URL.revokeObjectURL(url);
      resolve({ error: 'Failed to load video metadata' });
    };
    
    video.src = url;
  });
};

export default function VideoDebugPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);

  const addLog = (message) => {
    console.log(message);
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setThumbnail(null);
      setMetadata(null);
      setLog([]);
      addLog(`Selected video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    } else {
      alert('Please select a video file');
    }
  };

  const generateThumbnail = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    addLog('Starting thumbnail generation...');
    
    try {
      const result = await ThumbnailService.createThumbnail(selectedFile);
      const url = URL.createObjectURL(result.blob);
      setThumbnail({
        url,
        width: result.width,
        height: result.height,
        source: result.source
      });
      addLog(`Thumbnail generated successfully: ${result.width}x${result.height} from ${result.source}`);
    } catch (error) {
      addLog(`Thumbnail generation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const extractMetadata = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    addLog('Starting metadata extraction...');
    
    try {
      const result = await extractVideoMetadata(selectedFile);
      setMetadata(result);
      addLog(`Metadata extraction completed`);
    } catch (error) {
      addLog(`Metadata extraction failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Video Debug Tool</h1>
      
      <div className="space-y-6">
        {/* File Selection */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="mb-4"
          />
          {selectedFile && (
            <div className="text-sm text-gray-600">
              <p>File: {selectedFile.name}</p>
              <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              <p>Type: {selectedFile.type}</p>
              <p>Last Modified: {new Date(selectedFile.lastModified).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {selectedFile && (
          <div className="flex gap-4">
            <button
              onClick={generateThumbnail}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Generate Thumbnail'}
            </button>
            <button
              onClick={extractMetadata}
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Extract Metadata'}
            </button>
          </div>
        )}

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Thumbnail */}
          {thumbnail && (
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Generated Thumbnail</h3>
              <img 
                src={thumbnail.url} 
                alt="Video thumbnail" 
                className="max-w-full h-auto border"
              />
              <div className="mt-2 text-sm text-gray-600">
                <p>Dimensions: {thumbnail.width}x{thumbnail.height}</p>
                <p>Source: {thumbnail.source}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          {metadata && (
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Extracted Metadata</h3>
              <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Debug Log */}
        {log.length > 0 && (
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Debug Log</h3>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-64 overflow-auto">
              {log.map((entry, index) => (
                <div key={index}>{entry}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
