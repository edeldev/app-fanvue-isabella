ALTER TABLE "Content"
ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Content_creatorId_isArchived_createdAt_idx" ON "Content"("creatorId", "isArchived", "createdAt");
CREATE INDEX "Content_creatorId_isFavorite_createdAt_idx" ON "Content"("creatorId", "isFavorite", "createdAt");
