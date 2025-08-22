import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware(req) {
    // Additional logic can be added here if needed
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Return true if user has a valid token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ['/dashboard/:path*', '/upload/:path*', '/files/:path*'],
};
