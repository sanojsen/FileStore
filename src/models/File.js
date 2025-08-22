import mongoose from 'mongoose';
const fileSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => require('uuid').v4()
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true,
    enum: ['image', 'video', 'audio', 'pdf', 'document', 'archive', 'other']
  },
  filePath: {
    type: String,
    required: true
  },
  thumbnailPath: {
    type: String,
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    index: true,
    default: Date.now
  },
  metadata: {
    uploadMethod: {
      type: String,
      default: 'direct-r2'
    },
    originalMimeType: String,
    dimensions: {
      width: Number,
      height: Number
    },
    duration: Number,
    camera: {
      make: String,
      model: String,
      lens: String
    },
    settings: {
      iso: Number,
      aperture: String,
      shutterSpeed: String,
      focalLength: String
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    createdDate: Date,
    colorSpace: String,
    hasAlpha: Boolean,
    density: Number,
    tags: [String],
    description: String,
    category: String
  }
}, {
  timestamps: false,
  _id: false
});
// Add indexes for better performance
fileSchema.index({ userId: 1, uploadedAt: -1 });
fileSchema.index({ userId: 1, createdAt: -1 });
fileSchema.index({ userId: 1, 'metadata.createdDate': -1 });
fileSchema.index({ userId: 1, fileType: 1 });
// Static method to determine file type from MIME type
fileSchema.statics.getFileType = function(mimeType) {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('text') || 
      mimeType.includes('document') || 
      mimeType.includes('word') || 
      mimeType.includes('excel') || 
      mimeType.includes('powerpoint')) return 'document';
  if (mimeType.includes('zip') || 
      mimeType.includes('rar') || 
      mimeType.includes('tar') || 
      mimeType.includes('7z')) return 'archive';
  return 'other';
};
// Instance method to get display name
fileSchema.methods.getDisplayName = function() {
  return this.originalName || this.fileName;
};
// Instance method to get file extension
fileSchema.methods.getExtension = function() {
  const name = this.originalName || this.fileName;
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.substring(lastDot + 1).toLowerCase() : '';
};
const File = mongoose.models.File || mongoose.model('File', fileSchema);
export default File;