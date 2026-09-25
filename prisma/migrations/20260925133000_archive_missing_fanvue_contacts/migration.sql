ALTER TABLE "Fan"
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastSeenOnFanvueAt" TIMESTAMP(3);

CREATE INDEX "Fan_creatorId_isArchived_lastActivityAt_idx"
ON "Fan"("creatorId", "isArchived", "lastActivityAt");
