ALTER TABLE "Workflow"
ADD COLUMN "sendLimitsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maxMessagesPerHour" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "maxMessagesPerDay" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN "minMinutesBetweenFanMessages" INTEGER NOT NULL DEFAULT 60;

CREATE TABLE "WorkflowSendReservation" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "fanId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  CONSTRAINT "WorkflowSendReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkflowSendReservation_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkflowSendReservation_enrollmentId_stepId_key" ON "WorkflowSendReservation"("enrollmentId", "stepId");
CREATE INDEX "WorkflowSendReservation_workflowId_reservedAt_idx" ON "WorkflowSendReservation"("workflowId", "reservedAt");
CREATE INDEX "WorkflowSendReservation_creatorId_fanId_reservedAt_idx" ON "WorkflowSendReservation"("creatorId", "fanId", "reservedAt");
