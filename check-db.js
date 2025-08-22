import dotenv from 'dotenv';
import { connectToDatabase } from './src/lib/mongodb.js';
import File from './src/models/File.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkDatabase() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    console.log('Connected successfully!');
    
    // Count all files
    const totalFiles = await File.countDocuments();
    console.log('Total files in database:', totalFiles);
    
    // Get sample files
    const sampleFiles = await File.find().limit(5).lean();
    console.log('Sample files:', sampleFiles);
    
    // Check unique users
    const users = await File.distinct('userId');
    console.log('Users with files:', users);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDatabase();
