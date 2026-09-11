import { describe, expect, it } from "vitest";
import { matchesTemplateKind } from "./filters";

const template = (mediaType?: "image" | "video", text = "Hola", priceMinor: number | null = null) => ({ text, priceMinor, media: mediaType ? [{ mediaType }] : [] });

describe("filtros de plantillas", () => {
  it("mantiene PPV separado de los filtros multimedia", () => {
    const ppv = template("image", "Mensaje", 500);
    expect(matchesTemplateKind(ppv, "PPV")).toBe(true);
    expect(matchesTemplateKind(ppv, "MEDIA")).toBe(false);
    expect(matchesTemplateKind(ppv, "IMAGE")).toBe(false);
    expect(matchesTemplateKind(ppv, "MEDIA_ONLY")).toBe(false);
  });

  it("distingue fotos, videos, solo archivos y solo texto", () => {
    expect(matchesTemplateKind(template("image"), "IMAGE")).toBe(true);
    expect(matchesTemplateKind(template("video"), "VIDEO")).toBe(true);
    expect(matchesTemplateKind(template("image", ""), "MEDIA_ONLY")).toBe(true);
    expect(matchesTemplateKind(template(), "TEXT")).toBe(true);
  });
});
