import { z } from "zod";

const schema = z.object({
  fanUuid: z.string().uuid(),
  sendIntentId: z.string().uuid().optional(),
  text: z.string().trim().max(5000),
  templateId: z.string().optional(),
  price: z.string(),
  previewUuid: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export function parseManualSendForm(form: FormData) {
  return schema.safeParse({
    fanUuid: form.get("fanUuid"),
    sendIntentId: form.get("sendIntentId") || undefined,
    text: form.get("text") || "",
    templateId: form.get("templateId") || undefined,
    price: String(form.get("price") || ""),
    previewUuid: form.get("previewUuid") || undefined,
    scheduledAt: form.get("scheduledAt") || undefined,
  });
}
