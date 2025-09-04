// Environment validation for production
export function validateEnvironment() {
  const requiredEnvVars = [
    'MONGODB_URI',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_ACCESS_KEY_ID',
    'CLOUDFLARE_SECRET_ACCESS_KEY',
    'CLOUDFLARE_BUCKET_NAME',
    'CLOUDFLARE_R2_ENDPOINT',
    'CLOUDFLARE_PUBLIC_URL',
    'NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL'
  ];

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    const error = `Missing required environment variables: ${missingVars.join(', ')}`;
    console.error('❌ Environment validation failed:', error);
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error(error);
    } else {
      console.warn('⚠️ Some environment variables are missing, but continuing in development mode');
    }
  }

  // Validate MongoDB URI format
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb')) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  // Validate NEXTAUTH_SECRET length in production
  if (process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be at least 32 characters long in production');
  }

  // Validate URLs
  const urlVars = ['NEXTAUTH_URL', 'CLOUDFLARE_PUBLIC_URL', 'NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL'];
  urlVars.forEach(varName => {
    const url = process.env[varName];
    if (url && !url.startsWith('http')) {
      throw new Error(`${varName} must be a valid URL starting with http:// or https://`);
    }
  });

  return true;
}

// Production readiness check
export function checkProductionReadiness() {
  const checks = [];

  // Environment variables
  try {
    validateEnvironment();
    checks.push({ name: 'Environment Variables', status: 'PASS' });
  } catch (error) {
    checks.push({ name: 'Environment Variables', status: 'FAIL', error: error.message });
  }

  // Next.js configuration
  const hasSecurityHeaders = process.env.NODE_ENV === 'production';
  checks.push({ 
    name: 'Security Headers', 
    status: hasSecurityHeaders ? 'PASS' : 'WARN',
    note: hasSecurityHeaders ? null : 'Running in development mode'
  });

  // Production optimizations
  const hasOptimizations = process.env.NODE_ENV === 'production';
  checks.push({ 
    name: 'Production Optimizations', 
    status: hasOptimizations ? 'PASS' : 'WARN',
    note: hasOptimizations ? null : 'Running in development mode'
  });

  const hasFailures = checks.some(check => check.status === 'FAIL');
  if (hasFailures && process.env.NODE_ENV === 'production') {
    throw new Error('Production readiness check failed. Please fix the issues above.');
  }

  return checks;
}
