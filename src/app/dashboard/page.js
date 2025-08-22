'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Use dynamic import with no SSR to avoid bundling issues
const FileThumbnail = dynamic(() => import('../../components/FileThumbnail'), {
  ssr: false,
  loading: () => <div className="w-16 h-16 bg-gray-200 animate-pulse rounded"></div>
});

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('uploadDate');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, status, router]);

  // Fetch files from the API
  const fetchFiles = async (pageNum = 1, reset = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        sortBy: sortBy
      });

      if (filter !== 'all') {
        params.append('type', filter);
      }

      const response = await fetch(`/api/files?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch files');
      }

      if (reset || pageNum === 1) {
        setFiles(data.files);
      } else {
        setFiles(prev => [...prev, ...data.files]);
      }
      
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (session) {
      fetchFiles(1, true);
    }
  }, [session, filter, sortBy]); // fetchFiles is stable, so this is safe

  // Load more files
  const loadMore = () => {
    if (hasMore && !loadingMore) {
      fetchFiles(page + 1, false);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle file click (you can expand this to show file details or download)
  const handleFileClick = (file) => {
    // For now, let's just log the file info
    console.log('File clicked:', file);
    // You could open a modal, navigate to a detail page, etc.
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome back, {session.user?.name || session.user?.email}
              </p>
            </div>
            <button
              onClick={() => router.push('/upload')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200"
            >
              Upload Files
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* File Type Filter */}
            <div className="flex items-center space-x-2">
              <label htmlFor="filter" className="text-sm font-medium text-gray-700">
                Filter:
              </label>
              <select
                id="filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Files</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="pdf">PDFs</option>
                <option value="document">Documents</option>
                <option value="archive">Archives</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Sort Options */}
            <div className="flex items-center space-x-2">
              <label htmlFor="sort" className="text-sm font-medium text-gray-700">
                Sort by:
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="uploadDate">Upload Date</option>
                <option value="createdDate">Created Date</option>
              </select>
            </div>

            {/* File Count */}
            <div className="ml-auto text-sm text-gray-500">
              {files.length} files
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading your files...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && files.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === 'all' ? 'Get started by uploading your first file.' : `No ${filter} files found.`}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => router.push('/upload')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Upload Files
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Files Gallery */}
        {!loading && !error && files.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
              {files.map((file) => (
                <div
                  key={file._id}
                  onClick={() => handleFileClick(file)}
                  className="group cursor-pointer bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square">
                    <FileThumbnail 
                      file={file} 
                      size="w-full h-full" 
                      className="rounded-t-lg"
                    />
                  </div>
                  
                  {/* File Info */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 truncate" title={file.originalName}>
                      {file.originalName}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(file.size)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(file.uploadedAt)}
                    </p>
                    
                    {/* File Type Badge */}
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        file.fileType === 'image' ? 'bg-green-100 text-green-800' :
                        file.fileType === 'video' ? 'bg-red-100 text-red-800' :
                        file.fileType === 'audio' ? 'bg-purple-100 text-purple-800' :
                        file.fileType === 'pdf' ? 'bg-red-100 text-red-800' :
                        file.fileType === 'document' ? 'bg-blue-100 text-blue-800' :
                        file.fileType === 'archive' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {file.fileType}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="border-t border-gray-200 p-6 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    'Load More Files'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}