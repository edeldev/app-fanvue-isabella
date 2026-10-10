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
  mediaPreviewUuid: z.string().uuid().nullable(),
  audience: postAudienceSchema,
  publishAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
}).passthrough();

export const fanvuePostsPageSchema = z.object({
  data: z.array(fanvuePostSchema),
  nextCursor: z.string().nullable().optional(),
  total: z.number().optional(),
});

