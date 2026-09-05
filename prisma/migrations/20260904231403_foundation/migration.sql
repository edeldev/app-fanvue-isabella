-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'WAITING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ValidationDecision" AS ENUM ('SEND', 'WAIT', 'SKIP', 'CANCEL', 'CHANGE_WORKFLOW', 'RETRY');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('SEND_MESSAGE', 'WAIT', 'SEND_OFFER', 'SEND_PPV', 'CONDITION', 'CHANGE_WORKFLOW', 'END');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCEL_AT_PERIOD_END', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResumeStrategy" AS ENUM ('MANUAL', 'AFTER_5_MINUTES', 'AFTER_10_MINUTES', 'AFTER_15_MINUTES', 'AFTER_30_MINUTES', 'AFTER_60_MINUTES', 'NEVER');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "fanvueUserId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fan" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fanvueUserId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "isFollower" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "fanvueSubscriptionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "currentPeriodEndsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "fanvuePaymentId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "externalMessageId" TEXT,
    "externalPostId" TEXT,
    "contentId" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "fanvueConversationId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fanvueMessageId" TEXT NOT NULL,
    "templateId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "text" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "associatedContentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fanvueContentId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkflowStepType" NOT NULL,
    "config" JSONB NOT NULL,
    "messageTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEnrollment" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "cancellationReason" TEXT,
    "lastResult" JSONB,
    "lockedAt" TIMESTAMP(3),
    "lockOwner" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "decision" "ValidationDecision",
    "reasonCode" TEXT,
    "reason" TEXT,
    "evidence" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fanId" TEXT,
    "enrollmentId" TEXT,
    "executionId" TEXT,
    "eventType" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "reasonCode" TEXT,
    "explanation" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanEvent" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fanId" TEXT,
    "webhookEventId" TEXT,
    "type" TEXT NOT NULL,
    "externalEventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "apiVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "resumeStrategy" "ResumeStrategy" NOT NULL DEFAULT 'MANUAL',
    "resumeIfNoNewMessages" BOOLEAN NOT NULL DEFAULT true,
    "validateBeforeResume" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "sendingWindowStart" TEXT NOT NULL DEFAULT '09:00',
    "sendingWindowEnd" TEXT NOT NULL DEFAULT '21:00',
    "minimumDelaySeconds" INTEGER NOT NULL DEFAULT 60,
    "maximumRetries" INTEGER NOT NULL DEFAULT 3,
    "debugMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_fanvueUserId_key" ON "Creator"("fanvueUserId");

-- CreateIndex
CREATE INDEX "Fan_creatorId_isFollower_idx" ON "Fan"("creatorId", "isFollower");

-- CreateIndex
CREATE INDEX "Fan_creatorId_lastActivityAt_idx" ON "Fan"("creatorId", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "Fan_creatorId_fanvueUserId_key" ON "Fan"("creatorId", "fanvueUserId");

-- CreateIndex
CREATE INDEX "Subscription_creatorId_fanId_status_idx" ON "Subscription"("creatorId", "fanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_creatorId_fanvueSubscriptionId_key" ON "Subscription"("creatorId", "fanvueSubscriptionId");

-- CreateIndex
CREATE INDEX "Purchase_creatorId_fanId_purchasedAt_idx" ON "Purchase"("creatorId", "fanId", "purchasedAt");

-- CreateIndex
CREATE INDEX "Purchase_creatorId_externalMessageId_idx" ON "Purchase"("creatorId", "externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_creatorId_fanvuePaymentId_key" ON "Purchase"("creatorId", "fanvuePaymentId");

-- CreateIndex
CREATE INDEX "Conversation_creatorId_lastMessageAt_idx" ON "Conversation"("creatorId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_creatorId_fanId_key" ON "Conversation"("creatorId", "fanId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_creatorId_fanvueConversationId_key" ON "Conversation"("creatorId", "fanvueConversationId");

-- CreateIndex
CREATE INDEX "Message_creatorId_conversationId_sentAt_idx" ON "Message"("creatorId", "conversationId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_creatorId_fanvueMessageId_key" ON "Message"("creatorId", "fanvueMessageId");

-- CreateIndex
CREATE INDEX "MessageTemplate_creatorId_category_status_idx" ON "MessageTemplate"("creatorId", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_creatorId_name_key" ON "MessageTemplate"("creatorId", "name");

-- CreateIndex
CREATE INDEX "Content_creatorId_type_idx" ON "Content"("creatorId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Content_creatorId_fanvueContentId_key" ON "Content"("creatorId", "fanvueContentId");

-- CreateIndex
CREATE INDEX "Workflow_creatorId_status_priority_idx" ON "Workflow"("creatorId", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_creatorId_stableKey_version_key" ON "Workflow"("creatorId", "stableKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_workflowId_position_key" ON "WorkflowStep"("workflowId", "position");

-- CreateIndex
CREATE INDEX "WorkflowEnrollment_creatorId_status_nextRunAt_idx" ON "WorkflowEnrollment"("creatorId", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "WorkflowEnrollment_creatorId_fanId_status_idx" ON "WorkflowEnrollment"("creatorId", "fanId", "status");

-- CreateIndex
CREATE INDEX "WorkflowEnrollment_lockExpiresAt_idx" ON "WorkflowEnrollment"("lockExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationExecution_idempotencyKey_key" ON "AutomationExecution"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationExecution_creatorId_status_nextRetryAt_idx" ON "AutomationExecution"("creatorId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "AutomationExecution_enrollmentId_createdAt_idx" ON "AutomationExecution"("enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationLog_creatorId_occurredAt_idx" ON "AutomationLog"("creatorId", "occurredAt");

-- CreateIndex
CREATE INDEX "AutomationLog_fanId_occurredAt_idx" ON "AutomationLog"("fanId", "occurredAt");

-- CreateIndex
CREATE INDEX "FanEvent_creatorId_fanId_occurredAt_idx" ON "FanEvent"("creatorId", "fanId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "FanEvent_creatorId_externalEventId_key" ON "FanEvent"("creatorId", "externalEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_processedAt_failedAt_idx" ON "WebhookEvent"("processedAt", "failedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_creatorId_providerEventId_key" ON "WebhookEvent"("creatorId", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_creatorId_provider_key" ON "IntegrationCredential"("creatorId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_creatorId_key" ON "Settings"("creatorId");

-- AddForeignKey
ALTER TABLE "Fan" ADD CONSTRAINT "Fan_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_associatedContentId_fkey" FOREIGN KEY ("associatedContentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_messageTemplateId_fkey" FOREIGN KEY ("messageTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEnrollment" ADD CONSTRAINT "WorkflowEnrollment_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEnrollment" ADD CONSTRAINT "WorkflowEnrollment_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEnrollment" ADD CONSTRAINT "WorkflowEnrollment_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "WorkflowEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "WorkflowEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanEvent" ADD CONSTRAINT "FanEvent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanEvent" ADD CONSTRAINT "FanEvent_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanEvent" ADD CONSTRAINT "FanEvent_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce the MVP invariant: a fan can have at most one non-terminal primary workflow.
CREATE UNIQUE INDEX "WorkflowEnrollment_one_active_primary_per_fan"
ON "WorkflowEnrollment" ("creatorId", "fanId")
WHERE "isPrimary" = true AND "status" IN ('ACTIVE', 'WAITING', 'PAUSED');
