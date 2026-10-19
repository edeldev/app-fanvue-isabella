import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  enrollmentUpdateMany: vi.fn(),
  executionUpdateMany: vi.fn(),
  logCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    automationExecution: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}));

import { reconcileInterruptedWorkflowSends } from "./reconcile-interrupted-sends";

const now = new Date("2026-10-19T15:00:00.000Z");
const candidate = {
  id: "execution-1",
  creatorId: "creator-1",
  fanId: "fan-1",
  enrollmentId: "enrollment-1",
  stepId: "step-1",
  status: "RUNNING",
  startedAt: new Date("2026-10-19T14:50:00.000Z"),
  step: { type: "SEND_MESSAGE", name: "Bienvenida" },
  enrollment: { currentStepId: "step-1", lockExpiresAt: new Date("2026-10-19T14:55:00.000Z") },
};

describe("reconcileInterruptedWorkflowSends", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findMany.mockResolvedValue([candidate]);
    mocks.enrollmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.executionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.logCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: (transaction: unknown) => Promise<unknown>) => callback({
      workflowEnrollment: { updateMany: mocks.enrollmentUpdateMany },
      automationExecution: { updateMany: mocks.executionUpdateMany },
      automationLog: { create: mocks.logCreate },
    }));
  });

  it("marks an interrupted send FAILED instead of making another Fanvue request", async () => {
    expect(await reconcileInterruptedWorkflowSends(now, "creator-1")).toBe(1);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ creatorId: "creator-1", status: "RUNNING" }),
    }));
    expect(mocks.enrollmentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "enrollment-1", currentStepId: "step-1" }),
      data: expect.objectContaining({ status: "FAILED", nextRunAt: null, lockOwner: null }),
    }));
    expect(mocks.executionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FAILED", reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE", nextRetryAt: null }),
    }));
    expect(mocks.logCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE" }),
    }));
  });

  it("ignores a step that is no longer current", async () => {
    mocks.findMany.mockResolvedValue([{ ...candidate, enrollment: { ...candidate.enrollment, currentStepId: "step-2" } }]);
    expect(await reconcileInterruptedWorkflowSends(now)).toBe(0);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not record a failure if another worker already claimed the enrollment", async () => {
    mocks.enrollmentUpdateMany.mockResolvedValue({ count: 0 });
    expect(await reconcileInterruptedWorkflowSends(now)).toBe(0);
    expect(mocks.executionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.logCreate).not.toHaveBeenCalled();
  });
});
