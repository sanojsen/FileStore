# 📁 FileStores - Secure File Management System

A modern, secure file management system built with Next.js 15, featuring cloud storage, thumbnail generation, and PWA capabilities.

## ✨ Features

- 🔐 **Secure Authentication** - NextAuth with MongoDB
- ☁️ **Cloud Storage** - Cloudflare R2 integration
- 🖼️ **Smart Thumbnails** - Client-side thumbnail generation
- 📱 **PWA Ready** - Installable as mobile/desktop app
- 🗂️ **File Organization** - Date-based grouping using EXIF data
- 📤 **Drag & Drop Upload** - Modern upload interface
- 🔍 **File Search & Filter** - Advanced file management
- 📊 **Real-time Progress** - Upload progress tracking

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB Atlas account
- Cloudflare R2 storage account

### Installation

1. **Clone and install:**
```bash
git clone <repository-url>
cd filestores
npm install
```

2. **Environment Setup:**
Copy `.env.example` to `.env.local` and configure:
```bash
# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Database
MONGODB_URI=mongodb+srv://...

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_SECRET_ACCESS_KEY=your-secret-key  
CLOUDFLARE_BUCKET_NAME=your-bucket-name
CLOUDFLARE_PUBLIC_URL=https://pub-xxx.r2.dev
```

3. **Start Development:**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app!

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Main file management
│   ├── upload/            # File upload interface
│   └── layout.js          # Root layout with PWA
├── components/            # Reusable React components
├── lib/                   # Utilities and integrations
└── models/                # Database models
```

## 🛠️ Technology Stack

- **Framework:** Next.js 15 with Turbopack
- **Authentication:** NextAuth.js
- **Database:** MongoDB with Mongoose
- **Storage:** Cloudflare R2 (S3-compatible)
- **Styling:** Tailwind CSS
- **PWA:** Service Workers + Web App Manifest
- **File Processing:** Sharp, EXIFR, Canvas API

## 📦 Key Dependencies

- `next` - React framework
- `next-auth` - Authentication
- `mongodb` & `mongoose` - Database
- `@aws-sdk/client-s3` - R2 storage client
- `sharp` - Image processing
- `exifr` - EXIF data extraction
- `tailwindcss` - Styling

## 🎯 Deployment

### Vercel (Recommended)

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### Manual Build

```bash
npm run build
npm start
```

## 🔧 Development Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production  
npm start       # Start production server
npm run lint    # Run ESLint
```

## 📱 PWA Features

- **Offline Support** - Service worker caching
- **Install Prompt** - Add to home screen
- **Background Sync** - Upload sync when online
- **Push Notifications** - Ready for implementation

## 🔒 Security Features

- JWT-based authentication
- Secure file uploads with validation
- Environment variable protection
- Input sanitization and validation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is private and proprietary.

---

Built with ❤️ using modern web technologies

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
