// Test script for various file type date extraction
const fs = require('fs');
const path = require('path');

// Mock function to simulate our new extraction logic
async function extractCreationDate(buffer, mimeType, fileName) {
  let creationDate = null;
  
  try {
    // PDF files
    if (mimeType === 'application/pdf') {
      const pdfText = buffer.toString('binary', 0, Math.min(buffer.length, 2048));
      const creationDateMatch = pdfText.match(/\/CreationDate\s*\(D:(\d{14})/);
      if (creationDateMatch) {
        const dateStr = creationDateMatch[1];
        const year = parseInt(dateStr.substr(0, 4));
        const month = parseInt(dateStr.substr(4, 2)) - 1;
        const day = parseInt(dateStr.substr(6, 2));
        const hour = parseInt(dateStr.substr(8, 2));
        const minute = parseInt(dateStr.substr(10, 2));
        const second = parseInt(dateStr.substr(12, 2));
        
        creationDate = new Date(year, month, day, hour, minute, second);
      }
    }
    
    // Text files
    else if (mimeType.startsWith('text/') || mimeType.includes('javascript') || 
             mimeType.includes('json') || mimeType.includes('xml')) {
      const textContent = buffer.toString('utf-8', 0, Math.min(buffer.length, 2048));
      
      const timestampPatterns = [
        /Created?:?\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
        /Date:?\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
        /"created":\s*"([^"]+)"/i
      ];
      
      for (const pattern of timestampPatterns) {
        const match = textContent.match(pattern);
        if (match) {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            creationDate = date;
            break;
          }
        }
      }
    }
    
  } catch (error) {
    console.warn(`Error extracting creation date for ${fileName}:`, error);
  }
  
  return creationDate;
}

// Test cases
const testFiles = [
  {
    name: 'document.pdf',
    mimeType: 'application/pdf',
    content: '%PDF-1.4\n/CreationDate (D:20230715143025+00\'00\')\n/Title (Test Document)'
  },
  {
    name: 'config.json',
    mimeType: 'application/json', 
    content: '{"name": "test", "created": "2023-12-25T09:30:00Z", "version": "1.0"}'
  },
  {
    name: 'readme.txt',
    mimeType: 'text/plain',
    content: '# Project Documentation\nCreated: 2024-01-15\nThis is a test file.'
  },
  {
    name: 'script.js',
    mimeType: 'text/javascript',
    content: '/**\n * Created Date: 2023/08/20\n * @author Test User\n */\nconsole.log("Hello");'
  }
];

console.log('=== File Type Date Extraction Test Results ===\n');

testFiles.forEach(async (testFile, index) => {
  const buffer = Buffer.from(testFile.content, 'utf-8');
  const extractedDate = await extractCreationDate(buffer, testFile.mimeType, testFile.name);
  
  console.log(`Test ${index + 1}: ${testFile.name} (${testFile.mimeType})`);
  if (extractedDate) {
    console.log(`✅ Extracted Date: ${extractedDate.toISOString()}`);
  } else {
    console.log(`❌ No date found - will fall back to file system date`);
  }
  console.log('---\n');
});
