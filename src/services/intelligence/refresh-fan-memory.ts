import { deriveFanMemory } from "@/domain/ai/fan-memory";
import { prisma } from "@/lib/prisma";

export async function refreshFanMemory(creatorId: string, fanId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { creatorId, fanId },
    select: {
      messages: {
        where: { direction: "INBOUND", deletedAt: null, text: { not: null } },
        orderBy: { sentAt: "desc" },
        take: 100,
        select: { id: true, text: true, sentAt: true },
      },
    },
  });
  const candidates = deriveFanMemory(conversations.flatMap((conversation) => conversation.messages));
  if (!candidates.length) return { detected: 0 };
  const existing = await prisma.fanMemory.findMany({
    where: { fanId, OR: candidates.map((candidate) => ({ category: candidate.category, key: candidate.key })) },
    select: { category: true, key: true, confirmedAt: true },
  });
  const confirmed = new Set(existing.filter((item) => item.confirmedAt).map((item) => `${item.category}:${item.key}`));
  await prisma.$transaction(candidates.map((candidate) => prisma.fanMemory.upsert({
    where: { fanId_category_key: { fanId, category: candidate.category, key: candidate.key } },
    update: {
      value: candidate.value,
      type: confirmed.has(`${candidate.category}:${candidate.key}`) ? "FACT" : candidate.type,
      confidence: candidate.confidence,
      source: "CONVERSATION_RULE",
      evidence: candidate.evidence,
      sourceMessageId: candidate.sourceMessageId,
      observedAt: candidate.observedAt,
    },
    create: { creatorId, fanId, ...candidate, source: "CONVERSATION_RULE" },
  })));
  return { detected: candidates.length };
}

