# FileStores Setup Guide

## Prerequisites
1. MongoDB database (local or MongoDB Atlas)
2. Cloudflare R2 bucket for file storage
3. Node.js and npm installed

## Environment Configuration

1. Copy the `.env.example` file to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Configure your environment variables in `.env.local`:

### MongoDB Setup
- **Local MongoDB**: Use `mongodb://localhost:27017/filestores`
- **MongoDB Atlas**: Get your connection string from Atlas dashboard

### NextAuth Configuration
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
```
Generate a secret key with: `openssl rand -base64 32`

### Cloudflare R2 Setup
1. Create a Cloudflare account and R2 bucket
2. Generate API tokens with R2 permissions
3. Configure the environment variables:
```env
CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=your-bucket-name
CLOUDFLARE_R2_PUBLIC_URL=https://your-custom-domain.com
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your `.env.local` file with the above settings

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 and sign up/login

5. Upload some photos/videos to test the thumbnail generation

## Features
- Google Photos-style interface
- Automatic thumbnail generation for images and videos
- File upload with metadata extraction
- Organized by date (upload date or date taken)
- Fallback icons for non-media files

## Troubleshooting

### No thumbnails showing
1. Check MongoDB connection in `.env.local`
2. Verify Cloudflare R2 configuration
3. Ensure files have been uploaded through the upload page

### Authentication issues
1. Verify `NEXTAUTH_URL` and `NEXTAUTH_SECRET` in `.env.local`
2. Clear browser cookies and try again

### Upload failures
1. Check Cloudflare R2 credentials and bucket permissions
2. Verify bucket CORS settings allow uploads from your domain
