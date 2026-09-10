CREATE TABLE "RateLimitBucket" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 1,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
CREATE INDEX "RateLimitBucket_creatorId_scope_idx" ON "RateLimitBucket"("creatorId", "scope");
