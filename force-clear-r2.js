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

const bucketName = process.env.CLOUDFLARE_BUCKET_NAME;

async function cleanupMultipartUploads() {
  console.log('🧹 Cleaning up incomplete multipart uploads...');
  
  try {
    const listParams = {
      Bucket: bucketName
    };
    
    const result = await r2.listMultipartUploads(listParams).promise();
    
    if (result.Uploads && result.Uploads.length > 0) {
      console.log(`   Found ${result.Uploads.length} incomplete multipart uploads`);
      
      for (const upload of result.Uploads) {
        console.log(`   Aborting upload: ${upload.Key}`);
        
        await r2.abortMultipartUpload({
          Bucket: bucketName,
          Key: upload.Key,
          UploadId: upload.UploadId
        }).promise();
      }
      
      console.log(`   ✅ Aborted ${result.Uploads.length} multipart uploads`);
    } else {
      console.log('   ✅ No incomplete multipart uploads found');
    }
    
  } catch (error) {
    console.error('   ❌ Error cleaning multipart uploads:', error.message);
  }
}

async function cleanupVersionedObjects() {
  console.log('🔄 Cleaning up versioned objects...');
  
  try {
    let continuationToken = null;
    let totalVersionsDeleted = 0;
    
    do {
      const listParams = {
        Bucket: bucketName,
        MaxKeys: 1000,
        ...(continuationToken && { KeyMarker: continuationToken })
      };
      
      const result = await r2.listObjectVersions(listParams).promise();
      
      if (result.Versions && result.Versions.length > 0) {
        console.log(`   Found ${result.Versions.length} object versions`);
        
        const deleteParams = {
          Bucket: bucketName,
          Delete: {
            Objects: result.Versions.map(version => ({
              Key: version.Key,
              VersionId: version.VersionId
            })),
            Quiet: true
          }
        };
        
        const deleteResult = await r2.deleteObjects(deleteParams).promise();
        
        if (deleteResult.Deleted) {
          totalVersionsDeleted += deleteResult.Deleted.length;
          console.log(`   ✅ Deleted ${deleteResult.Deleted.length} versions`);
        }
      }
      
      // Check for delete markers
      if (result.DeleteMarkers && result.DeleteMarkers.length > 0) {
        console.log(`   Found ${result.DeleteMarkers.length} delete markers`);
        
        const deleteParams = {
          Bucket: bucketName,
          Delete: {
            Objects: result.DeleteMarkers.map(marker => ({
              Key: marker.Key,
              VersionId: marker.VersionId
            })),
            Quiet: true
          }
        };
        
        const deleteResult = await r2.deleteObjects(deleteParams).promise();
        
        if (deleteResult.Deleted) {
          totalVersionsDeleted += deleteResult.Deleted.length;
          console.log(`   ✅ Deleted ${deleteResult.Deleted.length} delete markers`);
        }
      }
      
      continuationToken = result.NextKeyMarker;
      
    } while (continuationToken);
    
    if (totalVersionsDeleted > 0) {
      console.log(`   ✅ Total versioned objects deleted: ${totalVersionsDeleted}`);
    } else {
      console.log('   ✅ No versioned objects found');
    }
    
  } catch (error) {
    if (error.code === 'NotImplemented') {
      console.log('   ℹ️  Object versioning not enabled on this bucket');
    } else {
      console.error('   ❌ Error cleaning versioned objects:', error.message);
    }
  }
}

async function forceDeleteAllObjects() {
  console.log('💪 Force deleting all objects with extended cleanup...');
  
  try {
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
        
        // Log some object details for debugging
        listResult.Contents.slice(0, 5).forEach((obj, idx) => {
          console.log(`      ${idx + 1}. ${obj.Key} (${(obj.Size / (1024*1024)).toFixed(2)} MB)`);
        });
        
        if (listResult.Contents.length > 5) {
          console.log(`      ... and ${listResult.Contents.length - 5} more objects`);
        }
        
        const deleteParams = {
          Bucket: bucketName,
          Delete: {
            Objects: listResult.Contents.map(obj => ({ Key: obj.Key })),
            Quiet: false // Don't use quiet mode to see any errors
          }
        };
        
        const deleteResult = await r2.deleteObjects(deleteParams).promise();
        
        if (deleteResult.Deleted) {
          totalDeleted += deleteResult.Deleted.length;
          console.log(`   ✅ Successfully deleted ${deleteResult.Deleted.length} files`);
        }
        
        if (deleteResult.Errors && deleteResult.Errors.length > 0) {
          console.log(`   ❌ ${deleteResult.Errors.length} deletion errors:`);
          deleteResult.Errors.forEach(error => {
            console.log(`      - ${error.Key}: ${error.Code} - ${error.Message}`);
          });
        }
      }
      
      continuationToken = listResult.NextContinuationToken;
      
    } while (continuationToken);
    
    console.log(`   ✅ Total objects deleted: ${totalDeleted}`);
    
  } catch (error) {
    console.error('   ❌ Error in force delete:', error.message);
  }
}

async function comprehensiveCleanup() {
  try {
    console.log('🚀 Starting comprehensive R2 bucket cleanup...\n');
    
    // Step 1: Clean up incomplete multipart uploads
    await cleanupMultipartUploads();
    console.log('');
    
    // Step 2: Clean up versioned objects (if versioning is enabled)
    await cleanupVersionedObjects();
    console.log('');
    
    // Step 3: Force delete all remaining objects
    await forceDeleteAllObjects();
    console.log('');
    
    // Step 4: Final verification
    console.log('🔍 Final verification...');
    const listResult = await r2.listObjectsV2({ Bucket: bucketName }).promise();
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      console.log('✅ Bucket is completely empty!');
      console.log('📊 Note: Cloudflare dashboard may take 5-15 minutes to update usage statistics');
    } else {
      console.log(`⚠️  Still found ${listResult.Contents.length} objects in bucket`);
      console.log('   This might require manual intervention in Cloudflare dashboard');
    }
    
  } catch (error) {
    console.error('💥 Comprehensive cleanup failed:', error.message);
  }
}

// Run the comprehensive cleanup
comprehensiveCleanup();
