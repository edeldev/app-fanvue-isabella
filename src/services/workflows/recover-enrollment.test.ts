import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enrollmentFindFirst: vi.fn(),
  executionFindUnique: vi.fn(),
  reservationFindUnique: vi.fn(),
  transaction: vi.fn(),
  enrollmentUpdateMany: vi.fn(),
  executionUpdate: vi.fn(),
  logCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowEnrollment: { findFirst: mocks.enrollmentFindFirst },
    automationExecution: { findUnique: mocks.executionFindUnique },
    workflowSendReservation: { findUnique: mocks.reservationFindUnique },
    $transaction: mocks.transaction,
  },
}));

import { recoverFailedEnrollment } from "./recover-enrollment";

const step = { id: "step-1", name: "Mensaje", type: "SEND_MESSAGE", position: 1, config: {} };
const finalStep = { id: "step-2", name: "Finalizar", type: "FINISH", position: 2, config: {} };
const enrollment = {
  id: "enrollment-1",
  creatorId: "creator-1",
  fanId: "fan-1",
  status: "FAILED",
  currentStepId: step.id,
  currentStep: step,
  workflow: { name: "Bienvenida", steps: [step, finalStep] },
  fan: { displayName: "Fan", username: "fan" },
};
const execution = { id: "execution-1", status: "FAILED", reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE", attempt: 1, evidence: null };

describe("recoverFailedEnrollment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.enrollmentFindFirst.mockResolvedValue(enrollment);
    mocks.executionFindUnique.mockResolvedValue(execution);
    mocks.enrollmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.executionUpdate.mockResolvedValue({});
    mocks.logCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: (transaction: unknown) => Promise<unknown>) => callback({
      workflowEnrollment: { updateMany: mocks.enrollmentUpdateMany },
      automationExecution: { update: mocks.executionUpdate },
      automationLog: { create: mocks.logCreate },
    }));
  });

  it.each(["retry_now", "resume_from_failed"] as const)("rejects %s for an ambiguous send", async (action) => {
    await expect(recoverFailedEnrollment("creator-1", enrollment.id, action)).rejects.toThrow("RECOVERY_SEND_STATUS_UNCERTAIN");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.reservationFindUnique).not.toHaveBeenCalled();
  });

  it("requires explicit Fanvue verification before continuing without resending", async () => {
    await expect(recoverFailedEnrollment("creator-1", enrollment.id, "continue_after_verified_send")).rejects.toThrow("FANVUE_SEND_VERIFICATION_REQUIRED");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("advances past the confirmed message without changing the failed execution into a retry", async () => {
    const result = await recoverFailedEnrollment("creator-1", enrollment.id, "continue_after_verified_send", true);
    expect(result).toMatchObject({ action: "continue_after_verified_send", nextStepId: finalStep.id });
    expect(mocks.enrollmentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: enrollment.id, status: "FAILED", currentStepId: step.id }),
      data: expect.objectContaining({ currentStepId: finalStep.id }),
    }));
    expect(mocks.executionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SKIPPED", reasonCode: "MANUAL_SEND_VERIFIED" }),
    }));
    expect(mocks.logCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: "WORKFLOW_SEND_VERIFIED_MANUALLY" }),
    }));
  });
});
