CREATE TABLE "SchedulerHeartbeat" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3) NOT NULL,
    "lastFinishedAt" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerHeartbeat_pkey" PRIMARY KEY ("id")
);
