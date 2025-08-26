/**
 * HEIC Diagnostic Script
 * Run this in the browser console to diagnose HEIC issues
 */

window.HEICDiagnostic = {
  async runFullDiagnostic() {
    console.log('🏥 HEIC Diagnostic Starting...');
    console.log('='.repeat(50));
    
    const results = {
      browserSupport: await this.testBrowserSupport(),
      libraryLoad: await this.testLibraryLoad(),
      moduleSystem: await this.testModuleSystem(),
      fileDetection: this.testFileDetection(),
      canvasSupport: this.testCanvasSupport()
    };
    
    console.log('\n📋 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(50));
    
    Object.entries(results).forEach(([test, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${test}: ${result.message}`);
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    });
    
    // Overall recommendation
    console.log('\n💡 RECOMMENDATIONS:');
    if (!results.libraryLoad.success) {
      console.log('• heic2any library is not loading - check npm install and imports');
    }
    if (!results.browserSupport.success) {
      console.log('• Browser does not support required APIs for HEIC conversion');
    }
    if (!results.canvasSupport.success) {
      console.log('• Canvas API not available - thumbnails cannot be generated');
    }
    
    return results;
  },
  
  async testBrowserSupport() {
    try {
      const checks = {
        fetch: typeof fetch !== 'undefined',
        canvas: typeof HTMLCanvasElement !== 'undefined',
        blob: typeof Blob !== 'undefined',
        file: typeof File !== 'undefined',
        arrayBuffer: Blob.prototype.arrayBuffer !== undefined,
        createObjectURL: URL.createObjectURL !== undefined
      };
      
      const allSupported = Object.values(checks).every(Boolean);
      
      return {
        success: allSupported,
        message: allSupported ? 'All required APIs supported' : 'Some APIs missing',
        details: JSON.stringify(checks)
      };
    } catch (error) {
      return {
        success: false,
        message: 'Browser support test failed',
        details: error.message
      };
    }
  },
  
  async testLibraryLoad() {
    try {
      console.log('📦 Testing heic2any library load...');
      
      // Try multiple import strategies
      const strategies = [
        async () => {
          const module = await import('heic2any');
          return module.default || module;
        },
        async () => {
          const module = await import('heic2any');
          return module.heic2any || module.default || module;
        }
      ];
      
      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`  Trying strategy ${i + 1}...`);
          const heic2any = await strategies[i]();
          
          if (typeof heic2any === 'function') {
            return {
              success: true,
              message: `Library loaded with strategy ${i + 1}`,
              details: `Function available, type: ${typeof heic2any}`,
              library: heic2any
            };
          }
        } catch (error) {
          console.log(`  Strategy ${i + 1} failed:`, error.message);
        }
      }
      
      return {
        success: false,
        message: 'All import strategies failed',
        details: 'heic2any library not accessible'
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Library load test failed',
        details: error.message
      };
    }
  },
  
  async testModuleSystem() {
    try {
      // Test if dynamic imports work at all
      const testModule = await import('react');
      
      return {
        success: !!testModule,
        message: 'Dynamic imports working',
        details: `React loaded: ${!!testModule.default}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Dynamic imports not working',
        details: error.message
      };
    }
  },
  
  testFileDetection() {
    try {
      // Test file detection logic
      const testFiles = [
        { name: 'photo.heic', type: 'image/heic' },
        { name: 'photo.HEIC', type: '' },
        { name: 'photo.heif', type: 'image/heif' },
        { name: 'photo.jpg', type: 'image/jpeg' }
      ];
      
      const results = testFiles.map(file => {
        const isHEIC = this.isHEICFile(file);
        return { file: file.name, detected: isHEIC };
      });
      
      const heicDetected = results.filter(r => r.detected).length;
      
      return {
        success: heicDetected === 3, // Should detect 3 HEIC files
        message: `Detected ${heicDetected}/3 HEIC files correctly`,
        details: JSON.stringify(results)
      };
    } catch (error) {
      return {
        success: false,
        message: 'File detection test failed',
        details: error.message
      };
    }
  },
  
  testCanvasSupport() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Cannot get 2D context');
      }
      
      // Test basic canvas operations
      canvas.width = 100;
      canvas.height = 100;
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 50, 50);
      
      return {
        success: true,
        message: 'Canvas API fully supported',
        details: 'Can create canvas, get context, and draw'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Canvas API not working',
        details: error.message
      };
    }
  },
  
  isHEICFile(file) {
    const mimeType = (file.type || '').toLowerCase();
    const ext = this.getFileExtension(file.name).toLowerCase();
    
    return (
      mimeType === 'image/heic' || 
      mimeType === 'image/heif' ||
      ext === 'heic' || 
      ext === 'heif'
    );
  },
  
  getFileExtension(filename) {
    return filename.split('.').pop() || '';
  },
  
  async testConversion(file) {
    console.log('🧪 Testing HEIC conversion with real file...');
    
    if (!file) {
      console.error('No file provided for conversion test');
      return false;
    }
    
    try {
      const libraryResult = await this.testLibraryLoad();
      if (!libraryResult.success) {
        console.error('Cannot test conversion - library not available');
        return false;
      }
      
      const heic2any = libraryResult.library;
      console.log('🔄 Converting HEIC file:', file.name);
      
      const startTime = Date.now();
      const jpegBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      });
      const duration = Date.now() - startTime;
      
      console.log('✅ Conversion successful!', {
        originalSize: file.size,
        convertedSize: jpegBlob.size,
        duration: duration + 'ms',
        compression: Math.round((1 - jpegBlob.size / file.size) * 100) + '%'
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Conversion failed:', error);
      return false;
    }
  }
};

// Auto-run diagnostic on load
if (typeof window !== 'undefined') {
  console.log('🏥 HEIC Diagnostic Tool Loaded');
  console.log('Run: HEICDiagnostic.runFullDiagnostic()');
  
  // Auto-run after a short delay
  setTimeout(() => {
    HEICDiagnostic.runFullDiagnostic();
  }, 1000);
}
