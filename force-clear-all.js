const { MongoClient } = require('mongodb');
const AWS = require('aws-sdk');
require('dotenv').config({ path: '.env.local' });

// Configure R2 client
const r2 = new AWS.S3({
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  region: 'auto',
  signatureVersion: 'v4',
});

async function clearDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('🗑️  Clearing MongoDB database...');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`   Found ${collections.length} collections:`, collections.map(c => c.name));
    
    // Clear each collection
    let totalDeleted = 0;
    for (const collection of collections) {
      const result = await db.collection(collection.name).deleteMany({});
      totalDeleted += result.deletedCount;
      console.log(`   ✅ ${collection.name}: ${result.deletedCount} documents deleted`);
    }
    
    console.log(`🎉 Database cleared! Total documents deleted: ${totalDeleted}`);
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    await client.close();
  }
}

async function clearR2Bucket() {
  try {
    const bucketName = process.env.CLOUDFLARE_BUCKET_NAME;
    console.log(`🗑️  Clearing R2 bucket: ${bucketName}...`);
    
    let totalDeleted = 0;
    let continuationToken = null;
    
    do {
      const listParams = {
        Bucket: bucketName,
        MaxKeys: 1000,
        ...(continuationToken && { ContinuationToken: continuationToken })
      };
      
      const listResult = await r2.listObjectsV2(listParams).promise();
      
      if (listResult.Contents && listResult.Contents.length > 0) {
        console.log(`   📋 Processing ${listResult.Contents.length} objects...`);
        
        const deleteParams = {
          Bucket: bucketName,
          Delete: {
            Objects: listResult.Contents.map(obj => ({ Key: obj.Key })),
            Quiet: true
          }
        };
        
        const deleteResult = await r2.deleteObjects(deleteParams).promise();
        
        if (deleteResult.Deleted) {
          totalDeleted += deleteResult.Deleted.length;
          console.log(`   ✅ Deleted ${deleteResult.Deleted.length} files`);
        }
        
        if (deleteResult.Errors && deleteResult.Errors.length > 0) {
          console.log(`   ❌ ${deleteResult.Errors.length} deletion errors`);
        }
      }
      
      continuationToken = listResult.NextContinuationToken;
      
    } while (continuationToken);
    
    console.log(`🎉 R2 bucket cleared! Total files deleted: ${totalDeleted}`);
    
  } catch (error) {
    console.error('❌ Error clearing R2 bucket:', error);
    throw error;
  }
}

async function clearAll() {
  try {
    console.log('🔥 FORCE CLEARING ALL DATA - NO CONFIRMATION REQUIRED');
    console.log('🚀 Starting complete cleanup...\n');
    
    // Clear database first
    await clearDatabase();
    console.log('');
    
    // Then clear R2 bucket
    await clearR2Bucket();
    console.log('');
    
    console.log('✨ Complete cleanup finished successfully!');
    console.log('🎯 You now have a fresh, empty system ready for new uploads.');
    
  } catch (error) {
    console.error('💥 Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run immediately without confirmation
clearAll();
