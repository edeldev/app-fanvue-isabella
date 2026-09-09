ALTER TABLE "Workflow"
RENAME COLUMN "stopOnFanReply" TO "pauseOnFanReply";

ALTER TABLE "Workflow"
ADD COLUMN "replySilenceMinutes" INTEGER NOT NULL DEFAULT 60;
