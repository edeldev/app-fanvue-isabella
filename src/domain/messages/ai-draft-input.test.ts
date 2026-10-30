import { describe, expect, it } from "vitest";
import { buildAiDraftInput } from "./ai-draft-input";

const context = [
  { id: "fan-1", role: "fan" as const, text: "Quiero ver más fotos", sentAt: new Date("2026-10-28T12:00:00Z") },
  { id: "creator-1", role: "creator" as const, text: "Me gusta hablar contigo 💜", sentAt: new Date("2026-10-28T12:01:00Z") },
  { id: "fan-2", role: "fan" as const, text: "¿Qué haces ahora?", sentAt: new Date("2026-10-28T12:02:00Z") },
];

describe("buildAiDraftInput", () => {
  it("makes the creator's draft the only text to rewrite", () => {
    const input = buildAiDraftInput({ mode: "improve", fanName: "Fan", currentDraft: "Mañana te cuento algo bonito", currentFanTurn: [context[2]], context });
    expect(input).toEqual({ task: "rewrite_creator_draft", draftToImprove: "Mañana te cuento algo bonito", creatorStyleExamples: ["Me gusta hablar contigo 💜"] });
    expect(JSON.stringify(input)).not.toContain("¿Qué haces ahora?");
  });

  it("keeps the current fan turn for generating a new reply", () => {
    const input = buildAiDraftInput({ mode: "reply", fanName: "Fan", previousSuggestions: ["Jajaja pillín, dime más", "Jajaja pillín, dime más"], responseVariation: 2, currentFanTurn: [context[2]], context });
    expect(input.task).toBe("reply_to_fan");
    expect(JSON.stringify(input)).toContain("¿Qué haces ahora?");
    expect(input.avoidRecentOpenings).toEqual(["Me gusta hablar contigo 💜"]);
    expect(input.avoidPreviousSuggestions).toEqual(["Jajaja pillín, dime más"]);
    expect(input.responseVariation).toBe(2);
  });

  it("deduplicates recent creator openings", () => {
    const repeated = [
      ...context,
      { id: "creator-2", role: "creator" as const, text: "Jajaja pillín, cuéntame más", sentAt: new Date("2026-10-28T12:03:00Z") },
      { id: "creator-3", role: "creator" as const, text: "Jajaja pillín, cuéntame más", sentAt: new Date("2026-10-28T12:04:00Z") },
    ];
    const input = buildAiDraftInput({ mode: "reply", fanName: "Fan", currentFanTurn: [context[2]], context: repeated });
    if (input.task !== "reply_to_fan") throw new Error("Expected reply input");
    expect(input.avoidRecentOpenings.filter((opening) => opening === "Jajaja pillín, cuéntame más")).toHaveLength(1);
  });
});
