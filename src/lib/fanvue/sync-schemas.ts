import { z } from "zod";

export const fanvueFanSchema = z.object({
  uuid: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
  nickname: z.string().nullable(),
  isTopSpender: z.boolean(),
  avatarUrl: z.string().nullable(),
  registeredAt: z.string(),
});

function cursorPage<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export const followersPageSchema = cursorPage(fanvueFanSchema);

export const subscriberSchema = fanvueFanSchema.extend({
  subscription: z.object({
    status: z.enum(["active", "cancelled", "pending_confirmation", "paused"]),
    price: z.number(),
    amountPaid: z.number(),
    currentPeriodStart: z.string(),
    currentPeriodEnd: z.string().nullable(),
    autoRenewalEnabled: z.boolean(),
  }).nullable(),
  firstSubscribedAt: z.string().nullable(),
});

export const subscribersPageSchema = cursorPage(subscriberSchema);

const lastMessageSchema = z.object({
  text: z.string().nullable(),
  type: z.string(),
  uuid: z.string(),
  sentAt: z.string().nullable(),
  hasMedia: z.boolean().nullable(),
  hasGif: z.boolean(),
  mediaType: z.enum(["image", "video", "audio", "document"]).nullable(),
  senderUuid: z.string().uuid(),
  senderRole: z.enum(["FAN", "CREATOR", "AGENCY", "SYSTEM"]),
  sentByUserId: z.string().uuid().nullable(),
  status: z.enum(["Sent", "Delivered", "Read"]).nullable().optional(),
});

export const chatSchema = z.object({
  createdAt: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  isRead: z.boolean(),
  isMuted: z.boolean(),
  unreadMessagesCount: z.number(),
  user: fanvueFanSchema,
  lastMessage: lastMessageSchema.nullable(),
  isCreator: z.boolean().optional(),
  online: z.boolean().optional(),
  lastSeenAt: z.string().nullable().optional(),
});

export const chatsPageSchema = cursorPage(chatSchema).extend({ total: z.number().nullable() });

export const messagesPageSchema = z.object({
  data: z.array(z.object({
    uuid: z.string(), text: z.string().nullable(), sentAt: z.string().nullable(),
    sender: z.object({ uuid: z.string(), handle: z.string().optional().default("") }).passthrough(),
    recipient: z.object({
      uuid: z.string().optional(),
      handle: z.string().optional(),
    }).passthrough().optional().default({}),
    hasMedia: z.boolean().nullable().optional().default(false),
    mediaType: z.enum(["image", "video", "audio", "document"]).nullable().optional().default(null),
    mediaUuids: z.array(z.string()).optional().default([]),
    mediaPreviewUuid: z.string().nullable().optional().default(null),
    previewMediaUuid: z.string().nullable().optional().default(null),
    media_preview_uuid: z.string().nullable().optional().default(null),
    type: z.string().optional().default("SINGLE_RECIPIENT"),
    isRead: z.boolean().optional().default(false),
    pricing: z.object({ USD: z.object({ price: z.number() }) }).nullable().optional().default(null),
    purchasedAt: z.string().nullable().optional().default(null),
    gif: z.object({
      title: z.string().nullable().optional().default(null),
      url: z.string().nullable().optional().default(null),
    }).passthrough().nullable().optional().default(null),
  }).passthrough()),
  pagination: z.object({
    page: z.number(), size: z.number(), hasMore: z.boolean(),
  }).passthrough().optional(),
  dateFilter: z.object({
    sentBefore: z.string().nullable().optional(),
    receivedBefore: z.string().nullable().optional(),
  }).passthrough().nullable().optional(),
}).passthrough();

export const sentMessageSchema = z.object({ messageUuid: z.string() });

export const mediaUploadSessionSchema = z.object({
  mediaUuid: z.string().uuid(),
  uploadId: z.string(),
  partSize: z.number().int().positive(),
  maxParts: z.number().int().positive(),
  totalParts: z.number().int().positive().nullable(),
});

export const mediaUploadCompleteSchema = z.object({
  status: z.enum(["created", "processing", "ready", "error"]),
});

export const messageMediaSchema = z.object({
  results: z.record(z.string(), z.object({
    uuid: z.string(),
    messageUuid: z.string(),
    mediaType: z.enum(["image", "video", "audio", "document", "unknown"]),
    name: z.string().nullable(),
    variants: z.array(z.object({
      variantType: z.enum(["main", "thumbnail", "thumbnail_gallery", "blurred"]),
      displayPosition: z.number(),
      url: z.string().optional(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      lengthMs: z.number().nullable(),
    })).optional().default([]),
  }).passthrough().nullable()),
  errors: z.array(z.unknown()),
});

export const chatMediaPageSchema = z.object({
  data: z.array(z.object({
    uuid: z.string(),
    messageUuid: z.string(),
    mediaType: z.enum(["image", "video", "audio", "document", "unknown"]),
    name: z.string().nullable().optional().default(null),
    pricing: z.object({ USD: z.object({ price: z.number() }) }).nullable().optional().default(null),
    purchasedAt: z.string().nullable().optional().default(null),
    amountPaid: z.object({ USD: z.object({ price: z.number() }) }).nullable().optional().default(null),
    variants: z.array(z.object({
      uuid: z.string().optional(),
      variantType: z.string(),
      displayPosition: z.number().optional().default(0),
      url: z.string().optional(),
      width: z.number().nullable().optional().default(null),
      height: z.number().nullable().optional().default(null),
      lengthMs: z.number().nullable().optional().default(null),
    }).passthrough()).optional().default([]),
  }).passthrough()),
  nextCursor: z.string().nullable().optional().default(null),
}).passthrough();

export const mediaBulkSchema = z.object({
  results: z.record(z.string(), z.object({
    uuid: z.string(),
    status: z.enum(["created", "processing", "ready", "error"]),
    mediaType: z.enum(["image", "video", "audio", "document"]).optional(),
    name: z.string().nullable().optional(),
    variants: z.array(z.object({
      variantType: z.string(),
      url: z.string().optional(),
    }).passthrough()).optional().default([]),
  }).passthrough().nullable()),
  errors: z.array(z.unknown()).optional().default([]),
}).passthrough();

export const vaultMediaPageSchema = z.object({
  data: z.array(z.object({
    uuid: z.string().uuid(),
    status: z.enum(["created", "processing", "ready", "error"]),
    name: z.string().nullable().optional(),
    mediaType: z.enum(["image", "video", "audio", "document"]).optional(),
    createdAt: z.string().nullable().optional(),
    variants: z.array(z.object({
      variantType: z.enum(["main", "thumbnail", "thumbnail_gallery", "blurred"]),
      url: z.string().optional(),
    }).passthrough()).optional().default([]),
  }).passthrough()),
  nextCursor: z.string().nullable(),
}).passthrough();

export const creatorListPageSchema = cursorPage(z.object({
  uuid: z.string().uuid(),
  displayName: z.string(),
  handle: z.string(),
  isCreator: z.boolean(),
})).extend({ total: z.number().nullable() });

export const accountSchema = z.object({
  account: z.object({
    earnings: z.object({ total: z.number().int() }),
    fans: z.object({ followers: z.number().int(), subscribers: z.number().int() }),
  }),
});

export const fanInsightsBulkSchema = z.object({
  results: z.record(z.string(), z.object({
    spending: z.object({
      total: z.object({ total: z.number().int() }),
    }),
  }).nullable()),
  errors: z.array(z.unknown()),
});

const earningSources = [
  "all", "affiliate", "appStore", "checkoutLink", "fanExperience", "mediaLink",
  "message", "post", "referral", "renewal", "subscription", "tip", "giveaway",
  "refund", "chargeback",
] as const;

export const earningSchema = z.object({
  date: z.string(),
  gross: z.number().int(),
  net: z.number().int(),
  currency: z.string().nullable(),
  source: z.enum(earningSources),
  transactionOrderId: z.string(),
  transactionOrderStatus: z.enum(["availableForPayout", "pendingBalance"]),
  reversedTransactionOrderId: z.string().optional(),
  messageUuid: z.string().uuid().optional(),
  postUuid: z.string().uuid().optional(),
  user: z.object({
    uuid: z.string().uuid(), handle: z.string(), displayName: z.string(),
    nickname: z.string().nullable(), isTopSpender: z.boolean(),
  }).nullable(),
});

export const earningsPageSchema = cursorPage(earningSchema);
