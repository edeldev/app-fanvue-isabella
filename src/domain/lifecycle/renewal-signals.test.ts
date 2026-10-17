import { describe, expect, it } from "vitest";
import { reconcileRenewalSignals, renewalLabel } from "./renewal-signals";

describe("reconcileRenewalSignals", () => {
  it("does not assert either state when the API and list disagree", () => {
    expect(reconcileRenewalSignals(true, false, true)).toEqual({
      isAutoRenewingSubscriber: false,
      isNonRenewingSubscriber: false,
      renewalSignalsConflict: true,
    });
  });

  it("accepts matching Fanvue signals", () => {
    expect(reconcileRenewalSignals(true, true, false).isAutoRenewingSubscriber).toBe(true);
    expect(reconcileRenewalSignals(false, false, true).isNonRenewingSubscriber).toBe(true);
  });

  it("leaves an unclassified fan unconfirmed", () => {
    expect(reconcileRenewalSignals(true, false, false).isAutoRenewingSubscriber).toBe(false);
    expect(reconcileRenewalSignals(true, false, false).renewalSignalsConflict).toBe(false);
  });

  it("labels a disagreement without claiming renewal is off", () => {
    expect(renewalLabel(reconcileRenewalSignals(true, false, true))).toBe(
      "Por confirmar · datos contradictorios en Fanvue",
    );
  });
});
