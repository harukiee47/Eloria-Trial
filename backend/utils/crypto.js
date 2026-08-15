import crypto from "crypto";

/**
 * AES-256-GCM encryption for connector tokens/API keys stored in Firestore.
 * Set CONNECTOR_ENCRYPTION_KEY in .env — must be a 32-byte value.
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function getKey() {
  const raw = process.env.CONNECTOR_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "CONNECTOR_ENCRYPTION_KEY is not set. Add a 32-byte hex key to backend/.env."
    );
  }
  // Accept either a 64-char hex string or any string (hashed down to 32 bytes).
  return /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload) {
  if (!payload) return null;
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}