# Vercel Deployment Guide for FileStores

## Pre-deployment Checklist

### 1. Environment Variables
Set these in Vercel dashboard:
```
CLOUDFLARE_R2_ENDPOINT=your_endpoint
CLOUDFLARE_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_BUCKET_NAME=your_bucket_name
CLOUDFLARE_PUBLIC_URL=your_public_url
MONGODB_URI=your_mongodb_connection_string
NEXTAUTH_URL=your_vercel_domain
NEXTAUTH_SECRET=your_secret_key
```

### 2. Vercel Configuration
Create `vercel.json` with optimized settings:

### 3. Build Configuration
- Next.js 15.5.0 ✅ (Supported)
- Turbopack ✅ (Supported)
- Node.js runtime ✅ (Default)

### 4. File Size Limitations
- Modified to 4MB max file size (from 1GB)
- For larger files, implement direct R2 uploads with presigned URLs

### 5. Database Setup
- MongoDB Atlas Free Tier (512MB) ✅
- Consider upgrading if you need more storage

### 6. Bandwidth Considerations
- Vercel: 100GB/month
- Cloudflare R2: Pay-as-you-go (very cheap)
- MongoDB Atlas: Limited on free tier

## Deployment Steps

1. **Push to GitHub**
2. **Connect to Vercel**
3. **Set Environment Variables**
4. **Deploy**

## Performance Optimizations for Free Tier

1. **Image Optimization** - Next.js handles this
2. **Client-side Processing** - Thumbnails generated in browser
3. **External Storage** - Cloudflare R2 for files
4. **Caching** - Built-in Vercel caching

## Upgrade Considerations

When you outgrow free tier:
- **Vercel Pro ($20/month)**: 100MB request limit, 60s function timeout
- **MongoDB Atlas Shared ($9/month)**: More storage and bandwidth
- **Cloudflare R2**: Always pay-as-you-go (very affordable)
