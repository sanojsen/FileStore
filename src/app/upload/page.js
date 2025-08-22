'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  if (!session) {
    router.push('/login');
    return null;
  }

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadResults([]);
    
    try {
      // Step 1: Get presigned URLs for all files
      setUploadProgress(prev => {
        const progress = {};
        files.forEach((_, index) => progress[index] = 5);
        return progress;
      });

      const fileInfos = files.map(file => ({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream'
      }));

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
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadInfo = uploads[i];
        
        try {
          setUploadProgress(prev => ({ ...prev, [i]: 15 }));

          // Upload main file to R2
          const uploadResponse = await fetch(uploadInfo.presignedUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload to cloud storage');
          }

          setUploadProgress(prev => ({ ...prev, [i]: 50 }));

          // Process metadata and create thumbnail for images/videos
          let extractedMetadata = {};
          let thumbnailCreated = false;

          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            try {
              const formData = new FormData();
              formData.append('file', file);
              if (uploadInfo.thumbnailKey) {
                formData.append('thumbnailKey', uploadInfo.thumbnailKey);
              }

              const metadataResponse = await fetch('/api/upload/process-metadata', {
                method: 'POST',
                body: formData,
              });

              if (metadataResponse.ok) {
                const metadataResult = await metadataResponse.json();
                extractedMetadata = metadataResult.metadata || {};
                thumbnailCreated = !!metadataResult.thumbnail;
              }
            } catch (metadataError) {
              console.warn('Failed to extract metadata:', metadataError);
            }
          }

          setUploadProgress(prev => ({ ...prev, [i]: 80 }));

          // Step 3: Save metadata to database
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

          setUploadProgress(prev => ({ ...prev, [i]: 100 }));

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
              error: error.error || 'Failed to save metadata', 
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
          setUploadProgress(prev => ({ ...prev, [i]: 0 }));
        }
      }
    } catch (error) {
      console.error('Batch upload error:', error);
      // Set error for all files
      files.forEach((file, index) => {
        setUploadResults(prev => [...prev, { 
          success: false, 
          error: error.message || 'Batch upload failed', 
          filename: file.name 
        }]);
      });
    }

    setUploading(false);
    setFiles([]);
    setUploadProgress({});
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-semibold">
                FileStores
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Hello, {session.user.name}</span>
              <Link
                href="/dashboard"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upload Files</h1>
          <p className="mt-2 text-gray-600">
            Upload your videos, photos, and documents securely to the cloud.
          </p>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="mt-4">
            <p className="text-lg text-gray-600">
              <span className="font-medium text-indigo-600 cursor-pointer">
                Click to upload
              </span>{' '}
              or drag and drop
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Videos, images, documents up to 100MB each
            </p>
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
              Selected Files ({files.length})
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
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress[index]}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    className="ml-4 text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={uploadFiles}
                disabled={uploading || files.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium transition-colors"
              >
                {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
              </button>
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
