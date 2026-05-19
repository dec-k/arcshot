import { describe, it, expect } from "vitest";
import lib from "../lib.js";

const { hslToHex, rgbToHue, gradientStops, drawCover } = lib;

describe("hslToHex", () => {
  it("produces pure red at hue 0", () => {
    expect(hslToHex(0, 100, 50).toLowerCase()).toBe("#ff0000");
  });

  it("produces pure green at hue 120", () => {
    expect(hslToHex(120, 100, 50).toLowerCase()).toBe("#00ff00");
  });

  it("produces pure blue at hue 240", () => {
    expect(hslToHex(240, 100, 50).toLowerCase()).toBe("#0000ff");
  });

  it("returns a six-digit hex with leading hash", () => {
    expect(hslToHex(45, 80, 60)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("rgbToHue", () => {
  it("returns 0 for pure red", () => {
    expect(rgbToHue("#ff0000")).toBe(0);
  });

  it("returns 120 for pure green", () => {
    expect(rgbToHue("#00ff00")).toBe(120);
  });

  it("returns 240 for pure blue", () => {
    expect(rgbToHue("#0000ff")).toBe(240);
  });

  it("returns 0 for grey (no hue)", () => {
    expect(rgbToHue("#808080")).toBe(0);
  });

  it("returns 0 for invalid input", () => {
    expect(rgbToHue("not-a-color")).toBe(0);
  });

  it("is approximately invertible with hslToHex for saturated colors", () => {
    for (const h of [10, 90, 200, 310]) {
      const hex = hslToHex(h, 100, 50);
      expect(Math.round(rgbToHue(hex))).toBe(h);
    }
  });
});

describe("gradientStops", () => {
  it("returns distinct start and end hex stops", () => {
    const { start, end } = gradientStops("#ff8a7a");
    expect(start).toMatch(/^#[0-9a-f]{6}$/i);
    expect(end).toMatch(/^#[0-9a-f]{6}$/i);
    expect(start).not.toBe(end);
  });

  it("shifts when the base color changes", () => {
    const a = gradientStops("#ff0000");
    const b = gradientStops("#00ff00");
    expect(a.start).not.toBe(b.start);
    expect(a.end).not.toBe(b.end);
  });

  it("is deterministic for the same input", () => {
    expect(gradientStops("#abcdef")).toEqual(gradientStops("#abcdef"));
  });
});

describe("drawCover", () => {
  it("crops a wide image to fit a square destination, preserving height", () => {
    const calls = [];
    const ctx = {
      drawImage: (...args) => calls.push(args),
    };
    const image = { naturalWidth: 2000, naturalHeight: 1000 };
    drawCover(ctx, image, 0, 0, 500, 500);

    expect(calls).toHaveLength(1);
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = calls[0];
    expect(sh).toBe(1000);
    expect(sw).toBe(1000);
    expect(sx).toBe(500);
    expect(sy).toBe(0);
    expect([dx, dy, dw, dh]).toEqual([0, 0, 500, 500]);
  });

  it("crops a tall image to fit a square destination, preserving width", () => {
    const calls = [];
    const ctx = { drawImage: (...args) => calls.push(args) };
    const image = { naturalWidth: 1000, naturalHeight: 2000 };
    drawCover(ctx, image, 0, 0, 500, 500);

    const [, sx, sy, sw, sh] = calls[0];
    expect(sw).toBe(1000);
    expect(sh).toBe(1000);
    expect(sx).toBe(0);
    expect(sy).toBe(500);
  });
});
