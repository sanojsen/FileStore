// Direct test of our date extraction logic
const fs = require('fs');
const path = require('path');

// Import the extractCreationDate function logic (simplified version)
function extractCreationDate(fileContent, fileName, mimeType) {
  const fileExt = path.extname(fileName).toLowerCase();
  
  console.log(`🔍 Analyzing ${fileName} (${fileExt})`);
  
  // PDF files
  if (fileExt === '.pdf' || mimeType?.includes('pdf')) {
    try {
      const pdfText = fileContent.toString('latin1');
      console.log('📄 Checking PDF content...');
      
      // Look for /CreationDate
      const creationMatch = pdfText.match(/\/CreationDate\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
      if (creationMatch) {
        const [, year, month, day, hour, minute, second] = creationMatch;
        const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
        console.log(`✅ Found PDF creation date: ${dateStr}`);
        return { createdAt: dateStr, dateSource: 'pdf_metadata' };
      }
      
      // Look for simpler date pattern
      const simpleDateMatch = pdfText.match(/\/CreationDate\s*\(D:(\d{4})(\d{2})(\d{2})/);
      if (simpleDateMatch) {
        const [, year, month, day] = simpleDateMatch;
        const dateStr = `${year}-${month}-${day}T00:00:00.000Z`;
        console.log(`✅ Found PDF date (simple): ${dateStr}`);
        return { createdAt: dateStr, dateSource: 'pdf_metadata' };
      }
    } catch (error) {
      console.log('⚠️  PDF parsing error:', error.message);
    }
  }
  
  // Text-based files (JSON, JS, TXT, MD, etc.)
  if (['.json', '.js', '.txt', '.md', '.log'].includes(fileExt)) {
    try {
      const content = fileContent.toString('utf8');
      console.log('📝 Checking text content...');
      
      const datePatterns = [
        // ISO datetime with Z
        /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)/g,
        // ISO datetime
        /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/g,
        // Date with various prefixes
        /(?:created?|date[a-z]*|timestamp)\\s*:?\\s*[\"']?(\d{4}-\d{2}-\d{2})/gi,
        // Simple date pattern
        /(\d{4}-\d{2}-\d{2})/g
      ];
      
      for (let i = 0; i < datePatterns.length; i++) {
        const pattern = datePatterns[i];
        const match = content.match(pattern);
        if (match) {
          let dateStr = match[0];
          
          // Extract just the date part if it's a complex match
          if (dateStr.includes(':')) {
            // It's a full datetime
            if (!dateStr.endsWith('Z')) {
              dateStr += 'Z';
            }
          } else {
            // It's just a date, add time
            dateStr = dateStr + 'T00:00:00.000Z';
          }
          
          console.log(`✅ Found text date (pattern ${i + 1}): ${dateStr}`);
          return { createdAt: dateStr, dateSource: 'content_parsing' };
        }
      }
    } catch (error) {
      console.log('⚠️  Text parsing error:', error.message);
    }
  }
  
  console.log('❌ No date found in content');
  return { createdAt: null, dateSource: 'not_found' };
}

async function testFiles() {
  console.log('🧪 Testing Date Extraction Logic\n');
  
  const testFiles = [
    './test-files/test-document.pdf',
    './test-files/test-config.json',
    './test-files/test-script.js',
    './test-files/test-document.md',
    './test-files/test-log.txt'
  ];
  
  for (const filePath of testFiles) {
    console.log(`\n${'='.repeat(50)}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      continue;
    }
    
    try {
      const fileContent = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      
      const result = extractCreationDate(fileContent, fileName);
      
      console.log(`📊 Result for ${fileName}:`);
      console.log(`   📅 createdAt: ${result.createdAt || 'Not extracted'}`);
      console.log(`   📝 dateSource: ${result.dateSource}`);
      
      if (result.createdAt) {
        console.log('   ✅ EXTRACTION SUCCESS');
      } else {
        console.log('   ❌ EXTRACTION FAILED');
      }
      
    } catch (error) {
      console.log(`❌ Error processing ${filePath}:`, error.message);
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log('🏁 Test completed!');
}

testFiles();
