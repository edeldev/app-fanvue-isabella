ALTER TABLE "Message"
ADD COLUMN "mediaUuids" JSONB,
ADD COLUMN "mediaPreviewUuid" TEXT,
ADD COLUMN "priceMinor" INTEGER;
