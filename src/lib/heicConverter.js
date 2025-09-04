/**
 * HEIC Converter - Robust client-side HEIC to JPEG conversion
 * Handles Next.js specific issues with heic2any library
 */

class HEICConverter {
  static heic2any = null;
  static isLoading = false;
  static loadPromise = null;

  /**
   * Load heic2any library with proper error handling
   */
  static async loadLibrary() {
    if (this.heic2any) {
      return this.heic2any;
    }

    if (this.isLoading) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this._attemptLoad();
    
    try {
      this.heic2any = await this.loadPromise;
      return this.heic2any;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Attempt to load heic2any with multiple strategies
   */
  static async _attemptLoad() {
    const strategies = [
      // Strategy 1: Standard dynamic import
      async () => {
        const heicModule = await import('heic2any');
        return heicModule.default || heicModule;
      },
      
      // Strategy 2: Try accessing as function directly
      async () => {
        const heicModule = await import('heic2any');
        if (typeof heicModule === 'function') return heicModule;
        if (typeof heicModule.default === 'function') return heicModule.default;
        if (typeof heicModule.heic2any === 'function') return heicModule.heic2any;
        throw new Error('No function found in module');
      },

      // Strategy 3: CDN fallback (if library fails to load properly)
      async () => {
        if (typeof window !== 'undefined') {
          // Could load from CDN as fallback, but for now just throw
          throw new Error('CDN fallback not implemented');
        }
        throw new Error('Not in browser environment');
      }
    ];

    let lastError;

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = await strategies[i]();
        
        if (typeof result === 'function') {
          return result;
        } else {
          throw new Error(`Strategy ${i + 1} did not return a function`);
        }
      } catch (error) {
        console.warn(`⚠️ Strategy ${i + 1} failed:`, error.message);
        lastError = error;
      }
    }

    throw new Error(`All heic2any load strategies failed. Last error: ${lastError.message}`);
  }

  /**
   * Convert HEIC file to JPEG blob
   */
  static async convertToJPEG(heicFile, quality = 0.8) {
    try {
      // Check file size
      if (heicFile.size > 25 * 1024 * 1024) { // 25MB limit
        throw new Error('File too large for client-side conversion (>25MB)');
      }

      // Load the conversion library
      const heic2any = await this.loadLibrary();

      if (!heic2any) {
        throw new Error('heic2any library not available');
      }

      // Perform conversion
      const startTime = Date.now();

      const jpegBlob = await heic2any({
        blob: heicFile,
        toType: 'image/jpeg',
        quality: quality
      });

      return jpegBlob;

    } catch (error) {
      console.error('❌ HEIC conversion failed:', error.message);
      throw error;
    }
  }

  /**
   * Convert HEIC to JPEG and return as File object
   */
  static async convertToJPEGFile(heicFile, quality = 0.8) {
    try {
      const jpegBlob = await this.convertToJPEG(heicFile, quality);
      
      // Create new filename with .jpg extension
      const jpegFileName = heicFile.name.replace(/\.heic?$/i, '.jpg');
      
      // Create File object
      const jpegFile = new File([jpegBlob], jpegFileName, {
        type: 'image/jpeg',
        lastModified: heicFile.lastModified || Date.now()
      });

      return jpegFile;

    } catch (error) {
      console.error('❌ HEIC to JPEG file conversion failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if HEIC conversion is supported
   */
  static async isSupported() {
    try {
      await this.loadLibrary();
      return true;
    } catch (error) {
      console.warn('HEIC conversion not supported:', error.message);
      return false;
    }
  }
}

export default HEICConverter;
