import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";

// AES-256-GCM symmetric encryption for integration secrets at rest.
// Key resolution order:
//   1. INTEGRATION_ENCRYPTION_KEY  (preferred — base64 32 bytes or 32+ char string)
//   2. AUTH_SECRET                 (fallback — same value used for cookie signing)
// Without either, encryption is refused so we never persist plaintext silently.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENVELOPE_PREFIX = "v1:";

function resolveKey(): Buffer {
  const raw =
    process.env.INTEGRATION_ENCRYPTION_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim();

  if (!raw) {
    throw new Error(
      "Integration encryption key is not configured. Set INTEGRATION_ENCRYPTION_KEY (32+ chars) or AUTH_SECRET."
    );
  }

  // Allow base64-encoded 32-byte keys; otherwise hash to 32 bytes.
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 44) {
    try {
      const decoded = Buffer.from(raw, "base64");
      if (decoded.length === 32) {
        return decoded;
      }
    } catch {
      // fall through to hash path
    }
  }

  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt an empty value");
  }

  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return (
    ENVELOPE_PREFIX +
    Buffer.concat([iv, authTag, ciphertext]).toString("base64")
  );
}

export function decryptSecret(envelope: string): string {
  if (!envelope?.startsWith(ENVELOPE_PREFIX)) {
    throw new Error("Encrypted value is missing version prefix");
  }

  const key = resolveKey();
  const payload = Buffer.from(envelope.slice(ENVELOPE_PREFIX.length), "base64");

  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Encrypted value is truncated");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
}

export function maskSecret(plaintext: string): string {
  if (!plaintext) {
    return "";
  }
  if (plaintext.length <= 8) {
    return "*".repeat(plaintext.length);
  }
  return `${plaintext.slice(0, 4)}${"*".repeat(plaintext.length - 8)}${plaintext.slice(-4)}`;
}
