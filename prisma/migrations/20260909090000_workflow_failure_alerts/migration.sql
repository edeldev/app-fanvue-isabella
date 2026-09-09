ALTER TABLE "AutomationLog"
ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "AutomationLog_creatorId_level_reviewedAt_idx"
ON "AutomationLog"("creatorId", "level", "reviewedAt");
