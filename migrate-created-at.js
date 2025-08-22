#!/usr/bin/env node

/**
 * Migration script to add createdAt field to existing files
 * This script will:
 * 1. Find all files without createdAt field
 * 2. Use EXIF dateTime.taken if available
 * 3. Fall back to uploadedAt if no EXIF data
 */

import { connectToDatabase } from './src/lib/mongodb.js';
import File from './src/models/File.js';

async function migrateCreatedAt() {
  try {
    console.log('🚀 Starting createdAt migration...');
    
    await connectToDatabase();
    console.log('✅ Connected to database');

    // Find all files that don't have createdAt field
    const filesWithoutCreatedAt = await File.find({ 
      createdAt: { $exists: false } 
    }).lean();

    console.log(`📁 Found ${filesWithoutCreatedAt.length} files without createdAt field`);

    if (filesWithoutCreatedAt.length === 0) {
      console.log('🎉 No files need migration!');
      return;
    }

    let updatedCount = 0;
    let exifDateCount = 0;
    let fallbackCount = 0;

    for (const file of filesWithoutCreatedAt) {
      let createdAt;
      let dateSource;

      // Try to use EXIF date first
      if (file.metadata?.dateTime?.taken) {
        try {
          const exifDate = new Date(file.metadata.dateTime.taken);
          if (!isNaN(exifDate.getTime()) && exifDate.getTime() > 0) {
            createdAt = exifDate;
            dateSource = 'exif';
            exifDateCount++;
          }
        } catch (error) {
          console.warn(`⚠️  Invalid EXIF date for file ${file._id}:`, error.message);
        }
      }

      // Fall back to uploadedAt if no valid EXIF date
      if (!createdAt) {
        createdAt = file.uploadedAt || new Date();
        dateSource = 'uploadedAt';
        fallbackCount++;
      }

      // Update the file
      try {
        await File.updateOne(
          { _id: file._id },
          { $set: { createdAt: createdAt } }
        );
        updatedCount++;
        
        console.log(`✅ Updated ${file.originalName} - ${dateSource}: ${createdAt.toISOString()}`);
      } catch (updateError) {
        console.error(`❌ Failed to update file ${file._id}:`, updateError.message);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total files processed: ${filesWithoutCreatedAt.length}`);
    console.log(`   Successfully updated: ${updatedCount}`);
    console.log(`   Used EXIF date: ${exifDateCount}`);
    console.log(`   Used uploadedAt fallback: ${fallbackCount}`);
    console.log('🎉 Migration completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateCreatedAt().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
