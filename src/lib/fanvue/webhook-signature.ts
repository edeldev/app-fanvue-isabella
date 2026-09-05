import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_TOLERANCE_SECONDS = 300;

export function verifyFanvueWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }));
  const timestamp = Number(parts.t);
  const signature = parts.v0;
  if (!Number.isInteger(timestamp) || !signature || Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", signingSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
