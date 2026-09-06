ALTER TABLE "WorkflowEnrollment"
ADD COLUMN "pausedFromStatus" "EnrollmentStatus",
ADD COLUMN "pausedRemainingSeconds" INTEGER;
