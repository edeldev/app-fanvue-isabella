import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";

function deriveKey(secret: string): Buffer {
  if (secret.length < 32) throw new Error("Encryption secret must be at least 32 characters");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [FORMAT_VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(value: string, secret: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
  if (version !== FORMAT_VERSION || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("Unsupported encrypted value format");
  }
  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

