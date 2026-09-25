CREATE TYPE "FanLifecycleStage" AS ENUM (
  'FOLLOWER',
  'NEW_SUBSCRIBER',
  'ENGAGED',
  'FIRST_BUYER',
  'REPEAT_BUYER',
  'HIGH_VALUE',
  'VIP',
  'NON_RENEWING',
  'EXPIRED',
  'REACTIVATED'
);

ALTER TABLE "Fan"
  ADD COLUMN "lifecycleStage" "FanLifecycleStage" NOT NULL DEFAULT 'FOLLOWER',
  ADD COLUMN "lifecycleChangedAt" TIMESTAMP(3),
  ADD COLUMN "lifecycleReason" TEXT,
  ADD COLUMN "lifecycleOverride" "FanLifecycleStage",
  ADD COLUMN "automationPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "automationPauseReason" TEXT,
  ADD COLUMN "followedAt" TIMESTAMP(3),
  ADD COLUMN "acquisitionSource" TEXT,
  ADD COLUMN "acquisitionMetadata" JSONB;

CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'violet',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FanTag" (
  "creatorId" TEXT NOT NULL,
  "fanId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FanTag_pkey" PRIMARY KEY ("fanId", "tagId")
);

CREATE TABLE "FanNote" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "fanId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FanNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Fan_creatorId_lifecycleStage_lastActivityAt_idx" ON "Fan"("creatorId", "lifecycleStage", "lastActivityAt");
CREATE UNIQUE INDEX "Tag_creatorId_name_key" ON "Tag"("creatorId", "name");
CREATE INDEX "Tag_creatorId_name_idx" ON "Tag"("creatorId", "name");
CREATE INDEX "FanTag_creatorId_tagId_idx" ON "FanTag"("creatorId", "tagId");
CREATE INDEX "FanNote_creatorId_fanId_createdAt_idx" ON "FanNote"("creatorId", "fanId", "createdAt");

ALTER TABLE "Tag" ADD CONSTRAINT "Tag_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanTag" ADD CONSTRAINT "FanTag_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanTag" ADD CONSTRAINT "FanTag_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanTag" ADD CONSTRAINT "FanTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanNote" ADD CONSTRAINT "FanNote_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanNote" ADD CONSTRAINT "FanNote_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

