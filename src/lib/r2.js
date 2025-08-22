import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

export async function deleteFromR2(key) {
  try {
    // Remove leading slash if present
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    
    const command = new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: cleanKey,
    });

    await r2Client.send(command);
    console.log(`Successfully deleted ${cleanKey} from R2`);
  } catch (error) {
    console.error(`Error deleting ${key} from R2:`, error);
    throw error;
  }
}

export default r2Client;
