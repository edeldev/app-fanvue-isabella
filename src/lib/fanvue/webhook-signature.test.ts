import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyFanvueWebhookSignature } from "./webhook-signature";

const secret = `whsec_${"a".repeat(64)}`;
const body = JSON.stringify({ type: "creator.follow.created" });
const timestamp = 1_800_000_000;

function signature(value = body) {
  return createHmac("sha256", secret).update(`${timestamp}.${value}`).digest("hex");
}

describe("verifyFanvueWebhookSignature", () => {
  it("acepta una firma auténtica dentro de la ventana permitida", () => {
    expect(verifyFanvueWebhookSignature(body, `t=${timestamp},v0=${signature()}`, secret, timestamp)).toBe(true);
  });

  it("rechaza cuerpos modificados y marcas de tiempo antiguas", () => {
    expect(verifyFanvueWebhookSignature(`${body} `, `t=${timestamp},v0=${signature()}`, secret, timestamp)).toBe(false);
    expect(verifyFanvueWebhookSignature(body, `t=${timestamp},v0=${signature()}`, secret, timestamp + 301)).toBe(false);
  });
});
