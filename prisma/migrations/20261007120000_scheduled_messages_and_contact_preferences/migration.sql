ALTER TABLE "Fan"
ADD COLUMN "doNotMessage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "doNotMessageReason" TEXT,
ADD COLUMN "doNotMessageAt" TIMESTAMP(3);

CREATE TABLE "ScheduledMessage" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "fanId" TEXT NOT NULL,
  "templateId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "text" TEXT,
  "media" JSONB,
  "mediaPreviewUuid" TEXT,
  "priceMinor" INTEGER,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "fanvueMessageId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Fan_creatorId_doNotMessage_idx" ON "Fan"("creatorId", "doNotMessage");
CREATE INDEX "ScheduledMessage_status_scheduledAt_idx" ON "ScheduledMessage"("status", "scheduledAt");
CREATE INDEX "ScheduledMessage_creatorId_fanId_scheduledAt_idx" ON "ScheduledMessage"("creatorId", "fanId", "scheduledAt");

ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
