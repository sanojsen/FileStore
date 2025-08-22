// Test script to check download functionality
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testDownload() {
  try {
    console.log('Environment MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not found in environment variables');
      return;
    }
    
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!');
    
    // Try to find files in the files collection
    const db = mongoose.connection.db;
    const filesCollection = db.collection('files');
    const totalFiles = await filesCollection.countDocuments();
    console.log('Total files in database:', totalFiles);
    
    if (totalFiles > 0) {
      const file = await filesCollection.findOne();
      console.log('Found file:', {
        _id: file._id,
        originalName: file.originalName,
        userId: file.userId,
        filePath: file.filePath
      });
      
      // Check what type of ID this is
      console.log('File ID type:', typeof file._id);
      console.log('User ID type:', typeof file.userId);
      console.log('File ID length:', file._id.length);
      console.log('User ID length:', file.userId.length);
      
      // Check users collection too
      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne();
      if (user) {
        console.log('Sample user:', {
          _id: user._id,
          email: user.email,
          _idType: typeof user._id,
          _idString: user._id.toString()
        });
      }
      
    } else {
      console.log('No files found in database');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testDownload();
