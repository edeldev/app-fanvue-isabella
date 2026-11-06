import { describe, expect, it } from "vitest";
import { parseManualSendForm } from "./manual-send-form";

const fanUuid = "11111111-1111-4111-8111-111111111111";

describe("parseManualSendForm", () => {
  it("accepts a plain message when the browser did not provide an intent ID", () => {
    const form = new FormData();
    form.set("fanUuid", fanUuid);
    form.set("text", "Hola");
    form.set("sendIntentId", "");
    const parsed = parseManualSendForm(form);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.sendIntentId).toBeUndefined();
  });

  it("preserves a valid intent ID for duplicate-send protection", () => {
    const form = new FormData();
    form.set("fanUuid", fanUuid);
    form.set("sendIntentId", "22222222-2222-4222-8222-222222222222");
    const parsed = parseManualSendForm(form);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.sendIntentId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("keeps local reply context separate from the text sent to Fanvue", () => {
    const form = new FormData();
    form.set("fanUuid", fanUuid);
    form.set("text", "Sí");
    form.set("replySender", "Upset Tortoise");
    form.set("replyExcerpt", "Hola amor");
    const parsed = parseManualSendForm(form);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.text).toBe("Sí");
      expect(parsed.data.replySender).toBe("Upset Tortoise");
      expect(parsed.data.replyExcerpt).toBe("Hola amor");
    }
  });
});
