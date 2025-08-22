import dotenv from 'dotenv';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

// Load environment variables
dotenv.config({ path: '.env.local' });

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

async function testR2Connection() {
  try {
    console.log('R2 Configuration:');
    console.log('- Endpoint:', process.env.CLOUDFLARE_R2_ENDPOINT);
    console.log('- Bucket:', process.env.CLOUDFLARE_BUCKET_NAME);
    console.log('- Access Key ID:', process.env.CLOUDFLARE_ACCESS_KEY_ID ? 'Set' : 'Not set');
    console.log('- Secret Key:', process.env.CLOUDFLARE_SECRET_ACCESS_KEY ? 'Set' : 'Not set');
    
    // Test listing objects
    console.log('\nTesting R2 connection by listing objects...');
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      MaxKeys: 5,
    });
    
    const listResponse = await r2Client.send(listCommand);
    console.log('✅ R2 connection successful!');
    console.log('Found', listResponse.KeyCount, 'objects');
    
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      console.log('\nSample files in bucket:');
      listResponse.Contents.forEach((obj, index) => {
        console.log(`${index + 1}. ${obj.Key} (${obj.Size} bytes)`);
      });
      
      // Try to fetch a specific file we know exists in database
      const specificKey = 'uploads/68a7db21902bfe92ad4f8e28/2025/08/22/e23fb719-5946-4ce9-978d-48a3603c4ccd.JPG';
      console.log(`\nTesting specific file download: ${specificKey}`);
      
      const getSpecificCommand = new GetObjectCommand({
        Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
        Key: specificKey,
      });
      
      try {
        const getSpecificResponse = await r2Client.send(getSpecificCommand);
        console.log('✅ Specific file download test successful!');
        console.log('Content-Type:', getSpecificResponse.ContentType);
        console.log('Content-Length:', getSpecificResponse.ContentLength);
      } catch (specificError) {
        console.log('❌ Specific file not found:', specificError.name);
        
        // Check if any file matches the pattern
        const listSpecificCommand = new ListObjectsV2Command({
          Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
          Prefix: 'uploads/68a7db21902bfe92ad4f8e28/',
        });
        
        const listSpecificResponse = await r2Client.send(listSpecificCommand);
        console.log('Files for user 68a7db21902bfe92ad4f8e28:');
        listSpecificResponse.Contents?.forEach(obj => {
          console.log(`- ${obj.Key}`);
        });
      }
    } else {
      console.log('No files found in bucket');
    }
    
  } catch (error) {
    console.error('❌ R2 connection failed:', {
      error: error.message,
      name: error.name,
      code: error.Code,
      statusCode: error.$metadata?.httpStatusCode
    });
  }
}

testR2Connection();
