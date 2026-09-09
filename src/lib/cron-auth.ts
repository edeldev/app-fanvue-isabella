import { timingSafeEqual } from "node:crypto";

export function isCronRequestAuthorized(authorization: string | null, secret: string | undefined) {
  if (!secret || secret.length < 16 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
