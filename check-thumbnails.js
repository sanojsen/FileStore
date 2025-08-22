import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkThumbnails() {
  try {
    console.log('Environment MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not found in environment variables');
      console.log('Please create a .env.local file with your MongoDB connection string');
      return;
    }
    
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!');
    
    // Check files with thumbnail paths
    const db = mongoose.connection.db;
    const filesCollection = db.collection('files');
    
    const totalFiles = await filesCollection.countDocuments();
    console.log('Total files in database:', totalFiles);
    
    if (totalFiles > 0) {
      const filesWithThumbnails = await filesCollection.countDocuments({ thumbnailPath: { $ne: null } });
      console.log('Files with thumbnails:', filesWithThumbnails);
      
      const sampleFiles = await filesCollection.find().limit(5).toArray();
      console.log('\n=== Sample Files ===');
      sampleFiles.forEach((file, index) => {
        console.log(`File ${index + 1}:`, {
          id: file._id,
          originalName: file.originalName,
          fileType: file.fileType,
          mimeType: file.mimeType,
          filePath: file.filePath,
          thumbnailPath: file.thumbnailPath,
          hasThumbnail: !!file.thumbnailPath,
          uploadedAt: file.uploadedAt
        });
      });
      
      // Check for files without thumbnails that should have them
      const mediaFiles = await filesCollection.find({ 
        fileType: { $in: ['image', 'video'] },
        thumbnailPath: null
      }).limit(3).toArray();
      
      if (mediaFiles.length > 0) {
        console.log('\n=== Media Files Without Thumbnails ===');
        mediaFiles.forEach((file, index) => {
          console.log(`Media File ${index + 1}:`, {
            originalName: file.originalName,
            fileType: file.fileType,
            mimeType: file.mimeType,
            thumbnailPath: file.thumbnailPath
          });
        });
      }
    }
    
    await mongoose.disconnect();
    console.log('\nThumbnail check completed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkThumbnails();
