#!/usr/bin/env node

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInterface } from 'readline';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Configuration
const R2_CONFIG = {
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
};

const BUCKET_NAME = process.env.CLOUDFLARE_BUCKET_NAME;
const MONGODB_URI = process.env.MONGODB_URI;

// Initialize clients
const r2Client = new S3Client(R2_CONFIG);

/**
 * Clear all objects from Cloudflare R2 bucket
 */
async function clearR2Bucket() {
  console.log('\n🗑️  Starting Cloudflare R2 bucket cleanup...');
  
  if (!BUCKET_NAME) {
    console.error('❌ CLOUDFLARE_BUCKET_NAME is not configured');
    return false;
  }

  try {
    let continuationToken = undefined;
    let totalDeleted = 0;

    do {
      // List objects in the bucket
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000, // Maximum allowed by AWS S3 API
      });

      const listResponse = await r2Client.send(listCommand);
      
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        console.log('✅ No objects found in R2 bucket');
        break;
      }

      // Prepare objects for deletion
      const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key }));
      
      console.log(`🔄 Deleting ${objectsToDelete.length} objects...`);

      // Delete objects in batches
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: objectsToDelete,
          Quiet: false,
        },
      });

      const deleteResponse = await r2Client.send(deleteCommand);
      
      if (deleteResponse.Deleted) {
        totalDeleted += deleteResponse.Deleted.length;
        console.log(`✅ Deleted ${deleteResponse.Deleted.length} objects`);
      }

      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        console.error('❌ Some objects failed to delete:');
        deleteResponse.Errors.forEach(error => {
          console.error(`   - ${error.Key}: ${error.Code} - ${error.Message}`);
        });
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    console.log(`✅ R2 bucket cleanup completed. Total objects deleted: ${totalDeleted}`);
    return true;

  } catch (error) {
    console.error('❌ Error clearing R2 bucket:', error.message);
    return false;
  }
}

/**
 * Clear all collections from MongoDB database
 */
async function clearMongoDB() {
  console.log('\n🗑️  Starting MongoDB cleanup...');
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not configured');
    return false;
  }

  let client;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    
    await client.connect();
    console.log('🔌 Connected to MongoDB');
    
    const db = client.db('filestores');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`📁 Found ${collections.length} collections`);
    
    if (collections.length === 0) {
      console.log('✅ No collections found in database');
      return true;
    }

    // Drop each collection
    for (const collection of collections) {
      const collectionName = collection.name;
      try {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`🔄 Dropping collection '${collectionName}' (${count} documents)...`);
        
        await db.collection(collectionName).drop();
        console.log(`✅ Dropped collection '${collectionName}'`);
      } catch (error) {
        if (error.code === 26) { // NamespaceNotFound error
          console.log(`⚠️  Collection '${collectionName}' doesn't exist, skipping`);
        } else {
          console.error(`❌ Error dropping collection '${collectionName}':`, error.message);
        }
      }
    }

    // Also clear mongoose connection if it exists
    if (mongoose.connections[0].readyState) {
      await mongoose.connection.dropDatabase();
      console.log('✅ Cleared mongoose database connection');
    }

    console.log('✅ MongoDB cleanup completed');
    return true;

  } catch (error) {
    console.error('❌ Error clearing MongoDB:', error.message);
    return false;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

/**
 * Confirmation prompt
 */
function askConfirmation() {
  return new Promise((resolve) => {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('\n⚠️  This will PERMANENTLY DELETE all files from R2 bucket and all data from MongoDB!\nAre you sure you want to continue? (type "yes" to confirm): ', (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Main cleanup function
 */
async function main() {
  console.log('🧹 FileStores Cleanup Utility');
  console.log('===============================');
  
  // Show current configuration
  console.log('\n📋 Current Configuration:');
  console.log(`   R2 Endpoint: ${process.env.CLOUDFLARE_R2_ENDPOINT || 'NOT SET'}`);
  console.log(`   R2 Bucket: ${BUCKET_NAME || 'NOT SET'}`);
  console.log(`   MongoDB: ${MONGODB_URI ? 'CONFIGURED' : 'NOT SET'}`);

  // Get confirmation
  const confirmed = await askConfirmation();
  
  if (!confirmed) {
    console.log('\n❌ Cleanup cancelled by user');
    process.exit(0);
  }

  console.log('\n🚀 Starting cleanup process...');
  
  // Perform cleanup
  const r2Success = await clearR2Bucket();
  const mongoSuccess = await clearMongoDB();
  
  // Summary
  console.log('\n📊 Cleanup Summary:');
  console.log(`   R2 Bucket: ${r2Success ? '✅ CLEARED' : '❌ FAILED'}`);
  console.log(`   MongoDB: ${mongoSuccess ? '✅ CLEARED' : '❌ FAILED'}`);
  
  if (r2Success && mongoSuccess) {
    console.log('\n🎉 All cleanup operations completed successfully!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some cleanup operations failed. Please check the errors above.');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled Rejection:', error.message);
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  console.error('\n💥 Fatal Error:', error.message);
  process.exit(1);
});
