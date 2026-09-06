import type { WorkflowDefinitionInput } from "@/domain/workflows/definition";

export interface WorkflowView {
  id: string;
  name: string;
  version: number;
  priority: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isPrimary: boolean;
  publishedAt: string | null;
  enrollments: number;
  activeEnrollments: number;
  steps: WorkflowDefinitionInput["steps"];
}

export interface TemplateOption {
  id: string;
  name: string;
  type: string;
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

export interface AutomationLogView {
  id: string;
  eventType: string;
  explanation: string;
  occurredAt: string;
  fanName: string | null;
}
