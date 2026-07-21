import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from "node:crypto";
import { SESSION_SECRET } from "./auth";

const ALGO = "aes-256-gcm";
const PREFIX = "subcred:v1";
const KEY_SALT = "flowdeck-subscription-cred";

function loadKey(): Buffer {
  const raw = process.env.SUBSCRIPTION_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
    // Any other provided string: derive a stable 32-byte key from it.
    return scryptSync(raw, KEY_SALT, 32);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SUBSCRIPTION_ENCRYPTION_KEY must be set in production to store subscription credentials.",
    );
  }
  // Development fallback: derive a stable key from SESSION_SECRET so the
  // feature works locally without a dedicated secret. Production requires
  // the dedicated key above.
  return scryptSync(SESSION_SECRET, KEY_SALT, 32);
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

export function encryptCredential(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${ct.toString("base64")}:${tag.toString("base64")}`;
}

export function decryptCredential(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== PREFIX) {
    throw new Error("Invalid credential payload");
  }
  const iv = Buffer.from(parts[2], "base64");
  const ct = Buffer.from(parts[3], "base64");
  const tag = Buffer.from(parts[4], "base64");
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
