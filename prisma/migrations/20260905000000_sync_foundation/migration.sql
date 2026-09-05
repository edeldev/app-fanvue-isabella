-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubscriptionStatus" ADD VALUE 'PENDING';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "Fan" ADD COLUMN     "isTopSpender" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "fanvueSubscriptionId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_creatorId_fanId_startedAt_key" ON "Subscription"("creatorId", "fanId", "startedAt");
