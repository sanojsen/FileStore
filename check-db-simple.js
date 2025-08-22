import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkDatabase() {
  try {
    console.log('Environment MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not found in environment variables');
      return;
    }
    
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!');
    
    // Check if we can access the files collection
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Try to find files in the files collection
    const filesCollection = db.collection('files');
    const totalFiles = await filesCollection.countDocuments();
    console.log('Total files in database:', totalFiles);
    
    if (totalFiles > 0) {
      const sampleFiles = await filesCollection.find().limit(3).toArray();
      console.log('Sample files:', sampleFiles.map(f => ({
        id: f._id,
        originalName: f.originalName,
        fileType: f.fileType,
        thumbnailPath: f.thumbnailPath,
        userId: f.userId
      })));
    }
    
    await mongoose.disconnect();
    console.log('Database check completed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabase();
