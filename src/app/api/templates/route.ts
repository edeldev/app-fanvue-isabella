import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const mediaSchema = z.array(z.object({ uuid: z.string().uuid(), name: z.string(), mediaType: z.enum(["image", "video"]) })).max(10);
const baseSchema = z.object({ name: z.string().trim().min(1).max(80), text: z.string().trim().max(5000), category: z.enum(["WELCOME", "FOLLOW_UP", "RENEWAL", "SALES", "VIP", "REACTIVATION", "GENERAL"]) });
function parseJson(value: FormDataEntryValue | null) { try { return JSON.parse(String(value || "[]")) as unknown; } catch { return null; } }

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) redirect("/?fanvue=connection_required");
  const form = await request.formData();
  const action = form.get("action");
  const id = z.string().min(1).safeParse(form.get("id"));
  try {
    if (action === "delete" && id.success) {
      await prisma.messageTemplate.delete({ where: { id: id.data, creatorId } });
      redirect("/templates?deleted=1");
    }
    const data = baseSchema.safeParse({ name: form.get("name"), text: form.get("text"), category: form.get("category") });
    if (!data.success) redirect("/templates?error=invalid");
    const media = mediaSchema.safeParse(parseJson(form.get("mediaJson")));
    if (!media.success || (!data.data.text && media.data.length === 0)) redirect("/templates?error=invalid");
    const priceValue = String(form.get("price") || "").trim();
    const priceMinor = priceValue ? Math.round(Number(priceValue) * 100) : null;
    if (priceMinor !== null && (!Number.isInteger(priceMinor) || priceMinor < 300 || media.data.length === 0)) redirect("/templates?error=invalid");
    const previewValue = String(form.get("previewUuid") || "");
    const previewUuid = previewValue && media.data.some(item => item.uuid === previewValue) ? previewValue : null;
    const metadata = { media: media.data, priceMinor, previewUuid };
    if (action === "create") {
      await prisma.messageTemplate.create({ data: { creatorId, ...data.data, type: media.data.length ? "MEDIA" : "TEXT", status: "ACTIVE", metadata } });
      redirect("/templates?saved=1");
    }
    if (action === "update" && id.success) {
      const updated = await prisma.messageTemplate.updateMany({ where: { id: id.data, creatorId }, data: { ...data.data, type: media.data.length ? "MEDIA" : "TEXT", metadata } });
      if (updated.count !== 1) redirect("/templates?error=not_found");
      redirect("/templates?saved=1");
    }
    redirect("/templates?error=invalid");
  } catch (caught) {
    if (caught instanceof Error && "digest" in caught) throw caught;
    const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
    redirect(`/templates?error=${code === "P2002" ? "duplicate" : code === "P2003" ? "in_use" : "unknown"}`);
  }
}
