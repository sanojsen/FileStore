'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThumbnailService } from '../../lib/thumbnailService';

// Video metadata extraction function
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
          console.log(`📅 Video creation date extracted:`, {
            fileName: file.name,
            extractedDate: creationDate.toISOString(),
            source: 'filename_pattern'
          });
        } else {
          console.log(`⚠️ No creation date found for video:`, {
            fileName: file.name,
            lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : 'none',
            fallback: 'will_use_file_lastModified_or_upload_time'
          });
        }
        
        URL.revokeObjectURL(url);
        resolve(metadata);
      } catch (error) {
        console.warn('Error extracting video metadata:', error);
        URL.revokeObjectURL(url);
        resolve({});
      }
    };
    
    video.onerror = () => {
      console.warn('Could not load video for metadata extraction');
      URL.revokeObjectURL(url);
      resolve({});
    };
    
    // Set timeout to avoid hanging
    setTimeout(() => {
      if (video.readyState === 0) {
        URL.revokeObjectURL(url);
        resolve({});
      }
    }, 5000);
    
    video.src = url;
  });
};

// File upload status constants
const UPLOAD_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying'
};

export default function Upload() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [fileStates, setFileStates] = useState({}); // Enhanced state tracking
  const [uploadResults, setUploadResults] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && files.length > 0 && !uploading) {
        const fileCount = files.length;
        setFiles([]);
        setFileStates({});
        setUploadResults([]);
        showToast(`Cleared ${fileCount} file${fileCount > 1 ? 's' : ''} from upload queue`, 'info');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [files.length, uploading, showToast]);

  const updateFileState = useCallback((fileId, updates) => {
    setFileStates(prev => ({
      ...prev,
      [fileId]: { ...prev[fileId], ...updates }
    }));
  }, []);

  // Handle navigation in useEffect to avoid hooks order issues
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  // Early returns after all hooks are defined
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Redirecting...</div>
      </div>
    );
  }

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleNewFiles(droppedFiles);
  };
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleNewFiles(selectedFiles);
  };
  const handleNewFiles = async (newFiles) => {
    if (newFiles.length === 0) return;
    
    // Create unique IDs for files and initialize their states
    const filesWithIds = newFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      status: UPLOAD_STATUS.PENDING,
      progress: 0,
      error: null,
      retryCount: 0,
      currentStep: 'Ready to upload'
    }));
    
    // Add files to state
    setFiles(prev => [...prev, ...filesWithIds]);
    
    // Initialize file states
    const newFileStates = {};
    filesWithIds.forEach(fileInfo => {
      newFileStates[fileInfo.id] = {
        status: UPLOAD_STATUS.PENDING,
        progress: 0,
        error: null,
        retryCount: 0,
        currentStep: 'Ready to upload'
      };
    });
    
    setFileStates(prev => ({ ...prev, ...newFileStates }));
    
    showToast(`Added ${filesWithIds.length} file${filesWithIds.length > 1 ? 's' : ''} to upload queue`, 'info');
    
    // Start uploading
    await uploadFiles(filesWithIds);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setFileStates(prev => {
      const newStates = { ...prev };
      delete newStates[fileId];
      return newStates;
    });
    // Remove from results if present
    setUploadResults(prev => prev.filter(r => r.fileId !== fileId));
  };

  const retryUpload = async (fileId) => {
    const fileToRetry = files.find(f => f.id === fileId);
    if (!fileToRetry) return;

    updateFileState(fileId, {
      status: UPLOAD_STATUS.RETRYING,
      progress: 0,
      error: null,
      currentStep: 'Retrying upload...'
    });

    // Remove from results to start fresh
    setUploadResults(prev => prev.filter(r => r.fileId !== fileId));

    // Upload single file
    await uploadSingleFile(fileToRetry);
  };

  const uploadSingleFile = async (fileInfo) => {
    const { id: fileId, file } = fileInfo;
    
    try {
      updateFileState(fileId, {
        status: UPLOAD_STATUS.UPLOADING,
        progress: 5,
        currentStep: 'Getting upload URL...'
      });

      // Step 1: Get presigned URL
      const fileInfoForAPI = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream'
      };

      const presignedResponse = await fetch('/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [fileInfoForAPI] }),
      });

      if (!presignedResponse.ok) {
        const error = await presignedResponse.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }

      const { uploads } = await presignedResponse.json();
      const uploadInfo = uploads[0];

      updateFileState(fileId, {
        progress: 15,
        currentStep: 'Uploading to cloud storage...'
      });

      // Step 2: Upload file to R2
      const uploadResponse = await fetch(uploadInfo.presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to cloud storage');
      }

      updateFileState(fileId, {
        progress: 40,
        currentStep: 'Processing file...'
      });

      // Step 3: Process metadata and thumbnails
      let extractedMetadata = {};
      let thumbnailCreated = false;

      if (file.lastModified) {
        extractedMetadata.fileSystemDate = new Date(file.lastModified).toISOString();
      }

      // Create thumbnail for images/videos (optimized for Vercel free tier)
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const isHEIC = ThumbnailService.isHEIC(file);
        
        updateFileState(fileId, {
          progress: 50,
          currentStep: isHEIC ? 
            `Processing HEIC image (${(file.size / 1024 / 1024).toFixed(1)}MB)...` : 
            'Creating thumbnail...'
        });

        try {
          console.log(`🎯 Starting thumbnail creation for: ${file.name}`, {
            type: file.type,
            size: file.size,
            isHEIC: isHEIC
          });

          const thumbnail = await ThumbnailService.createThumbnail(file, 300);
          
          if (thumbnail) {
            console.log(`✅ Thumbnail created successfully:`, {
              source: thumbnail.source,
              width: thumbnail.width,
              height: thumbnail.height
            });

            if (uploadInfo.thumbnailPresignedUrl) {
              const thumbnailUploadResponse = await fetch(uploadInfo.thumbnailPresignedUrl, {
                method: 'PUT',
                body: thumbnail.blob,
                headers: { 'Content-Type': 'image/jpeg' },
              });
              
              thumbnailCreated = thumbnailUploadResponse.ok;
              
              if (thumbnailCreated) {
                console.log(`📤 Thumbnail uploaded successfully for: ${file.name}`);
                
                if (thumbnail.source === 'placeholder') {
                  updateFileState(fileId, {
                    currentStep: 'Placeholder thumbnail created (HEIC conversion unavailable)'
                  });
                } else if (thumbnail.source === 'heic_converted') {
                  updateFileState(fileId, {
                    currentStep: 'HEIC converted and thumbnail created ✅'
                  });
                }
              } else {
                console.error('❌ Thumbnail upload failed');
              }
            }
          } else {
            console.warn('⚠️ No thumbnail returned from ThumbnailService');
          }
        } catch (thumbnailError) {
          console.error('❌ Thumbnail creation failed:', thumbnailError);
          
          // For HEIC files, this is expected in some cases - show helpful message
          if (isHEIC) {
            updateFileState(fileId, {
              currentStep: 'HEIC processing failed - file will upload without thumbnail'
            });
            console.log('📸 HEIC thumbnail failed - this is expected if heic2any library is not available');
          }
        }
      }

      updateFileState(fileId, {
        progress: 60,
        currentStep: 'Extracting metadata...'
      });

      // Extract client-side video metadata first (for better video metadata)
      if (file.type.startsWith('video/')) {
        try {
          const clientVideoMetadata = await extractVideoMetadata(file);
          extractedMetadata = { ...extractedMetadata, ...clientVideoMetadata };
          console.log('Extracted client-side video metadata:', clientVideoMetadata);
        } catch (videoMetadataError) {
          console.warn('Failed to extract client-side video metadata:', videoMetadataError);
        }
      }

      // Extract metadata from server (for additional metadata, especially EXIF)
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const metadataResponse = await fetch('/api/upload/extract-metadata', {
            method: 'POST',
            body: formData,
          });
          if (metadataResponse.ok) {
            const metadataResult = await metadataResponse.json();
            extractedMetadata = { ...extractedMetadata, ...(metadataResult.metadata || {}) };
          }
        } catch (metadataError) {
          console.warn('Failed to extract metadata:', metadataError);
        }
      }

      updateFileState(fileId, {
        progress: 80,
        currentStep: 'Saving to database...'
      });

      // Step 4: Save to database
      const completeResponse = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalName: uploadInfo.originalName,
          fileName: uploadInfo.fileName,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          filePath: uploadInfo.filePath,
          thumbnailPath: thumbnailCreated ? uploadInfo.thumbnailPath : null,
          isPublic: false,
          metadata: extractedMetadata,
          tags: [],
          description: ''
        }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.error || 'Failed to save to database');
      }

      const result = await completeResponse.json();

      updateFileState(fileId, {
        status: UPLOAD_STATUS.COMPLETED,
        progress: 100,
        currentStep: 'Upload completed!'
      });

      setUploadResults(prev => [...prev, {
        fileId,
        success: true,
        file: result.file,
        hasThumbnail: thumbnailCreated,
        metadata: extractedMetadata
      }]);

      showToast(`${file.name} uploaded successfully!`, 'success');

    } catch (error) {
      console.error('Upload error for file:', file.name, error);
      
      const currentRetryCount = fileStates[fileId]?.retryCount || 0;
      updateFileState(fileId, {
        status: UPLOAD_STATUS.FAILED,
        progress: 0,
        error: error.message,
        retryCount: currentRetryCount + 1,
        currentStep: `Failed: ${error.message}`
      });

      setUploadResults(prev => [...prev, {
        fileId,
        success: false,
        error: error.message,
        filename: file.name
      }]);

      showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
    }
  };
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const uploadFiles = async (filesToUpload = files) => {
    if (filesToUpload.length === 0) return;
    
    setUploading(true);
    
    try {
      // Upload files concurrently with a limit to avoid overwhelming the server
      const concurrencyLimit = 3;
      const chunks = [];
      
      for (let i = 0; i < filesToUpload.length; i += concurrencyLimit) {
        chunks.push(filesToUpload.slice(i, i + concurrencyLimit));
      }
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(fileInfo => uploadSingleFile(fileInfo)));
      }
      
    } catch (error) {
      console.error('Batch upload error:', error);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Navigation */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            {/* Left side - Logo and title */}
            <div className="flex items-center space-x-2">
              <div className="bg-blue-100 p-1.5 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <Link href="/dashboard" className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors duration-200">
                  FileStores
                </Link>
                <p className="text-xs text-gray-500">Upload files</p>
              </div>
            </div>
            {/* Right side - User info and actions */}
            <div className="flex items-center space-x-2">
              {/* User greeting */}
              <div className="hidden sm:flex items-center space-x-2">
                <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 text-xs font-medium">
                  {session.user.email?.charAt(0).toUpperCase()}
                </div>
                <span className="text-gray-700 text-sm font-medium">
                  {session.user.name || session.user.email}
                </span>
              </div>
              {/* Dashboard button */}
              <Link
                href="/dashboard"
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              {/* Logout button */}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-gray-600 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg text-sm transition-colors duration-200 flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Simple Header Section */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Upload Files
          </h1>
          <p className="text-gray-600">
            Drag and drop files or click to browse
          </p>
        </div>
        {/* Enhanced Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-blue-500 bg-blue-50 scale-105 shadow-lg'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-all duration-200 ${
              isDragging ? 'bg-blue-200 scale-110' : 'bg-gray-100'
            }`}>
              <svg className={`w-6 h-6 transition-colors duration-200 ${
                isDragging ? 'text-blue-600' : 'text-gray-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className={`text-lg font-medium mb-2 transition-colors duration-200 ${
              isDragging ? 'text-blue-700' : 'text-gray-700'
            }`}>
              {isDragging ? 'Drop files here to upload' : 'Choose files to upload'}
            </p>
            <p className={`text-sm mb-4 transition-colors duration-200 ${
              isDragging ? 'text-blue-600' : 'text-gray-500'
            }`}>
              Supports images, videos, and documents • Multiple files allowed
            </p>
            <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isDragging 
                ? 'bg-blue-700 hover:bg-blue-800 text-white scale-105' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}>
              {isDragging ? 'Drop Now' : 'Browse Files'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="*/*"
          />
        </div>
        {/* Simple Upload Progress */}
        {files.length > 0 && (
          <div className="mt-8">
            {/* Upload Summary */}
            <div className="bg-white rounded-lg border p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Upload Progress</h3>
                {uploading && (
                  <div className="flex items-center space-x-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-top-transparent"></div>
                    <span>Uploading...</span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-6 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{files.length}</div>
                  <div className="text-sm text-gray-600">Total Files</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Object.values(fileStates).filter(s => s.status === UPLOAD_STATUS.COMPLETED).length}
                  </div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {Object.values(fileStates).filter(s => s.status === UPLOAD_STATUS.FAILED).length}
                  </div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
              </div>
              
              {/* Overall progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    Object.values(fileStates).filter(s => s.status === UPLOAD_STATUS.FAILED).length > 0
                      ? 'bg-gradient-to-r from-green-500 to-red-500'
                      : 'bg-gradient-to-r from-blue-500 to-green-500'
                  }`}
                  style={{ 
                    width: `${Math.max(
                      (Object.values(fileStates).filter(s => s.status === UPLOAD_STATUS.COMPLETED || s.status === UPLOAD_STATUS.FAILED).length / files.length) * 100,
                      5
                    )}%` 
                  }}
                ></div>
              </div>
              
              <div className="flex justify-between text-sm text-gray-600 mt-2">
                <span>
                  {Object.values(fileStates).filter(s => s.status === UPLOAD_STATUS.COMPLETED || s.status === UPLOAD_STATUS.FAILED).length} of {files.length} processed
                </span>
                <span>
                  {Math.round((Object.values(fileStates).filter(s => s.status === UPLOAD_STATUS.COMPLETED || s.status === UPLOAD_STATUS.FAILED).length / files.length) * 100)}%
                </span>
              </div>
            </div>

            {/* Failed Uploads Section */}
            {Object.values(fileStates).some(s => s.status === UPLOAD_STATUS.FAILED) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-red-900">
                      {Object.values(fileStates).filter(s => s.status === UPLOAD_STATUS.FAILED).length} Upload{Object.values(fileStates).filter(s => s.status === UPLOAD_STATUS.FAILED).length > 1 ? 's' : ''} Failed
                    </h3>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const failedFiles = files.filter(f => fileStates[f.id]?.status === UPLOAD_STATUS.FAILED && fileStates[f.id]?.retryCount < 3);
                        if (failedFiles.length > 0) {
                          showToast(`Retrying ${failedFiles.length} failed upload${failedFiles.length > 1 ? 's' : ''}...`, 'info');
                          failedFiles.forEach(f => retryUpload(f.id));
                        }
                      }}
                      disabled={!files.some(f => fileStates[f.id]?.status === UPLOAD_STATUS.FAILED && fileStates[f.id]?.retryCount < 3)}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                    >
                      Retry All Failed
                    </button>
                    <button
                      onClick={() => {
                        // Remove all failed files
                        const failedFileIds = files.filter(f => fileStates[f.id]?.status === UPLOAD_STATUS.FAILED).map(f => f.id);
                        failedFileIds.forEach(fileId => removeFile(fileId));
                        showToast('Removed all failed uploads', 'info');
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                    >
                      Remove Failed
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {files
                    .filter(f => fileStates[f.id]?.status === UPLOAD_STATUS.FAILED)
                    .map((fileInfo) => {
                      const fileState = fileStates[fileInfo.id] || {};
                      const canRetry = fileState.retryCount < 3;
                      
                      return (
                        <div key={fileInfo.id} className="bg-white rounded-lg p-4 border border-red-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{fileInfo.file.name}</p>
                                  <p className="text-sm text-gray-500">
                                    {formatFileSize(fileInfo.file.size)}
                                    {fileState.retryCount > 0 && ` • Retry ${fileState.retryCount}/3`}
                                  </p>
                                </div>
                              </div>
                              {fileState.error && (
                                <p className="text-sm text-red-600 mt-1 ml-6">
                                  {fileState.error}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              {canRetry && (
                                <button
                                  onClick={() => retryUpload(fileInfo.id)}
                                  className="text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                                  title="Retry upload"
                                >
                                  Retry
                                </button>
                              )}
                              <button
                                onClick={() => removeFile(fileInfo.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1 rounded transition-colors duration-200"
                                title="Remove file"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-center space-x-3">
              {!uploading && files.length > 0 && (
                <button
                  onClick={() => {
                    const fileCount = files.length;
                    setFiles([]);
                    setFileStates({});
                    setUploadResults([]);
                    showToast(`Cleared ${fileCount} file${fileCount > 1 ? 's' : ''} from upload queue`, 'info');
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  Clear All Files
                </button>
              )}
            </div>
          </div>
        )}
        {/* Simple Success Summary */}
        {uploadResults.some(r => r.success) && !Object.values(fileStates).some(s => s.status === UPLOAD_STATUS.FAILED) && (
          <div className="mt-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h3 className="text-lg font-medium text-green-900">
                  Upload Completed Successfully!
                </h3>
              </div>
              <p className="text-green-700">
                {uploadResults.filter(r => r.success).length} file{uploadResults.filter(r => r.success).length > 1 ? 's' : ''} uploaded successfully.{' '}
                <Link href="/dashboard" className="text-green-800 hover:text-green-900 font-medium underline">
                  View your files →
                </Link>
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className={`rounded-lg p-4 shadow-lg max-w-sm ${
            toast.type === 'success' ? 'bg-green-600 text-white' :
            toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}>
            <div className="flex items-center space-x-2">
              {toast.type === 'success' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <p className="text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => setToast(null)}
                className="ml-auto text-white hover:text-gray-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
