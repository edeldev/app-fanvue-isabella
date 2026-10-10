import { z } from "zod";

export const postAudienceSchema = z.enum([
  "subscribers",
  "followers-and-subscribers",
]);

export const fanvuePostSchema = z.object({
  uuid: z.string().uuid(),
  createdAt: z.string().datetime(),
  text: z.string().nullable(),
  price: z.number().nullable(),
  mediaUuids: z.array(z.string().uuid()).optional().default([]),
  mediaPreviewUuid: z.string().uuid().nullable(),
  audience: postAudienceSchema,
  publishAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  commentsCount: z.number().int().nonnegative().optional().default(0),
  likesCount: z.number().int().nonnegative().optional().default(0),
}).passthrough();

export const fanvuePostsPageSchema = z.object({
  data: z.array(fanvuePostSchema),
  nextCursor: z.string().nullable().optional(),
  total: z.number().nullable().optional(),
});

