import type { EnrollmentStatus } from "./states";

const allowedTransitions: Readonly<Record<EnrollmentStatus, readonly EnrollmentStatus[]>> = {
  ACTIVE: ["WAITING", "PAUSED", "COMPLETED", "CANCELLED", "FAILED"],
  WAITING: ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "FAILED"],
  PAUSED: ["ACTIVE", "WAITING", "CANCELLED", "FAILED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

export function canTransitionEnrollment(
  from: EnrollmentStatus,
  to: EnrollmentStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertEnrollmentTransition(
  from: EnrollmentStatus,
  to: EnrollmentStatus,
): void {
  if (!canTransitionEnrollment(from, to)) {
    throw new Error(`Invalid enrollment transition: ${from} -> ${to}`);
  }
}

