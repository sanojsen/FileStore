const fs = require('fs').promises;
const path = require('path');

async function removeConsoleLogsFromFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Remove console.log statements but keep console.error and console.warn
    const cleanedContent = content
      .replace(/^\s*console\.log\([^;]*\);?\s*$/gm, '') // Remove standalone console.log lines
      .replace(/\s*console\.log\([^;]*\);/g, '') // Remove inline console.log statements
      .replace(/^\s*$/gm, '') // Remove empty lines
      .replace(/\n\n+/g, '\n\n'); // Reduce multiple empty lines to single empty line
    
    if (content !== cleanedContent) {
      await fs.writeFile(filePath, cleanedContent);
      console.log(`✅ Cleaned console.log from: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
  return false;
}

async function cleanConsoleLogsFromDirectory(dirPath) {
  try {
    const items = await fs.readdir(dirPath);
    let cleanedFiles = 0;
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        cleanedFiles += await cleanConsoleLogsFromDirectory(fullPath);
      } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx'))) {
        // Skip service worker and other important files that need console.log
        if (!item.includes('sw.js') && !item.includes('ServiceWorker')) {
          if (await removeConsoleLogsFromFile(fullPath)) {
            cleanedFiles++;
          }
        }
      }
    }
    
    return cleanedFiles;
  } catch (error) {
    console.error(`❌ Error reading directory ${dirPath}:`, error.message);
    return 0;
  }
}

async function main() {
  console.log('🧹 Starting console.log cleanup...\n');
  
  const srcDir = path.join(process.cwd(), 'src');
  const cleanedFiles = await cleanConsoleLogsFromDirectory(srcDir);
  
  console.log(`\n🎉 Cleanup complete! Cleaned ${cleanedFiles} files.`);
  console.log('ℹ️  Note: console.error and console.warn statements were preserved.');
}

main();
