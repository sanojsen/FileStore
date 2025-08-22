// Simple script to test URL accessibility
const testUrls = [
  'https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev/',
  'https://pub-bdab05697f9f4c00b9db07779b146ba1.r2.dev/uploads/68a7db21902bfe92ad4f8e28/2025/08/22/thumbnails/a1085fb4-4b05-4f83-a5f3-6127518f7534_thumb.jpg'
];

async function testUrl(url) {
  try {
    console.log(`Testing: ${url}`);
    const response = await fetch(url, { method: 'HEAD' });
    console.log(`Status: ${response.status} - ${response.statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
    return response.ok;
  } catch (error) {
    console.error(`Error accessing ${url}:`, error.message);
    return false;
  }
}

async function testAllUrls() {
  console.log('Testing Cloudflare R2 URLs...\n');
  
  for (const url of testUrls) {
    const isAccessible = await testUrl(url);
    console.log(`Result: ${isAccessible ? '✅ Accessible' : '❌ Not accessible'}\n`);
  }
}

// For browser console
if (typeof window !== 'undefined') {
  window.testR2Urls = testAllUrls;
  console.log('Run testR2Urls() in the browser console to test URLs');
}

// For Node.js
if (typeof module !== 'undefined') {
  module.exports = { testAllUrls };
}

export { testAllUrls };
