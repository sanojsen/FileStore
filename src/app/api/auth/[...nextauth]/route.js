import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { User } from '../../../../models/User';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await User.findByEmail(credentials.email);
          if (!user) {
            return null;
          }

          const isValidPassword = await User.validatePassword(
            credentials.password,
            user.password
          );

          if (!isValidPassword) {
            return null;
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: process.env.NODE_ENV === 'production' ? 7 * 24 * 60 * 60 : 30 * 24 * 60 * 60, // 7 days in prod, 30 days in dev
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  jwt: {
    maxAge: process.env.NODE_ENV === 'production' ? 7 * 24 * 60 * 60 : 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: '/',
    signUp: '/register',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Add timestamp for token validation
        token.iat = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        // Validate token age for security
        const tokenAge = Math.floor(Date.now() / 1000) - (token.iat || 0);
        const maxAge = process.env.NODE_ENV === 'production' ? 7 * 24 * 60 * 60 : 30 * 24 * 60 * 60;
        
        if (tokenAge > maxAge) {
          throw new Error('Token expired');
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // User signed in
    },
    async signOut({ token }) {
      // User signed out
    }
  },
};
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
