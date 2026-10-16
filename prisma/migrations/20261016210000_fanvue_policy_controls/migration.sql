ALTER TABLE "Fan"
ADD COLUMN "intimateContentOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "intimateContentOptInAt" TIMESTAMP(3),
ADD COLUMN "intimateContentOptInSource" TEXT;

ALTER TABLE "Settings"
ADD COLUMN "aiMessagingEnabled" BOOLEAN NOT NULL DEFAULT true;
