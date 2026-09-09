import { describe, expect, it } from "vitest";
import { buildWorkflowStepAnalytics, type WorkflowAnalyticsEvent } from "./step-analytics";

const send = (overrides: Partial<WorkflowAnalyticsEvent> = {}): WorkflowAnalyticsEvent => ({
  enrollmentId: "enrollment-1", workflowId: "workflow-1", fanId: "fan-1", type: "SEND",
  occurredAt: new Date("2026-09-09T12:00:00Z"), stepId: "step-1", stepName: "Saludo",
  templateId: "template-1", templateName: "Bienvenida", messageKind: "MESSAGE", ...overrides,
});

describe("buildWorkflowStepAnalytics", () => {
  it("attributes replies and conversions to the latest preceding message", () => {
    const result = buildWorkflowStepAnalytics([
      send(),
      send({ occurredAt: new Date("2026-09-09T12:05:00Z"), stepId: "step-2", stepName: "Oferta", templateId: "template-2", templateName: "Oferta PPV", messageKind: "PPV" }),
      { enrollmentId: "enrollment-1", workflowId: "workflow-1", fanId: "fan-1", type: "REPLY", occurredAt: new Date("2026-09-09T12:07:00Z") },
      { enrollmentId: "enrollment-1", workflowId: "workflow-1", fanId: "fan-1", type: "CONVERSION", occurredAt: new Date("2026-09-09T12:08:00Z"), amountMinor: 500 },
    ]);
    expect(result[0]).toMatchObject({ stepId: "step-1", responders: 0, conversions: 0 });
    expect(result[1]).toMatchObject({ stepId: "step-2", responders: 1, conversions: 1, attributedRevenueMinor: 500, averageResponseMinutes: 2 });
  });

  it("counts repeated replies from one fan only once", () => {
    const result = buildWorkflowStepAnalytics([send(),
      { enrollmentId: "enrollment-1", workflowId: "workflow-1", fanId: "fan-1", type: "REPLY", occurredAt: new Date("2026-09-09T12:02:00Z") },
      { enrollmentId: "enrollment-1", workflowId: "workflow-1", fanId: "fan-1", type: "REPLY", occurredAt: new Date("2026-09-09T12:04:00Z") },
    ]);
    expect(result[0]).toMatchObject({ responders: 1, responseRate: 100, averageResponseMinutes: 2 });
  });
});
