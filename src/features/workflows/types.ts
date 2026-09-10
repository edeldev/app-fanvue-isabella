import type { WorkflowDefinitionInput } from "@/domain/workflows/definition";
import type { WorkflowStepAnalytics } from "@/domain/workflows/step-analytics";

export type WorkflowStepAnalyticsView = WorkflowStepAnalytics;

export interface WorkflowView {
  id: string;
  name: string;
  version: number;
  priority: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isPrimary: boolean;
  triggerEvent: WorkflowDefinitionInput["triggerEvent"];
  reentryPolicy: WorkflowDefinitionInput["reentryPolicy"];
  reentryDelayDays: number | null;
  sendWindowEnabled: boolean;
  sendWindowTimezone: string;
  sendWindowStartMinute: number;
  sendWindowEndMinute: number;
  sendWindowDays: number[];
  sendLimitsEnabled: boolean;
  maxMessagesPerHour: number;
  maxMessagesPerDay: number;
  minMinutesBetweenFanMessages: number;
  pauseOnFanReply: boolean;
  replySilenceMinutes: number;
  replyAttributionHours: number;
  goalType: WorkflowDefinitionInput["goalType"];
  goalAmountMinor: number | null;
  publishedAt: string | null;
  enrollments: number;
  activeEnrollments: number;
  steps: WorkflowDefinitionInput["steps"];
}

export interface TemplateOption {
  id: string;
  name: string;
  type: string;
  priceMinor: number | null;
  previewUuid: string | null;
}

export interface FanOption {
  id: string;
  name: string;
  username: string | null;
}

export interface EnrollmentView {
  id: string;
  status: "ACTIVE" | "WAITING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
  fanName: string;
  fanUsername: string | null;
  workflowName: string;
  currentStepName: string | null;
  nextRunAt: string | null;
  pauseReason: string | null;
  hasStarted: boolean;
  pausedRemainingSeconds: number | null;
}

export interface EnrollmentHistorySummaryView {
  id: string;
  status: EnrollmentView["status"];
  fanName: string;
  fanUsername: string | null;
  workflowName: string;
  startedAt: string;
  endedAt: string | null;
}

export interface EnrollmentHistoryLogView {
  id: string;
  eventType: string;
  level: "INFO" | "WARN" | "ERROR";
  explanation: string;
  reasonCode: string | null;
  occurredAt: string;
  stepName: string | null;
  templateName: string | null;
  detail: string | null;
  detailDate: string | null;
}

export interface AutomationLogView {
  id: string;
  eventType: string;
  explanation: string;
  occurredAt: string;
  fanName: string | null;
}

export interface WorkflowAnalyticsView {
  workflowId: string;
  workflowName: string;
  uniqueFans: number;
  enrollments: number;
  active: number;
  completed: number;
  cancelled: number;
  failed: number;
  messagesSent: number;
  fansReplied: number;
  conversions: number;
  conversionRate: number;
  attributedRevenueMinor: number;
  averageConversionMinutes: number | null;
}
