import { connectToDatabase } from './src/lib/mongodb.js';
import File from './src/models/File.js';

async function checkFiles() {
  try {
    await connectToDatabase();
    
    // Get the latest files to see their structure
    const latestFiles = await File.find({}).sort({ uploadedAt: -1 }).limit(5).lean();
    
    console.log('Latest files in database:');
    latestFiles.forEach((file, index) => {
      console.log(`\n--- File ${index + 1} ---`);
      console.log(`ID: ${file._id}`);
      console.log(`Name: ${file.originalName}`);
      console.log(`Type: ${file.mimeType}`);
      console.log(`UploadedAt: ${file.uploadedAt}`);
      console.log(`CreatedAt: ${file.createdAt || 'NOT PRESENT'}`);
      
      if (file.metadata?.dateTime?.taken) {
        console.log(`EXIF Date: ${file.metadata.dateTime.taken}`);
      } else {
        console.log(`EXIF Date: NOT PRESENT`);
      }
      
      if (file.metadata?.fileSystemDate) {
        console.log(`File System Date: ${file.metadata.fileSystemDate}`);
      } else {
        console.log(`File System Date: NOT PRESENT`);
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkFiles();
