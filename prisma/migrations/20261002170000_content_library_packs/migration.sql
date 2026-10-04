CREATE TYPE "ContentPackStatus" AS ENUM ('DRAFT', 'READY', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ContentPackType" AS ENUM ('PHOTO_PACK', 'VIDEO_PACK', 'PHOTO_VIDEO', 'PPV', 'SUBSCRIBER', 'PREMIUM', 'BUNDLE', 'CUSTOM');

CREATE TABLE "ContentPack" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "categoryId" TEXT,
  "coverContentId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "ContentPackType" NOT NULL DEFAULT 'CUSTOM',
  "status" "ContentPackStatus" NOT NULL DEFAULT 'DRAFT',
  "priceMinor" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentPack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentPack_creatorId_name_key" ON "ContentPack"("creatorId", "name");
CREATE INDEX "ContentPack_creatorId_status_updatedAt_idx" ON "ContentPack"("creatorId", "status", "updatedAt");
CREATE INDEX "ContentPack_creatorId_categoryId_idx" ON "ContentPack"("creatorId", "categoryId");

CREATE TABLE "ContentPackAsset" (
  "packId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentPackAsset_pkey" PRIMARY KEY ("packId", "contentId")
);
CREATE UNIQUE INDEX "ContentPackAsset_packId_position_key" ON "ContentPackAsset"("packId", "position");
CREATE INDEX "ContentPackAsset_contentId_idx" ON "ContentPackAsset"("contentId");

ALTER TABLE "ContentPack" ADD CONSTRAINT "ContentPack_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPack" ADD CONSTRAINT "ContentPack_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentPack" ADD CONSTRAINT "ContentPack_coverContentId_fkey" FOREIGN KEY ("coverContentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentPackAsset" ADD CONSTRAINT "ContentPackAsset_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ContentPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPackAsset" ADD CONSTRAINT "ContentPackAsset_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
