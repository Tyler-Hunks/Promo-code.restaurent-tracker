// Debug script to test environment variables in Cloudflare Worker
// This will help us see if the environment variables are being read correctly

const WORKER_URL = 'https://promo-code-manager.bluepavilionemail.workers.dev';

async function debugEnvironment() {
  console.log('🔍 Testing Environment Variables...\n');
  
  // Test 1: No API key (should get 401)
  console.log('Test 1: No API key');
  try {
    const response = await fetch(`${WORKER_URL}/api/promo-codes/stats`);
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', data);
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log('');
  
  // Test 2: Wrong API key (should get 401)
  console.log('Test 2: Wrong API key');
  try {
    const response = await fetch(`${WORKER_URL}/api/promo-codes/stats`, {
      headers: { 'x-api-key': 'wrong-key' }
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', data);
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log('');
  
  // Test 3: Correct API key (should work)
  console.log('Test 3: Correct API key');
  try {
    const response = await fetch(`${WORKER_URL}/api/promo-codes/stats`, {
      headers: { 'x-api-key': 'promo-manager-2024-secure-key' }
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', data);
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log('');
  
  // Test 4: Try with default fallback (in case env vars aren't working)
  console.log('Test 4: Testing if environment variables are loaded');
  console.log('The worker should accept: promo-manager-2024-secure-key');
  console.log('If it still returns 401, the environment variables are not being read properly.');
}

// Run the debug
debugEnvironment().catch(console.error);