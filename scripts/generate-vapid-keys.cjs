/**
 * generate-vapid-keys.cjs
 *
 * Generates a fresh P-256 VAPID key pair using Node.js built-in crypto.
 * No external dependencies required (no npm install needed).
 *
 * Outputs:
 *   - VAPID_PUBLIC_KEY  (base64url, uncompressed P-256 point, 87 chars)
 *   - VAPID_PRIVATE_KEY (base64url, raw 32-byte scalar, 43 chars)
 *
 * Usage:
 *   node scripts/generate-vapid-keys.cjs
 *
 * SECURITY:
 *   - The PRIVATE KEY is written ONLY to .env (which is git-ignored).
 *   - The PUBLIC KEY goes into .env as VITE_VAPID_PUBLIC_KEY (safe for frontend).
 *   - This script NEVER prints the private key to stdout.
 *   - Run once; re-running will invalidate existing push subscriptions.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Generate P-256 key pair
// ---------------------------------------------------------------------------
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});

// ---------------------------------------------------------------------------
// Extract public key: SPKI DER -> 65-byte uncompressed point -> base64url
// Locate the 0x04 (uncompressed point) marker dynamically — the exact header
// offset can vary slightly between Node.js versions (26 or 27 bytes).
// ---------------------------------------------------------------------------
const pubDer = publicKey.export({ type: 'spki', format: 'der' });

let pubOffset = -1;
for (let i = 0; i < pubDer.length - 64; i++) {
  // The uncompressed point (0x04) is exactly 65 bytes from its position to end
  if (pubDer[i] === 0x04 && pubDer.length - i === 65) {
    pubOffset = i;
    break;
  }
}

if (pubOffset === -1) {
  console.error('[VAPID] Unexpected public key DER format — cannot locate uncompressed point (0x04).');
  process.exit(1);
}

const pubBytes = pubDer.slice(pubOffset); // 65 bytes: 0x04 + 32-byte X + 32-byte Y

if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
  console.error('[VAPID] Unexpected public key DER format — cannot extract uncompressed point.');
  process.exit(1);
}

const pubB64url = pubBytes
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

// ---------------------------------------------------------------------------
// Extract private key: PKCS#8 DER -> 32-byte raw scalar -> base64url
// In a PKCS#8 EC key the ECPrivateKey contains:
//   SEQUENCE { version INTEGER(1), privateKey OCTET STRING (32 bytes) }
// We locate the OCTET STRING (0x04 0x20) preceding the 32-byte scalar.
// ---------------------------------------------------------------------------
const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });

let privScalar = null;
for (let i = 0; i < privDer.length - 33; i++) {
  // 0x04 = OCTET STRING tag, 0x20 = 32 bytes length
  if (privDer[i] === 0x04 && privDer[i + 1] === 0x20) {
    privScalar = privDer.slice(i + 2, i + 34);
    break;
  }
}

if (!privScalar || privScalar.length !== 32) {
  console.error('[VAPID] Could not extract 32-byte private scalar from PKCS#8 DER.');
  process.exit(1);
}

const privB64url = privScalar
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

// ---------------------------------------------------------------------------
// Validate key lengths (sanity check before writing anywhere)
// ---------------------------------------------------------------------------
if (pubB64url.length !== 87) {
  console.error(`[VAPID] Public key length unexpected: ${pubB64url.length} chars (expected 87).`);
  process.exit(1);
}
if (privB64url.length !== 43) {
  console.error(`[VAPID] Private key length unexpected: ${privB64url.length} chars (expected 43).`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Read existing .env (if present) so we can preserve other variables
// ---------------------------------------------------------------------------
const envPath = path.resolve(__dirname, '..', '.env');

let existingEnvContent = '';
if (fs.existsSync(envPath)) {
  existingEnvContent = fs.readFileSync(envPath, 'utf8');
}

// Helper: upsert a KEY=VALUE line in a .env file string
function upsertEnvLine(content, key, value) {
  const pattern = new RegExp('^' + key + '=.*$', 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, key + '=' + value);
  }
  // Append with a trailing newline
  const trimmed = content.trimEnd();
  return trimmed ? trimmed + '\n' + key + '=' + value + '\n' : key + '=' + value + '\n';
}

// ---------------------------------------------------------------------------
// Write VITE_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to .env
// The private key is ONLY written here — never printed to stdout.
// ---------------------------------------------------------------------------
let newEnvContent = existingEnvContent;
newEnvContent = upsertEnvLine(newEnvContent, 'VITE_VAPID_PUBLIC_KEY', pubB64url);
newEnvContent = upsertEnvLine(newEnvContent, 'VAPID_PRIVATE_KEY', privB64url);

fs.writeFileSync(envPath, newEnvContent, 'utf8');

// ---------------------------------------------------------------------------
// Print ONLY the public key and instructions — NEVER the private key
// ---------------------------------------------------------------------------
console.log('');
console.log('✅  VAPID key pair generated successfully (P-256 / base64url).');
console.log('');
console.log('VITE_VAPID_PUBLIC_KEY (safe for frontend & Supabase secret):');
console.log(pubB64url);
console.log('');
console.log('VAPID_PRIVATE_KEY: [written to .env only — NOT printed here]');
console.log('');
console.log('Next steps:');
console.log('  1. .env already has VITE_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY set.');
console.log('  2. When deploying, set these Supabase Edge Function secrets:');
console.log('       VAPID_PUBLIC_KEY   =  <same value as VITE_VAPID_PUBLIC_KEY above>');
console.log('       VAPID_PRIVATE_KEY  =  <read from your local .env — never paste in chat>');
console.log('       VAPID_SUBJECT      =  mailto:your-email@example.com');
console.log('       SCHEDULER_SECRET   =  <generate a separate high-entropy random secret>');
console.log('  3. Do NOT re-run this script unless you want to invalidate all push subscriptions.');
console.log('');
