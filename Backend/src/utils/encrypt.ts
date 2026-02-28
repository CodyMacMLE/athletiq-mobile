import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM authenticated encryption.
// The encryption key is a 64-char hex string (32 bytes = 256 bits).
// In production, inject it from AWS Secrets Manager via ECS task secrets (SSM).
// Environment variable: ENCRYPTION_KEY

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;   // 96-bit IV recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts `plaintext` using AES-256-GCM.
 * Returns a base64 string: iv (12 bytes) + authTag (16 bytes) + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack: iv | tag | ciphertext → base64
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts a base64 string produced by `encrypt()`.
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Encrypts a value only when ENCRYPTION_KEY is configured.
 * Falls back to plaintext in dev environments where the key is not set.
 * This prevents hard failures during local development.
 */
export function encryptIfConfigured(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  if (!process.env.ENCRYPTION_KEY) return value;
  return encrypt(value);
}

/**
 * Decrypts a value only when ENCRYPTION_KEY is configured and the value
 * looks like a base64 ciphertext.  Falls back to returning the value as-is
 * for rows written before encryption was enabled (plaintext migration).
 */
export function decryptIfConfigured(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  if (!process.env.ENCRYPTION_KEY) return value;
  try {
    return decrypt(value);
  } catch {
    // Value was stored as plaintext before encryption was enabled — return as-is.
    return value;
  }
}
