ALTER TABLE "Fan"
ADD COLUMN "firstSubscribedAt" TIMESTAMP(3),
ADD COLUMN "renewalSignalsConflict" BOOLEAN NOT NULL DEFAULT false;
