import { decryptSecret, encryptSecret } from "@/lib/crypto/encryption";
import { getFanvueConfig } from "@/lib/fanvue/config";
import { refreshFanvueToken } from "@/lib/fanvue/oauth";
import { prisma } from "@/lib/prisma";

const REFRESH_BUFFER_MS = 5 * 60 * 1_000;

export async function getValidFanvueAccessToken(creatorId: string): Promise<string> {
  const credential = await prisma.integrationCredential.findUniqueOrThrow({
    where: { creatorId_provider: { creatorId, provider: "FANVUE" } },
  });
  const config = getFanvueConfig();
  if (credential.tokenExpiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS) {
    return decryptSecret(credential.encryptedAccessToken, config.encryptionKey);
  }
  if (!credential.encryptedRefreshToken) throw new Error("FANVUE_REAUTHENTICATION_REQUIRED");
  const currentRefreshToken = decryptSecret(credential.encryptedRefreshToken, config.encryptionKey);
  const refreshed = await refreshFanvueToken(currentRefreshToken);
  const refreshToken = refreshed.refresh_token ?? currentRefreshToken;
  await prisma.integrationCredential.update({
    where: { id: credential.id },
    data: {
      encryptedAccessToken: encryptSecret(refreshed.access_token, config.encryptionKey),
      encryptedRefreshToken: encryptSecret(refreshToken, config.encryptionKey),
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1_000),
      scopes: refreshed.scope
        ? refreshed.scope.split(/\s+/).filter(Boolean)
        : credential.scopes,
    },
  });
  return refreshed.access_token;
}
