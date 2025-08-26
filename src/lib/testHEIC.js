/**
 * Test HEIC conversion in browser
 * This file tests if heic2any is working properly
 */

export async function testHEICSupport() {
  console.log('🧪 Testing HEIC Support in Browser');
  
  try {
    // Test 1: Check if heic2any can be imported
    console.log('📦 Testing heic2any import...');
    
    const heicModule = await import('heic2any');
    const heic2any = heicModule.default || heicModule;
    
    if (heic2any) {
      console.log('✅ heic2any library loaded successfully');
      console.log('📋 Library type:', typeof heic2any);
      
      // Test 2: Check if it's a function
      if (typeof heic2any === 'function') {
        console.log('✅ heic2any is a function - ready to use');
        return { success: true, library: heic2any };
      } else {
        console.error('❌ heic2any is not a function, got:', typeof heic2any);
        return { success: false, error: 'Library is not a function' };
      }
    } else {
      console.error('❌ heic2any library not found after import');
      return { success: false, error: 'Library not found' };
    }
    
  } catch (error) {
    console.error('❌ Failed to load heic2any:', error.message);
    return { success: false, error: error.message };
  }
}

// Test function to simulate HEIC file processing
export function simulateHEICFile() {
  // Create a mock HEIC file for testing
  const mockHEIC = new File(
    [new ArrayBuffer(1024)], // 1KB of empty data
    'test.heic',
    { type: 'image/heic' }
  );
  
  console.log('📸 Mock HEIC file created:', {
    name: mockHEIC.name,
    type: mockHEIC.type,
    size: mockHEIC.size
  });
  
  return mockHEIC;
}

// Auto-test when this module is loaded in browser
if (typeof window !== 'undefined') {
  console.log('🌐 Browser environment detected - running HEIC tests');
  
  // Test immediately
  testHEICSupport().then(result => {
    if (result.success) {
      console.log('🎉 HEIC support test PASSED');
    } else {
      console.log('💥 HEIC support test FAILED:', result.error);
    }
  });
}
