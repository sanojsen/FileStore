const AWS = require('aws-sdk');
require('dotenv').config({ path: '.env.local' });

// Configure R2 client
const r2 = new AWS.S3({
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: 'auto',
  signatureVersion: 'v4',
});

async function clearR2Bucket() {
  try {
    const bucketName = process.env.R2_BUCKET_NAME;
    console.log(`🗑️  Starting R2 bucket cleanup for: ${bucketName}`);
    
    // List all objects in the bucket
    const listParams = {
      Bucket: bucketName,
      MaxKeys: 1000 // Process in batches
    };
    
    let totalDeleted = 0;
    let continuationToken = null;
    
    do {
      if (continuationToken) {
        listParams.ContinuationToken = continuationToken;
      }
      
      const listResult = await r2.listObjectsV2(listParams).promise();
      
      if (listResult.Contents && listResult.Contents.length > 0) {
        console.log(`📋 Found ${listResult.Contents.length} objects to delete...`);
        
        // Prepare delete parameters
        const deleteParams = {
          Bucket: bucketName,
          Delete: {
            Objects: listResult.Contents.map(obj => ({ Key: obj.Key })),
            Quiet: false
          }
        };
        
        // Delete objects
        const deleteResult = await r2.deleteObjects(deleteParams).promise();
        
        if (deleteResult.Deleted) {
          totalDeleted += deleteResult.Deleted.length;
          console.log(`✅ Deleted ${deleteResult.Deleted.length} objects`);
          
          // Log first few deleted objects
          deleteResult.Deleted.slice(0, 3).forEach(obj => {
            console.log(`   - ${obj.Key}`);
          });
          if (deleteResult.Deleted.length > 3) {
            console.log(`   ... and ${deleteResult.Deleted.length - 3} more`);
          }
        }
        
        if (deleteResult.Errors && deleteResult.Errors.length > 0) {
          console.log('❌ Some deletions failed:');
          deleteResult.Errors.forEach(error => {
            console.log(`   - ${error.Key}: ${error.Message}`);
          });
        }
      }
      
      continuationToken = listResult.NextContinuationToken;
      
    } while (continuationToken);
    
    console.log(`🎉 R2 bucket cleared successfully! Total objects deleted: ${totalDeleted}`);
    
  } catch (error) {
    console.error('❌ Error clearing R2 bucket:', error);
  }
}

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('⚠️  Are you sure you want to DELETE ALL FILES from the R2 bucket? Type "yes" to confirm: ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    clearR2Bucket();
  } else {
    console.log('❌ Operation cancelled.');
  }
  rl.close();
});
