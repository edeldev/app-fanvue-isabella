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
  steps: WorkflowDefinitionInput["steps"];
}

export interface TemplateOption {
  id: string;
  name: string;
  type: string;
}
