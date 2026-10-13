/**
 * ClassMate Phase 3D — Web Push HTTP Sender (RFC 8291 / RFC 8188 Encrypted)
 *
 * Sends a Web Push message to a browser push endpoint using:
 *   - RFC 8030 — Web Push Protocol (HTTP POST to push endpoint)
 *   - RFC 8292 — VAPID authentication (JWT in Authorization header)
 *   - RFC 8291 — Message Encryption for Web Push (Content-Encoding: aes128gcm)
 *   - RFC 8188 — Encrypted Content-Encoding for HTTP (binary record framing)
 *
 * This file is Deno-native. It uses ONLY the standard Web Crypto API
 * (crypto.subtle) — no npm packages, no Node.js built-ins required.
 *
 * CONTENT-ENCODING:
 *   Uses "aes128gcm" (RFC 8291 / RFC 8188).
 *   Supported natively by Chrome (FCM), Firefox (autopush), Safari (APNs), and Edge.
 *
 * INVALID SUBSCRIPTION DETECTION:
 *   HTTP 410 Gone      → subscription expired/revoked, caller should delete it
 *   HTTP 404 Not Found → endpoint not found, treat as expired
 */

import { generateVapidAuthHeader } from "./vapidUtils.ts";
import type { SerializedPushSubscription } from "./types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Type alias to make intent explicit at every boundary
// ─────────────────────────────────────────────────────────────────────────────

/** A plain (non-SharedArrayBuffer) Uint8Array as required by crypto.subtle. */
type PlainUint8Array = Uint8Array & { buffer: ArrayBuffer };

// ─────────────────────────────────────────────────────────────────────────────
// Public result type
// ─────────────────────────────────────────────────────────────────────────────

export type PushSendResult =
  | { status: "sent" }
  | { status: "expired" }               // 410/404 — caller must delete subscription
  | { status: "error"; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a base64url string to a PlainUint8Array (ArrayBuffer-backed).
 * PlainUint8Array is required by crypto.subtle APIs in TypeScript 5.7+.
 */
function b64urlToPlainBytes(b64url: string): PlainUint8Array {
  const padding = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf) as PlainUint8Array;
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Cast an ArrayBuffer from crypto.subtle to a PlainUint8Array.
 * At runtime crypto.subtle always returns a plain ArrayBuffer, never SharedArrayBuffer.
 */
function toPlain(buf: ArrayBuffer): PlainUint8Array {
  return new Uint8Array(buf as ArrayBuffer) as PlainUint8Array;
}

/**
 * TextEncoder result typed as PlainUint8Array for use with crypto.subtle.
 */
function encodeToPlain(str: string): PlainUint8Array {
  const encoded = new TextEncoder().encode(str);
  const buf = new ArrayBuffer(encoded.byteLength);
  const arr = new Uint8Array(buf) as PlainUint8Array;
  arr.set(encoded);
  return arr;
}

/**
 * Allocate a random PlainUint8Array salt.
 */
function randomPlainBytes(byteLen: number): PlainUint8Array {
  const buf = new ArrayBuffer(byteLen);
  const arr = new Uint8Array(buf) as PlainUint8Array;
  crypto.getRandomValues(arr);
  return arr;
}

/**
 * Concatenate multiple Uint8Arrays into a single PlainUint8Array.
 */
function concatBytes(arrays: Uint8Array[]): PlainUint8Array {
  const total = arrays.reduce((sum, a) => sum + a.byteLength, 0);
  const buf = new ArrayBuffer(total);
  const out = new Uint8Array(buf) as PlainUint8Array;
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.byteLength;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload encryption (RFC 8291 + RFC 8188 / aes128gcm)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encrypt payload using RFC 8291 (Message Encryption for Web Push)
 * and RFC 8188 (Encrypted Content-Encoding for HTTP, aes128gcm).
 *
 * Steps:
 *  1. Ephemeral server ECDH key pair (P-256).
 *  2. Import client's p256dh public key.
 *  3. Derive ECDH shared secret (32 bytes).
 *  4. Combine shared secret + client auth secret via HKDF (RFC 8291 Section 3.3):
 *     - salt = clientAuth (16 bytes)
 *     - IKM = ecdh_secret (32 bytes)
 *     - info = "WebPush: info\0" || clientP256dh || serverPublicKey
 *     - Result = 32-byte IKM for RFC 8188
 *  5. Generate random 16-byte salt for RFC 8188.
 *  6. Derive CEK (16 bytes) and nonce (12 bytes) via HKDF (RFC 8188 Section 2.2):
 *     - salt = RFC 8188 salt (16 bytes)
 *     - IKM = ikmWebPush (32 bytes)
 *     - CEK info = "Content-Encoding: aes128gcm\0"
 *     - Nonce info = "Content-Encoding: nonce\0"
 *  7. Append RFC 8188 padding delimiter 0x02 (final record) to plaintext.
 *  8. Encrypt record with AES-128-GCM (16-byte auth tag is appended by Web Crypto).
 *  9. Assemble RFC 8188 header:
 *     - salt: 16 octets
 *     - rs: 4 octets (4096 = [0x00, 0x00, 0x10, 0x00])
 *     - idlen: 1 octet (65 = 0x41)
 *     - keyid: 65 octets (serverPublicKey)
 * 10. Return header + encrypted record as complete binary body.
 */
async function encryptPayloadRFC8291(
  plaintext: PlainUint8Array,
  clientP256dh: PlainUint8Array,
  clientAuth: PlainUint8Array,
): Promise<PlainUint8Array> {
  // 1. Ephemeral server ECDH key pair (P-256)
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPublicKey = toPlain(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey) as ArrayBuffer,
  );

  // 2. Import client's P-256 public key for ECDH
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientP256dh,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // 3. ECDH shared secret (32 bytes)
  const sharedSecret = toPlain(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeyPair.privateKey,
      256,
    ) as ArrayBuffer,
  );

  // 4. Combine ECDH shared secret with auth secret (RFC 8291 Section 3.3)
  //    salt = auth_secret, IKM = sharedSecret
  //    key_info = "WebPush: info" || 0x00 || ua_public || as_public
  const ecdhIkmKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const webPushLabel = encodeToPlain("WebPush: info\0");
  const keyInfo = concatBytes([webPushLabel, clientP256dh, serverPublicKey]);

  const ikmWebPush = toPlain(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: clientAuth, // RFC 8291: auth_secret is the HKDF salt
        info: keyInfo,    // RFC 8291: "WebPush: info\0" || ua_public || as_public
      },
      ecdhIkmKey,         // RFC 8291: ECDH shared secret is the HKDF IKM
      256,
    ) as ArrayBuffer,
  );

  // 5. Per-message random salt for RFC 8188 (16 bytes)
  const salt = randomPlainBytes(16);

  // 6. Derive CEK (16 bytes) and nonce (12 bytes) using RFC 8188 Section 2.2
  const rfc8188Key = await crypto.subtle.importKey(
    "raw",
    ikmWebPush,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );

  const cek = toPlain(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info: encodeToPlain("Content-Encoding: aes128gcm\0"),
      },
      rfc8188Key,
      128, // 16 bytes (128 bits)
    ) as ArrayBuffer,
  );

  const nonce = toPlain(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info: encodeToPlain("Content-Encoding: nonce\0"),
      },
      rfc8188Key,
      96, // 12 bytes (96 bits)
    ) as ArrayBuffer,
  );

  // 7. Append delimiter 0x02 to plaintext (RFC 8188 Section 2: final record delimiter)
  const recordPlaintext = concatBytes([plaintext, new Uint8Array([0x02])]);

  // 8. Encrypt record with AES-128-GCM (appends 16-byte authentication tag)
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const encryptedRecord = toPlain(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      recordPlaintext,
    ) as ArrayBuffer,
  );

  // 9. Build RFC 8188 header (Section 2.1):
  //    salt (16 octets) || rs (4 octets) || idlen (1 octet) || keyid (65 octets)
  //    rs = 4096 (0x00, 0x00, 0x10, 0x00 in network byte order)
  const rsBytes = new Uint8Array([0x00, 0x00, 0x10, 0x00]);
  const idlenByte = new Uint8Array([serverPublicKey.length]); // 65 (0x41)
  const header = concatBytes([salt, rsBytes, idlenByte, serverPublicKey]);

  // 10. Complete encrypted payload body: RFC 8188 header + ciphertext record
  return concatBytes([header, encryptedRecord]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a Web Push notification to a single push endpoint.
 *
 * The payload is encrypted with RFC 8291 / RFC 8188 (aes128gcm encoding).
 * The request is authenticated with a VAPID JWT (RFC 8292).
 */
export async function sendWebPush(
  subscription: SerializedPushSubscription,
  payload: { title: string; body: string; url?: string },
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<PushSendResult> {
  const { endpoint, keys } = subscription;

  // ── 1. Validate endpoint ────────────────────────────────────────────────
  let audience: string;
  try {
    audience = new URL(endpoint).origin;
  } catch {
    return { status: "error", message: "Invalid push endpoint URL" };
  }

  // ── 2. VAPID Authorization header (RFC 8292) ─────────────────────────────
  let authHeader: string;
  try {
    authHeader = await generateVapidAuthHeader(
      audience,
      vapidSubject,
      vapidPrivateKey,
      vapidPublicKey,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `VAPID signing failed: ${msg}` };
  }

  // ── 3. RFC 8291 / RFC 8188 payload encryption (Content-Encoding: aes128gcm) ─
  const clientP256dh = b64urlToPlainBytes(keys.p256dh);
  const clientAuth   = b64urlToPlainBytes(keys.auth);
  const plaintext    = encodeToPlain(JSON.stringify(payload));

  let payloadBody: PlainUint8Array;
  try {
    payloadBody = await encryptPayloadRFC8291(
      plaintext,
      clientP256dh,
      clientAuth,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `Payload encryption failed: ${msg}` };
  }

  // ── 4. Build HTTP headers (RFC 8291 / RFC 8030) ──────────────────────────
  const headers: Record<string, string> = {
    Authorization:      authHeader,
    "Content-Type":     "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    TTL:                "86400",
    Urgency:            "normal",
  };

  // ── 5. POST to push endpoint ──────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: payloadBody.buffer as ArrayBuffer,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `Network error: ${msg}` };
  }

  // ── 6. Interpret response ─────────────────────────────────────────────────
  if (response.status === 200 || response.status === 201) {
    return { status: "sent" };
  }
  if (response.status === 410 || response.status === 404) {
    return { status: "expired" };
  }

  let body = "";
  try { body = await response.text(); } catch { /* ignore */ }

  return {
    status: "error",
    message: `Push service HTTP ${response.status}: ${body.slice(0, 200)}`,
  };
}
