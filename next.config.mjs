/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['react', 'react-dom'],
  },
  serverExternalPackages: ['mongoose', 'mongodb'],
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'filestore-bucket.f48c3feb11177cca252f419459bc269a.r2.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'production' 
              ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev https://filestore-bucket.f48c3feb11177cca252f419459bc269a.r2.cloudflarestorage.com; connect-src 'self' https://filestore-bucket.f48c3feb11177cca252f419459bc269a.r2.cloudflarestorage.com; font-src 'self'; object-src 'none'; media-src 'self' blob: https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev https://filestore-bucket.f48c3feb11177cca252f419459bc269a.r2.cloudflarestorage.com; worker-src 'self'; child-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self';"
              : "default-src 'self' 'unsafe-eval' 'unsafe-inline'; img-src 'self' data: blob: https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev https://filestore-bucket.f48c3feb11177cca252f419459bc269a.r2.cloudflarestorage.com; connect-src 'self' ws: wss: https://filestore-bucket.f48c3feb11177cca252f419459bc269a.r2.cloudflarestorage.com; media-src 'self' blob: https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev https://filestore-bucket.f48c3feb11177cca252f419459bc269a.r2.cloudflarestorage.com;"
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
