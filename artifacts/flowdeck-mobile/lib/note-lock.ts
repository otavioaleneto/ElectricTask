/**
 * Per-note password lock — INTEROPERABLE with the FlowDeck web app.
 *
 * Reproduces the exact wire format written by
 * `artifacts/flowdeck/src/lib/note-lock.ts`:
 *
 *   flowlock:v1:<saltB64>:<ivB64>:<cipherB64>
 *
 * PBKDF2(SHA-256, 200000 iters) derives a 256-bit key from the password and a
 * random 16-byte salt; the plaintext (UTF-8) is sealed with AES-256-GCM using a
 * random 12-byte IV. Base64 is standard (matching the web's btoa/atob), so a
 * note locked on web decrypts on mobile and vice-versa.
 *
 * React Native (Hermes) lacks WebCrypto, btoa/atob, and TextEncoder, so the
 * crypto primitives come from @noble/* and the base64 + UTF-8 codecs are
 * implemented here. Secure randomness comes from expo-crypto.
 */
import { gcm } from "@noble/ciphers/aes";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import * as Crypto from "expo-crypto";

const PREFIX = "flowlock";
const VERSION = "v1";
const PBKDF2_ITERATIONS = 200000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP: Int16Array = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64_ALPHABET.length; i++) {
    table[B64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/** Standard base64 encode (matches the web's btoa). */
function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  let i = 0;
  for (; i + 3 <= len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64_ALPHABET[(n >> 18) & 63] +
      B64_ALPHABET[(n >> 12) & 63] +
      B64_ALPHABET[(n >> 6) & 63] +
      B64_ALPHABET[n & 63];
  }
  const rem = len - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64_ALPHABET[(n >> 18) & 63] + B64_ALPHABET[(n >> 12) & 63] + "==";
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      B64_ALPHABET[(n >> 18) & 63] +
      B64_ALPHABET[(n >> 12) & 63] +
      B64_ALPHABET[(n >> 6) & 63] +
      "=";
  }
  return out;
}

/** Standard base64 decode (matches the web's atob). Ignores padding/whitespace. */
function base64ToBytes(b64: string): Uint8Array {
  let clean = "";
  for (let i = 0; i < b64.length; i++) {
    const c = b64.charCodeAt(i);
    if (c < 128 && B64_LOOKUP[c] !== -1) clean += b64[i];
  }
  const len = clean.length;
  const outLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_LOOKUP[clean.charCodeAt(i)];
    const c1 = i + 1 < len ? B64_LOOKUP[clean.charCodeAt(i + 1)] : 0;
    const c2 = i + 2 < len ? B64_LOOKUP[clean.charCodeAt(i + 2)] : 0;
    const c3 = i + 3 < len ? B64_LOOKUP[clean.charCodeAt(i + 3)] : 0;
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (p < outLen) bytes[p++] = (n >> 16) & 0xff;
    if (i + 2 < len && p < outLen) bytes[p++] = (n >> 8) & 0xff;
    if (i + 3 < len && p < outLen) bytes[p++] = n & 0xff;
  }
  return bytes;
}

/** UTF-8 encode (matches the web's TextEncoder). */
function utf8Encode(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

/** UTF-8 decode (matches the web's TextDecoder). */
function utf8Decode(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    const b0 = bytes[i++];
    let code: number;
    if (b0 < 0x80) {
      code = b0;
    } else if ((b0 & 0xe0) === 0xc0) {
      code = ((b0 & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if ((b0 & 0xf0) === 0xe0) {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      code = ((b0 & 0x0f) << 12) | (b1 << 6) | b2;
    } else {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      const b3 = bytes[i++] & 0x3f;
      code = ((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3;
    }
    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, utf8Encode(password), salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: KEY_BYTES,
  });
}

/** True when the string is a FlowDeck locked-note payload. */
export function isLockedPayload(value: string): boolean {
  return value.startsWith(`${PREFIX}:${VERSION}:`);
}

/**
 * Encrypts plaintext note content with a password using PBKDF2 + AES-256-GCM.
 * The password is never stored; only the derived ciphertext is persisted.
 */
export async function encryptNoteContent(
  plaintext: string,
  password: string,
): Promise<string> {
  const salt = Crypto.getRandomBytes(SALT_BYTES);
  const iv = Crypto.getRandomBytes(IV_BYTES);
  const key = deriveKey(password, salt);
  const cipher = gcm(key, iv).encrypt(utf8Encode(plaintext));
  return [
    PREFIX,
    VERSION,
    bytesToBase64(salt),
    bytesToBase64(iv),
    bytesToBase64(cipher),
  ].join(":");
}

/**
 * Decrypts a locked-note payload. Throws if the password is wrong or the
 * payload is malformed/corrupted (AES-GCM tag verification fails).
 */
export async function decryptNoteContent(
  payload: string,
  password: string,
): Promise<string> {
  const parts = payload.split(":");
  if (parts.length !== 5 || parts[0] !== PREFIX || parts[1] !== VERSION) {
    throw new Error("Conteúdo protegido inválido.");
  }
  const salt = base64ToBytes(parts[2]);
  const iv = base64ToBytes(parts[3]);
  const cipher = base64ToBytes(parts[4]);
  const key = deriveKey(password, salt);
  const plain = gcm(key, iv).decrypt(cipher);
  return utf8Decode(plain);
}
