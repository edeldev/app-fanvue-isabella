import { describe, expect, it } from "vitest";
import { matchesTemplateKind } from "./filters";

const template = (mediaType?: "image" | "video", text = "Hola", priceMinor: number | null = null) => ({ text, priceMinor, media: mediaType ? [{ mediaType }] : [] });

describe("filtros de plantillas", () => {
  it("incluye fotos con texto y PPV dentro de multimedia", () => {
    expect(matchesTemplateKind(template("image", "Mensaje", 500), "MEDIA")).toBe(true);
  });

  it("distingue fotos, videos, solo archivos y solo texto", () => {
    expect(matchesTemplateKind(template("image"), "IMAGE")).toBe(true);
    expect(matchesTemplateKind(template("video"), "VIDEO")).toBe(true);
    expect(matchesTemplateKind(template("image", ""), "MEDIA_ONLY")).toBe(true);
    expect(matchesTemplateKind(template(), "TEXT")).toBe(true);
  });
});
