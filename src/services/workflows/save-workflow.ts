import type { Prisma, WorkflowStepType } from "@/generated/prisma/client";
import { workflowDefinitionInputSchema } from "@/domain/workflows/definition";
import { prisma } from "@/lib/prisma";

function stepData(input: ReturnType<typeof workflowDefinitionInputSchema.parse>["steps"][number], position: number) {
  return {
    position,
    name: input.name,
    type: input.type as WorkflowStepType,
    config: input.config as Prisma.InputJsonValue,
    messageTemplateId: input.messageTemplateId ?? null,
  };
}

async function assertReferencesBelongToCreator(
  creatorId: string,
  input: ReturnType<typeof workflowDefinitionInputSchema.parse>,
) {
  const templateIds = [...new Set(input.steps.flatMap((step) => step.messageTemplateId ? [step.messageTemplateId] : []))];
  const targetIds = [...new Set(input.steps.flatMap((step) => typeof step.config.targetWorkflowId === "string" ? [step.config.targetWorkflowId] : []))];
  const [templates, targets] = await Promise.all([
    prisma.messageTemplate.count({ where: { creatorId, id: { in: templateIds } } }),
    prisma.workflow.count({ where: { creatorId, id: { in: targetIds }, status: "PUBLISHED" } }),
  ]);
  if (templates !== templateIds.length) throw new Error("WORKFLOW_TEMPLATE_NOT_FOUND");
  if (targets !== targetIds.length) throw new Error("WORKFLOW_TARGET_NOT_FOUND");
}

export async function createWorkflow(creatorId: string, payload: unknown) {
  const input = workflowDefinitionInputSchema.parse(payload);
  await assertReferencesBelongToCreator(creatorId, input);
  const baseKey = input.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workflow";
  const existing = await prisma.workflow.count({ where: { creatorId, stableKey: { startsWith: baseKey } } });
  const stableKey = existing ? `${baseKey}-${existing + 1}` : baseKey;
  return prisma.workflow.create({
    data: {
      creatorId,
      stableKey,
      name: input.name,
      version: 1,
      priority: input.priority,
      isPrimary: input.isPrimary,
      steps: { create: input.steps.map(stepData) },
    },
    include: { steps: { orderBy: { position: "asc" } } },
  });
}

export async function updateWorkflow(creatorId: string, workflowId: string, payload: unknown) {
  const input = workflowDefinitionInputSchema.parse(payload);
  await assertReferencesBelongToCreator(creatorId, input);
  const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, creatorId } });
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
  if (workflow.status !== "DRAFT") throw new Error("WORKFLOW_IMMUTABLE");
  return prisma.$transaction(async (transaction) => {
    await transaction.workflowStep.deleteMany({ where: { workflowId } });
    return transaction.workflow.update({
      where: { id: workflowId },
      data: {
        name: input.name,
        priority: input.priority,
        isPrimary: input.isPrimary,
        steps: { create: input.steps.map(stepData) },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });
  });
}
