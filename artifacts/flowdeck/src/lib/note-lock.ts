const PREFIX = "flowlock";
const VERSION = "v1";
const PBKDF2_ITERATIONS = 200000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Returns true when the given string is a FlowDeck locked-note payload.
 */
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
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  return [
    PREFIX,
    VERSION,
    bytesToBase64(salt),
    bytesToBase64(iv),
    bytesToBase64(new Uint8Array(cipher)),
  ].join(":");
}

/**
 * Decrypts a locked-note payload. Throws if the password is wrong or the
 * payload is malformed/corrupted.
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
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipher,
  );
  return new TextDecoder().decode(plain);
}
