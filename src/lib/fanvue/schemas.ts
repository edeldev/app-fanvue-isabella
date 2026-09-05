import { z } from "zod";

export const fanvueTokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1).optional(),
  token_type: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string().default(""),
});

export type FanvueTokenResponse = z.infer<typeof fanvueTokenSchema>;

export const fanvueCurrentUserSchema = z.object({
  uuid: z.string().uuid(),
  email: z.string().email(),
  handle: z.string(),
  bio: z.string(),
  displayName: z.string(),
  isCreator: z.boolean(),
  roles: z.array(z.enum(["creator", "agency", "agency_admin"])),
  isDiscoverable: z.boolean(),
  isInCuratedSection: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  likesCount: z.number().optional(),
  fanCounts: z.object({ followersCount: z.number(), subscribersCount: z.number() }).optional(),
  contentCounts: z.object({
    imageCount: z.number(), videoCount: z.number(), audioCount: z.number(),
    postCount: z.number(), payToViewPostCount: z.number(),
  }).optional(),
});

export type FanvueCurrentUser = z.infer<typeof fanvueCurrentUserSchema>;
