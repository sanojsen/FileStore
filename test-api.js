// Simple API test using Node.js built-in fetch (Node 18+)
const fs = require('fs');
const path = require('path');

async function testMetadataAPI() {
  console.log('🧪 Testing Metadata Extraction API\n');
  
  const testFiles = [
    './test-files/test-config.json',
    './test-files/test-document.pdf',
    './test-files/test-script.js',
    './test-files/test-log.txt'
  ];
  
  for (const filePath of testFiles) {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      continue;
    }
    
    console.log(`📄 Testing: ${path.basename(filePath)}`);
    
    try {
      // Create form data manually
      const fileContent = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      
      // Create a simple multipart form data
      const boundary = '----formdata-boundary-' + Math.random().toString(16);
      const formData = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
        'Content-Type: application/octet-stream',
        '',
        fileContent.toString('binary'),
        `--${boundary}--`
      ].join('\r\n');
      
      const response = await fetch('http://localhost:3000/api/upload/extract-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(formData)
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Response:');
        console.log(`   📅 createdAt: ${result.createdAt || 'Not extracted'}`);
        console.log(`   📝 dateSource: ${result.dateSource || 'Unknown'}`);
        console.log('');
      } else {
        const errorText = await response.text();
        console.log(`❌ API Error (${response.status}):`, errorText);
        console.log('');
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      console.log('');
    }
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ This script requires Node.js 18+ with built-in fetch');
  console.log('Current Node version:', process.version);
} else {
  testMetadataAPI().catch(console.error);
}
