/**
 * ClassMate Phase 3D — VAPID Signing Utilities
 *
 * Implements VAPID (Voluntary Application Server Identification for Web Push)
 * using only Deno-native crypto.subtle APIs.
 * No external npm packages are used — this is 100% compatible with the
 * Supabase Edge Function (Deno) runtime.
 *
 * RFC 8292: https://www.rfc-editor.org/rfc/rfc8292
 *
 * SECURITY:
 *   - VAPID_PRIVATE_KEY is read from Deno.env (Supabase secrets).
 *   - It is NEVER logged, returned in responses, or exposed to the client.
 *   - VAPID_PUBLIC_KEY is safe to use in push subscription applicationServerKey.
 */

/** Base64url decode a string to a plain-ArrayBuffer-backed Uint8Array (required by crypto.subtle) */
function base64UrlDecode(str: string): Uint8Array & { buffer: ArrayBuffer } {
  // Pad to multiple of 4
  const padded = str + "===".slice((str.length + 3) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  // Allocate a plain ArrayBuffer — avoids SharedArrayBuffer / ArrayBufferLike ambiguity
  const buf = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buf) as Uint8Array & { buffer: ArrayBuffer };
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Base64url encode a Uint8Array to string */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Encode a plain object as a base64url JSON string (JWT header/payload) */
function encodeJwtPart(obj: Record<string, unknown>): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

/**
 * Generates a VAPID Authorization header value for a given push endpoint origin.
 *
 * @param audience   - The push endpoint origin (e.g. "https://fcm.googleapis.com")
 * @param subject    - Contact email or URL (e.g. "mailto:admin@example.com")
 * @param privateKeyB64Url - VAPID private key in base64url (uncompressed P-256)
 * @param publicKeyB64Url  - VAPID public key in base64url (uncompressed P-256)
 * @returns Authorization header value ("vapid t=...,k=...")
 */
export async function generateVapidAuthHeader(
  audience: string,
  subject: string,
  privateKeyB64Url: string,
  publicKeyB64Url: string
): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + 12 * 3600; // 12 hours validity

  const header  = encodeJwtPart({ typ: "JWT", alg: "ES256" });
  const payload = encodeJwtPart({ aud: audience, exp: expSeconds, sub: subject });
  const signingInput = `${header}.${payload}`;

  // Import the VAPID private key using standard Web Crypto JWK format
  // P-256 public key is 65 bytes: 0x04 || 32-byte X || 32-byte Y
  // P-256 private key is 32-byte scalar d
  const pubBytes = base64UrlDecode(publicKeyB64Url);
  let cryptoKey: CryptoKey;
  try {
    const x = base64UrlEncode(pubBytes.slice(1, 33));
    const y = base64UrlEncode(pubBytes.slice(33, 65));
    const jwk: JsonWebKey = {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d: privateKeyB64Url,
    };
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  } catch {
    // Fallback: in case privateKeyB64Url was passed as raw scalar or full PKCS#8 DER
    const privateKeyBytes = base64UrlDecode(privateKeyB64Url);
    const pkcs8 = buildPkcs8DerFromRaw(privateKeyBytes);
    cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  }

  // Encode signingInput into a plain ArrayBuffer to satisfy BufferSource constraint
  const signingInputEncoded = new TextEncoder().encode(signingInput);
  const signingInputBuf = new ArrayBuffer(signingInputEncoded.byteLength);
  new Uint8Array(signingInputBuf).set(signingInputEncoded);
  const sigBytes = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    signingInputBuf
  );

  const signature = base64UrlEncode(new Uint8Array(sigBytes));
  const token = `${signingInput}.${signature}`;

  return `vapid t=${token},k=${publicKeyB64Url}`;
}

/**
 * Wraps a raw 32-byte P-256 private key scalar in a minimal PKCS#8 DER envelope.
 * This is needed when crypto.subtle.importKey("raw") fails (key may be PKCS#8 format).
 *
 * PKCS#8 structure for P-256:
 *   SEQUENCE {
 *     INTEGER 0
 *     SEQUENCE { OID ecPublicKey, OID P-256 }
 *     OCTET STRING { ECPrivateKey { INTEGER 1, OCTET STRING { privateKey } } }
 *   }
 */
function buildPkcs8DerFromRaw(rawKey: Uint8Array): ArrayBuffer {
  // ECPrivateKey ::= SEQUENCE { version INTEGER (1), privateKey OCTET STRING }
  const ecPrivKeyInner = concat([
    new Uint8Array([0x02, 0x01, 0x01]),        // version = 1
    new Uint8Array([0x04, rawKey.length]),       // OCTET STRING tag + length
    rawKey,
  ]);
  const ecPrivKey = wrapDer(0x30, ecPrivKeyInner); // SEQUENCE

  // AlgorithmIdentifier: SEQUENCE { ecPublicKey OID, P-256 OID }
  const algoId = new Uint8Array([
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // P-256
  ]);

  // PrivateKeyInfo ::= SEQUENCE { version, algorithm, privateKey OCTET STRING }
  const privateKeyInfo = concat([
    new Uint8Array([0x02, 0x01, 0x00]), // version = 0
    algoId,
    new Uint8Array([0x04, ecPrivKey.length]), // OCTET STRING wrapper
    ecPrivKey,
  ]);

  // wrapDer returns a Uint8Array; extract its content as a plain ArrayBuffer
  // (crypto.subtle.importKey("pkcs8") requires ArrayBuffer, not ArrayBufferLike)
  const wrapped = wrapDer(0x30, privateKeyInfo);
  // slice() on ArrayBuffer always returns a plain ArrayBuffer
  return wrapped.buffer.slice(wrapped.byteOffset, wrapped.byteOffset + wrapped.byteLength) as ArrayBuffer;
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function wrapDer(tag: number, content: Uint8Array): Uint8Array {
  const len = content.length;
  let lenBytes: Uint8Array;
  if (len < 0x80) {
    lenBytes = new Uint8Array([len]);
  } else if (len < 0x100) {
    lenBytes = new Uint8Array([0x81, len]);
  } else {
    lenBytes = new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
  }
  return concat([new Uint8Array([tag]), lenBytes, content]);
}
