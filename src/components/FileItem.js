import { memo } from 'react';
import FileThumbnail from './FileThumbnail';

const FileItem = memo(({ file, formatFileSize, formatDate }) => {
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL || 'https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev';
  
  const handleDownload = () => {
    const downloadUrl = `${baseUrl}${file.filePath}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.originalName;
    link.click();
  };

  const handleView = () => {
    const viewUrl = `${baseUrl}${file.filePath}`;
    window.open(viewUrl, '_blank');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-3">
        <FileThumbnail file={file} size="w-16 h-16" />
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {file.originalName}
          </h3>
          
          <div className="mt-1 text-xs text-gray-500 space-y-1">
            <div className="flex items-center justify-between">
              <span>{formatFileSize(file.size)}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                file.fileType === 'image' ? 'bg-green-100 text-green-800' :
                file.fileType === 'video' ? 'bg-red-100 text-red-800' :
                file.fileType === 'audio' ? 'bg-purple-100 text-purple-800' :
                file.fileType === 'pdf' ? 'bg-red-100 text-red-800' :
                file.fileType === 'document' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {file.fileType || 'file'}
              </span>
            </div>
            
            <div>
              Uploaded: {formatDate(file.uploadedAt)}
            </div>
            
            {file.metadata?.createdDate && (
              <div>
                Created: {formatDate(file.metadata.createdDate)}
              </div>
            )}
            
            {file.metadata?.dimensions && (
              <div>
                {file.metadata.dimensions.width} × {file.metadata.dimensions.height}
              </div>
            )}
            
            {file.metadata?.duration && (
              <div>
                Duration: {Math.round(file.metadata.duration)}s
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col space-y-1">
          <button
            onClick={handleView}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            View
          </button>
          <button
            onClick={handleDownload}
            className="text-xs text-gray-600 hover:text-gray-800 font-medium"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
});

export default FileItem;
