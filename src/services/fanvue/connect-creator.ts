import { encryptSecret } from "@/lib/crypto/encryption";
import { fanvueRequest } from "@/lib/fanvue/client";
import { getFanvueConfig } from "@/lib/fanvue/config";
import { fanvueCurrentUserSchema, type FanvueTokenResponse } from "@/lib/fanvue/schemas";
import { prisma } from "@/lib/prisma";

export async function connectFanvueCreator(tokens: FanvueTokenResponse): Promise<string> {
  const profile = await fanvueRequest("/v1/users/me", tokens.access_token, fanvueCurrentUserSchema);
  if (!profile.isCreator || !profile.roles.includes("creator")) {
    throw new Error("FANVUE_ACCOUNT_IS_NOT_A_CREATOR");
  }
  const config = getFanvueConfig();
  const encryptedRefreshToken = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token, config.encryptionKey)
    : undefined;
  const grantedScopes = tokens.scope
    ? tokens.scope.split(/\s+/).filter(Boolean)
    : [...config.scopes];

  return prisma.$transaction(async (transaction) => {
    const creator = await transaction.creator.upsert({
      where: { fanvueUserId: profile.uuid },
      update: {
        username: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        fanvueImageCount: profile.contentCounts?.imageCount,
        fanvueVideoCount: profile.contentCounts?.videoCount,
        fanvueLikesCount: profile.likesCount,
      },
      create: {
        fanvueUserId: profile.uuid, username: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        fanvueImageCount: profile.contentCounts?.imageCount,
        fanvueVideoCount: profile.contentCounts?.videoCount,
        fanvueLikesCount: profile.likesCount,
        settings: { create: {} },
      },
    });
    await transaction.integrationCredential.upsert({
      where: { creatorId_provider: { creatorId: creator.id, provider: "FANVUE" } },
      update: {
        encryptedAccessToken: encryptSecret(tokens.access_token, config.encryptionKey),
        ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1_000),
        scopes: grantedScopes, apiVersion: config.apiVersion,
      },
      create: {
        creatorId: creator.id, provider: "FANVUE",
        encryptedAccessToken: encryptSecret(tokens.access_token, config.encryptionKey),
        encryptedRefreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1_000),
        scopes: grantedScopes, apiVersion: config.apiVersion,
      },
    });
    return creator.id;
  });
}
