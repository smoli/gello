import { describe, expect, it } from "vitest";
import { edgeScrollDelta } from "./autoscroll";

describe("edgeScrollDelta (i0123)", () => {
  const rect = { top: 100, bottom: 500 }; // a 400px-tall scroll container
  const cfg = { zone: 50, maxSpeed: 20 };

  it("does not scroll from the calm middle", () => {
    expect(edgeScrollDelta(rect, 300, cfg)).toBe(0);
  });

  it("scrolls up at full speed at the very top edge", () => {
    expect(edgeScrollDelta(rect, 100, cfg)).toBe(-20);
  });

  it("scrolls down at full speed at the very bottom edge", () => {
    expect(edgeScrollDelta(rect, 500, cfg)).toBe(20);
  });

  it("ramps: half into the top band scrolls at half speed", () => {
    expect(edgeScrollDelta(rect, 125, cfg)).toBe(-10); // 25px in of a 50px band
  });

  it("ramps: half into the bottom band scrolls at half speed", () => {
    expect(edgeScrollDelta(rect, 475, cfg)).toBe(10);
  });

  it("is calm exactly at the band boundary", () => {
    expect(edgeScrollDelta(rect, 150, cfg)).toBe(0); // top + zone
    expect(edgeScrollDelta(rect, 450, cfg)).toBe(0); // bottom - zone
  });

  it("does not scroll when the pointer has left the container", () => {
    expect(edgeScrollDelta(rect, 80, cfg)).toBe(0); // above
    expect(edgeScrollDelta(rect, 520, cfg)).toBe(0); // below
  });

  it("lets the nearer edge win when a short container's bands overlap", () => {
    const shortRect = { top: 0, bottom: 60 }; // shorter than 2*zone
    // pointer at 20 is nearer the top → scroll up
    expect(edgeScrollDelta(shortRect, 20, cfg)).toBeLessThan(0);
    // pointer at 40 is nearer the bottom → scroll down
    expect(edgeScrollDelta(shortRect, 40, cfg)).toBeGreaterThan(0);
  });

  it("is inert when disabled by a zero zone or speed", () => {
    expect(edgeScrollDelta(rect, 100, { zone: 0, maxSpeed: 20 })).toBe(0);
    expect(edgeScrollDelta(rect, 100, { zone: 50, maxSpeed: 0 })).toBe(0);
  });
});
