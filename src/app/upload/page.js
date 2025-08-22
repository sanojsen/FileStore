'use client';
import { useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClientThumbnailGenerator } from '../../lib/clientThumbnailGenerator';
export default function Upload() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadResults, setUploadResults] = useState([]);
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  if (status === 'unauthenticated') {
    router.push('/');
    return null;
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
    // Add files to state immediately
    const startIndex = files.length;
    setFiles(prev => [...prev, ...newFiles]);
    // Start uploading immediately
    await uploadFiles(newFiles, startIndex);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Clear any progress for this file
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[index];
      return newProgress;
    });
  };
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const uploadFiles = async (filesToUpload = files, startIndex = 0) => {
    if (filesToUpload.length === 0) return;
    setUploading(true);
    try {
      // Step 1: Get presigned URLs for all files
      const fileInfos = filesToUpload.map(file => ({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream'
      }));
      // Initialize progress for new files
      setUploadProgress(prev => {
        const progress = { ...prev };
        filesToUpload.forEach((_, index) => {
          progress[startIndex + index] = 5;
        });
        return progress;
      });
      const presignedResponse = await fetch('/api/upload/presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: fileInfos }),
      });
      if (!presignedResponse.ok) {
        const error = await presignedResponse.json();
        throw new Error(error.error || 'Failed to get upload URLs');
      }
      const { uploads } = await presignedResponse.json();
      // Step 2: Upload each file with metadata processing
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const uploadInfo = uploads[i];
        const progressIndex = startIndex + i;
        try {
          setUploadProgress(prev => ({ ...prev, [progressIndex]: 15 }));
          // Upload main file to R2 directly
          const uploadResponse = await fetch(uploadInfo.presignedUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
          });
          if (!uploadResponse.ok) {
            throw new Error('Failed to upload to Cloudflare R2');
          }
          setUploadProgress(prev => ({ ...prev, [progressIndex]: 40 }));
          // Process metadata and create thumbnail for images/videos
          let extractedMetadata = {};
          let thumbnailCreated = false;
          let clientThumbnail = null;
          // Add file system metadata (available from File object)
          if (file.lastModified) {
            extractedMetadata.fileSystemDate = new Date(file.lastModified).toISOString();
          }
          // Create client-side thumbnail for images and videos
          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            try {
              clientThumbnail = await ClientThumbnailGenerator.createThumbnail(file, 300);
              if (clientThumbnail && uploadInfo.thumbnailPresignedUrl) {
                setUploadProgress(prev => ({ ...prev, [progressIndex]: 50 }));
                // Upload thumbnail to R2
                const thumbnailUploadResponse = await fetch(uploadInfo.thumbnailPresignedUrl, {
                  method: 'PUT',
                  body: clientThumbnail.blob,
                  headers: {
                    'Content-Type': 'image/jpeg',
                  },
                });
                if (thumbnailUploadResponse.ok) {
                  thumbnailCreated = true;
                } else {
                  console.warn(`Failed to upload thumbnail for ${file.name}`);
                }
              }
            } catch (thumbnailError) {
              console.warn('Failed to generate client thumbnail:', thumbnailError);
            }
          }
              setUploadProgress(prev => ({ ...prev, [progressIndex]: 60 }));
          // Extract EXIF metadata from server (lightweight - no thumbnails)
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
                // Merge file system metadata with EXIF metadata
                extractedMetadata = { 
                  ...extractedMetadata, 
                  ...(metadataResult.metadata || {})
                };
              }
            } catch (metadataError) {
              console.warn('Failed to extract server metadata:', metadataError);
            }
          }
          setUploadProgress(prev => ({ ...prev, [progressIndex]: 80 }));
          // Step 3: Save metadata to database via API
          const completeResponse = await fetch('/api/upload/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
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
          setUploadProgress(prev => ({ ...prev, [progressIndex]: 100 }));
          if (completeResponse.ok) {
            const result = await completeResponse.json();
            setUploadResults(prev => [...prev, { 
              success: true, 
              file: result.file,
              hasThumbnail: thumbnailCreated,
              metadata: extractedMetadata
            }]);
          } else {
            const error = await completeResponse.json();
            setUploadResults(prev => [...prev, { 
              success: false, 
              error: error.error || 'Failed to save metadata to database', 
              filename: file.name 
            }]);
          }
        } catch (error) {
          console.error('Upload error for file:', file.name, error);
          setUploadResults(prev => [...prev, { 
            success: false, 
            error: error.message || 'Upload failed', 
            filename: file.name 
          }]);
          setUploadProgress(prev => ({ ...prev, [progressIndex]: 0 }));
        }
      }
    } catch (error) {
      console.error('Batch upload error:', error);
      // Set error for all files being uploaded
      filesToUpload.forEach((file, index) => {
        setUploadResults(prev => [...prev, { 
          success: false, 
          error: error.message || 'Batch upload failed', 
          filename: file.name 
        }]);
      });
    }
    setUploading(false);
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
        {/* Simple Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-700 mb-2">
              {isDragging ? 'Drop files here' : 'Choose files to upload'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supports images, videos, and documents
            </p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200">
              Browse Files
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
        {/* Selected Files */}
        {files.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Files ({files.length})
            </h3>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                    </p>
                    {uploadProgress[index] !== undefined && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                uploadProgress[index] === 100 
                                  ? 'bg-green-500' 
                                  : uploadProgress[index] === 0 
                                    ? 'bg-red-500' 
                                    : 'bg-indigo-600'
                              }`}
                              style={{ width: `${Math.max(uploadProgress[index], 0)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 min-w-fit">
                            {uploadProgress[index] === 100 
                              ? 'Complete' 
                              : uploadProgress[index] === 0 
                                ? 'Failed' 
                                : `${uploadProgress[index]}%`
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    disabled={uploadProgress[index] !== undefined && uploadProgress[index] > 0 && uploadProgress[index] < 100}
                    className="ml-4 text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={uploadProgress[index] !== undefined && uploadProgress[index] > 0 && uploadProgress[index] < 100 ? "Cannot remove file while uploading" : "Remove file"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Upload Results */}
        {uploadResults.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Results</h3>
            <div className="space-y-3">
              {uploadResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  {result.success ? (
                    <div>
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-medium text-green-900">
                            {result.file.originalName}
                          </p>
                          <p className="text-sm text-green-700">
                            Uploaded successfully • {formatFileSize(result.file.fileSize)}
                            {result.hasThumbnail && (result.file.mimeType.startsWith('video/') ? ' • Video thumbnail created' : ' • Thumbnail created')}
                            {result.metadata && result.metadata.dimensions && ` • ${result.metadata.dimensions.width}×${result.metadata.dimensions.height}`}
                            {result.file.createdAt && new Date(result.file.createdAt).getTime() !== new Date(result.file.uploadedAt).getTime() && 
                              ` • Created: ${new Date(result.file.createdAt).toLocaleDateString()}`
                            }
                          </p>
                        </div>
                      </div>
                      {/* Show metadata if available */}
                      {result.metadata && Object.keys(result.metadata).length > 0 && (
                        <div className="mt-2 p-2 bg-green-100 rounded text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            {result.metadata.dimensions && (
                              <div>
                                <span className="font-medium">Dimensions:</span> {result.metadata.dimensions.width}×{result.metadata.dimensions.height}
                              </div>
                            )}
                            {result.metadata.camera?.make && (
                              <div>
                                <span className="font-medium">Camera:</span> {result.metadata.camera.make} {result.metadata.camera.model}
                              </div>
                            )}
                            {result.metadata.dateTime?.taken && (
                              <div>
                                <span className="font-medium">Date Taken:</span> {new Date(result.metadata.dateTime.taken).toLocaleDateString()}
                              </div>
                            )}
                            {result.file.createdAt && (
                              <div>
                                <span className="font-medium">File Created:</span> {new Date(result.file.createdAt).toLocaleDateString()}
                              </div>
                            )}
                            {result.metadata.duration && (
                              <div>
                                <span className="font-medium">Duration:</span> {Math.round(result.metadata.duration)}s
                              </div>
                            )}
                            {result.metadata.codec && (
                              <div>
                                <span className="font-medium">Codec:</span> {result.metadata.codec}
                              </div>
                            )}
                            {result.metadata.location && (
                              <div>
                                <span className="font-medium">Location:</span> Available
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <div>
                        <p className="font-medium text-red-900">{result.filename}</p>
                        <p className="text-sm text-red-700">Error: {result.error}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
