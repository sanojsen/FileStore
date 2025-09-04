# 🚀 Vercel Deployment Guide - FIXED FOR HOBBY PLAN

## ⚡ Issues Fixed for Hobby Plan

✅ **Applied these fixes:**
- ❌ Removed `"regions": ["iad1", "sfo1", "lhr1"]` from vercel.json (Pro feature)
- ✅ Reduced function timeout from 30s to 10s (Hobby plan limit)
- ✅ Fixed NextAuth cookie domain configuration
- ✅ Removed standalone output config

## 📋 Quick Deployment Steps

### 1. Set Environment Variables in Vercel Dashboard

**CRITICAL**: You must set these in your Vercel project settings:

```bash
# Database
MONGODB_URI=mongodb+srv://sanojsen:vBcgZHntDVS8TogY@filestorecluster.krgdmtn.mongodb.net/filestores?retryWrites=true&w=majority&appName=filestorecluster&ssl=true

# NextAuth - UPDATE THIS URL TO YOUR ACTUAL VERCEL DOMAIN!
NEXTAUTH_URL=https://your-project-name.vercel.app
NEXTAUTH_SECRET=L-gCA3qJgFbGiu5ALh6w17CLP-m7G8O5peX7sYxJ-nextauth-secret-2025

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=f48c3feb11177cca252f419459bc269a
CLOUDFLARE_ACCESS_KEY_ID=b8b603ccc222514a74a374c56089fb20
CLOUDFLARE_SECRET_ACCESS_KEY=463fbe8d771609906004ade77d8abe8233bdb3fea713d9750cdf1175d214a000
CLOUDFLARE_BUCKET_NAME=filestore-bucket
CLOUDFLARE_R2_ENDPOINT=https://f48c3feb11177cca252f419459bc269a.r2.cloudflarestorage.com
CLOUDFLARE_PUBLIC_URL=https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev
NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL=https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev
```

### 2. Deploy

#### Option A: GitHub Integration (Recommended)
1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Vercel will auto-deploy

#### Option B: Vercel CLI
```bash
npx vercel --prod
```

### 3. Post-Deployment
1. **Update NEXTAUTH_URL** in Vercel env vars to your actual domain
2. **Redeploy** after updating NEXTAUTH_URL
3. **Test authentication** on your live site

## ✅ Your app is now Hobby plan compatible!

The deployment should now work without the "multiple regions" error.

---
**Need help?** Check the MongoDB Atlas IP whitelist and R2 CORS settings.
