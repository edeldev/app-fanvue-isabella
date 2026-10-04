import { describe, expect, it } from "vitest";
import { zipContentLength } from "@/lib/zip-stream";

describe("zipContentLength", () => {
  it("calculates the exact length of a stored ZIP archive", () => {
    const name = "Photos/001-photo.jpg";
    const size = 1_024;
    const expected = 30 + name.length + size + 16 + 46 + name.length + 22;

    expect(zipContentLength([{ name, url: "https://example.com/photo.jpg", size }])).toBe(expected);
  });

  it("returns null when a remote file size is unknown", () => {
    expect(zipContentLength([{ name: "Videos/video.mp4", url: "https://example.com/video.mp4", size: null }])).toBeNull();
  });
});
