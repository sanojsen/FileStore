import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    
    // Add mobile-specific headers
    const response = NextResponse.next();
    
    // Add mobile viewport headers
    response.headers.set('X-UA-Compatible', 'IE=edge');
    response.headers.set('viewport', 'width=device-width, initial-scale=1, shrink-to-fit=no');
    
    // Handle PWA requests
    if (pathname === '/manifest.json' || pathname === '/sw.js') {
      response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    }
    
    // Add security headers for mobile
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Allow public routes
        if (pathname === '/' || pathname === '/register' || pathname.startsWith('/api/auth/')) {
          return true;
        }
        
        // Require authentication for protected routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)',
  ],
};
