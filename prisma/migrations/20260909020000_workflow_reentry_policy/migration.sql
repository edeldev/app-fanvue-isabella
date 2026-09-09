CREATE TYPE "WorkflowReentryPolicy" AS ENUM ('ONCE', 'AFTER_DELAY', 'EVERY_EVENT');

ALTER TABLE "Workflow"
ADD COLUMN "reentryPolicy" "WorkflowReentryPolicy" NOT NULL DEFAULT 'ONCE',
ADD COLUMN "reentryDelayDays" INTEGER;
