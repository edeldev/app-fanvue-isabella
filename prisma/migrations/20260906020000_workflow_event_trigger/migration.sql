ALTER TABLE "Workflow" ADD COLUMN "triggerEvent" TEXT NOT NULL DEFAULT 'MANUAL';
CREATE INDEX "Workflow_creatorId_status_triggerEvent_priority_idx" ON "Workflow"("creatorId", "status", "triggerEvent", "priority");
