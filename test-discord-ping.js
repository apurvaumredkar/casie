/**
 * Test Discord PING Interaction
 *
 * This script simulates what Discord sends when validating your endpoint.
 * Use this to debug endpoint validation issues.
 *
 * Usage:
 *   node test-discord-ping.js <worker-url> <public-key>
 *
 * Example:
 *   node test-discord-ping.js https://casie-core.apoorv-umredkar.workers.dev YOUR_PUBLIC_KEY
 */

import crypto from 'crypto';

const [,, workerUrl, publicKey] = process.argv;

if (!workerUrl || !publicKey) {
  console.error('Usage: node test-discord-ping.js <worker-url> <public-key>');
  console.error('Example: node test-discord-ping.js https://casie-core.apoorv-umredkar.workers.dev abc123...');
  process.exit(1);
}

// Create a PING interaction (what Discord sends during validation)
const body = JSON.stringify({
  type: 1, // PING type
  id: 'test-id-' + Date.now(),
  application_id: 'test-app-id',
  token: 'test-token'
});

// Discord signs the request
const timestamp = Math.floor(Date.now() / 1000).toString();
const message = timestamp + body;

// Note: We can't actually sign this without the private key
// This is just to show what Discord sends
console.log('\n📤 Discord sends this to your worker:\n');
console.log('POST', workerUrl);
console.log('Headers:');
console.log('  x-signature-ed25519: [signature]');
console.log('  x-signature-timestamp:', timestamp);
console.log('  content-type: application/json');
console.log('\nBody:');
console.log(body);

console.log('\n🔐 Your worker will verify using public key:');
console.log('  ', publicKey);

console.log('\n✅ Expected response from worker:');
console.log('  {"type":1}');

console.log('\n🧪 Testing worker endpoint...\n');

// Test if worker is reachable
try {
  const response = await fetch(workerUrl, {
    method: 'GET'
  });

  const text = await response.text();
  console.log('GET', workerUrl);
  console.log('Status:', response.status);
  console.log('Response:', text);
  console.log('\n✅ Worker is reachable!');

  // Try POST without signatures (should fail)
  console.log('\n🧪 Testing POST without signatures...\n');
  const postResponse = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: body
  });

  const postText = await postResponse.text();
  console.log('POST', workerUrl);
  console.log('Status:', postResponse.status);
  console.log('Response:', postText);

  if (postText.includes('missing signature')) {
    console.log('\n✅ Signature verification is working!');
    console.log('   Worker correctly rejects requests without Discord signatures.');
  }

  console.log('\n📋 Next Steps:');
  console.log('   1. Make sure DISCORD_PUBLIC_KEY secret is set in Cloudflare');
  console.log('   2. Use this URL in Discord Developer Portal:');
  console.log('      ' + workerUrl);
  console.log('   3. Discord will sign the request with its private key');
  console.log('   4. Your worker will verify using the public key');
  console.log('   5. If keys match, Discord shows ✅');

} catch (error) {
  console.error('❌ Error testing worker:', error.message);
  console.log('\n🔍 Troubleshooting:');
  console.log('   - Check if worker URL is correct');
  console.log('   - Make sure worker is deployed');
  console.log('   - Verify network connectivity');
}
