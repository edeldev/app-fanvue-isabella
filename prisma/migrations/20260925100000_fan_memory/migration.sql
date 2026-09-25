CREATE TYPE "FanMemoryType" AS ENUM ('FACT', 'INFERENCE');
CREATE TYPE "FanMemoryStatus" AS ENUM ('ACTIVE', 'DISMISSED');

CREATE TABLE "FanMemory" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "fanId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "type" "FanMemoryType" NOT NULL DEFAULT 'INFERENCE',
  "status" "FanMemoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "source" TEXT NOT NULL,
  "evidence" TEXT,
  "sourceMessageId" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FanMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FanMemory_fanId_category_key_key" ON "FanMemory"("fanId", "category", "key");
CREATE INDEX "FanMemory_creatorId_fanId_status_observedAt_idx" ON "FanMemory"("creatorId", "fanId", "status", "observedAt");
ALTER TABLE "FanMemory" ADD CONSTRAINT "FanMemory_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanMemory" ADD CONSTRAINT "FanMemory_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

