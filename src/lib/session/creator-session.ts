import { decryptSecret, encryptSecret } from "@/lib/crypto/encryption";
import { getFanvueConfig } from "@/lib/fanvue/config";

export const CREATOR_SESSION_COOKIE = "fanvue_creator_session";

export function createCreatorSession(creatorId: string): string {
  return encryptSecret(creatorId, getFanvueConfig().encryptionKey);
}

export function readCreatorSession(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value, getFanvueConfig().encryptionKey);
  } catch {
    return null;
  }
}
