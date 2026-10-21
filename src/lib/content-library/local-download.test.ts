import { describe, expect, it } from "vitest";
import { localMediaDownloadAllowed } from "./local-download";

describe("localMediaDownloadAllowed", () => {
  it("allows downloads from a local development server", () => {
    expect(localMediaDownloadAllowed("localhost", "development", undefined)).toBe(true);
    expect(localMediaDownloadAllowed("127.0.0.1", "development", undefined)).toBe(true);
    expect(localMediaDownloadAllowed("::1", "development", undefined)).toBe(true);
  });

  it("blocks production, Vercel and non-loopback hosts", () => {
    expect(localMediaDownloadAllowed("localhost", "production", undefined)).toBe(false);
    expect(localMediaDownloadAllowed("localhost", "development", "1")).toBe(false);
    expect(localMediaDownloadAllowed("app.example.com", "development", undefined)).toBe(false);
  });
});
