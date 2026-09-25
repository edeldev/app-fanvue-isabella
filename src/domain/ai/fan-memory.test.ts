import { describe, expect, it } from "vitest";
import { deriveFanMemory } from "./fan-memory";

const now = new Date("2026-09-25T12:00:00.000Z");

describe("deriveFanMemory", () => {
  it("guarda un interés concreto con evidencia", () => {
    const result = deriveFanMemory([{ id: "m1", text: "Me encantan tus fotos en bikini", sentAt: now }], now);
    expect(result[0]).toMatchObject({ category: "INTEREST", key: "BIKINI", sourceMessageId: "m1" });
  });

  it("registra un límite explícito como hecho", () => {
    const result = deriveFanMemory([{ id: "m2", text: "Ahora no, quizá después", sentAt: now }], now);
    expect(result[0]).toMatchObject({ category: "BOUNDARY", key: "NOT_NOW", type: "FACT", confidence: 1 });
  });

  it("no convierte palabras genéricas en memoria", () => {
    expect(deriveFanMemory([{ id: "m3", text: "Tengo años viviendo en Bogotá jajaja", sentAt: now }], now)).toEqual([]);
  });
});

