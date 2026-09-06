import { describe, expect, it } from "vitest";
import { renderTemplateVariables } from "./template-variables";

describe("renderTemplateVariables", () => {
  it("renders the fan name and normalized username", () => {
    expect(renderTemplateVariables("Hola {{nombre}} {{usuario}}", { displayName: "Ana", username: "@ana12" }))
      .toBe("Hola Ana @ana12");
  });

  it("falls back safely when no display name is available", () => {
    expect(renderTemplateVariables("Hola {{nombre}}", { displayName: null, username: "ana12" }))
      .toBe("Hola ana12");
  });
});
