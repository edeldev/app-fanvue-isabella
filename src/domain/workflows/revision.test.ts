import { describe, expect, it } from "vitest";
import { editableWorkflowConfig, replaceWorkflowTarget } from "./revision";

describe("workflow revisions", () => {
  it("removes every frozen publication snapshot from a new draft", () => {
    expect(editableWorkflowConfig({ manualText: "Hola", publishedMediaUuids: ["old"], publishedContentRating: "SFW", publishedMediaOrigin: "original" }))
      .toEqual({ manualText: "Hola" });
  });

  it("moves workflow transitions to the newly published version", () => {
    expect(replaceWorkflowTarget({ targetWorkflowId: "old", yesTargetKey: "next" }, "old", "new"))
      .toEqual({ targetWorkflowId: "new", yesTargetKey: "next" });
    expect(replaceWorkflowTarget({ targetWorkflowId: "other" }, "old", "new")).toBeNull();
  });
});
