import { describe, expect, it } from "vitest";
import { pickupCountdown, waitingForSlot } from "./pickup";
import type { CompanionState } from "./companion";

// c0117: the grace period is only useful if you can see it. The countdown is
// derived client-side from the published delay plus the card's `status-changed`,
// so it needs no extra polling.

const NOW = Date.parse("2026-07-22T10:00:05"); // 5s after the stamp below
const STAMP = "2026-07-22T10:00:00";

function state(over: Partial<CompanionState> = {}): CompanionState {
  return {
    status: "idle",
    ready: ["c001"],
    waiting: [],
    runs: [],
    updated: "2026-07-22T10:00:05", // fresh, so the companion counts as live
    pickupDelay: 10,
    ...over,
  };
}

describe("pickupCountdown", () => {
  it("counts down the seconds left before pickup", () => {
    expect(pickupCountdown(state(), "c001", STAMP, NOW)).toBe(5);
  });

  it("rounds a part-second up, so it never shows 0 while still waiting", () => {
    const almost = Date.parse("2026-07-22T10:00:09") + 500; // 0.5s left
    expect(pickupCountdown(state(), "c001", STAMP, almost)).toBe(1);
  });

  // criterion: with no companion attached, nothing is shown
  it("shows nothing when no companion is attached", () => {
    expect(pickupCountdown(null, "c001", STAMP, NOW)).toBeNull();
  });

  it("shows nothing when the companion has gone stale", () => {
    const stale = state({ updated: "2000-01-01T00:00:00" });
    expect(pickupCountdown(stale, "c001", STAMP, NOW)).toBeNull();
  });

  it("shows nothing when the companion dispatches immediately", () => {
    expect(pickupCountdown(state({ pickupDelay: 0 }), "c001", STAMP, NOW)).toBeNull();
  });

  it("shows nothing for a card that is not queued for pickup", () => {
    expect(pickupCountdown(state({ ready: ["c002"] }), "c001", STAMP, NOW)).toBeNull();
  });

  it("shows nothing once the card is actually running", () => {
    // the run has started, so the activity line takes over
    const running = state({ runs: [{ cardId: "c001", phase: "running" }] });
    expect(pickupCountdown(running, "c001", STAMP, NOW)).toBeNull();
  });

  it("shows nothing once the window has elapsed", () => {
    const late = Date.parse("2026-07-22T10:00:11");
    expect(pickupCountdown(state({ updated: "2026-07-22T10:00:11" }), "c001", STAMP, late)).toBeNull();
  });

  // the companion treats these as eligible immediately, so there is nothing to
  // count down — the card front must agree rather than invent a window
  it("shows nothing when the card has no usable status-changed", () => {
    expect(pickupCountdown(state(), "c001", null, NOW)).toBeNull();
    expect(pickupCountdown(state(), "c001", "not a date", NOW)).toBeNull();
  });

  // c0125: the companion gates on `depends` *before* the grace period, so a
  // blocked card is never picked up — counting down to a pickup that cannot
  // happen is a lie, and it hid the "waiting on …" line that says why.
  it("shows nothing while the card is blocked by a dependency", () => {
    expect(pickupCountdown(state(), "c001", STAMP, NOW, true)).toBeNull();
  });

  it("shows the countdown again once the block is gone", () => {
    expect(pickupCountdown(state(), "c001", STAMP, NOW, false)).toBe(5);
  });

  it("is unblocked by default, so existing callers are unchanged", () => {
    expect(pickupCountdown(state(), "c001", STAMP, NOW)).toBe(5);
  });

  // c0137: with every WIP slot taken the companion cannot dispatch, so a
  // countdown promises a pickup that will not come — hide it, and let the
  // "waiting on a slot" line speak instead.
  it("shows nothing when no WIP slot is free", () => {
    expect(pickupCountdown(state(), "c001", STAMP, NOW, false, false)).toBeNull();
  });

  it("counts down again once a slot is free", () => {
    expect(pickupCountdown(state(), "c001", STAMP, NOW, false, true)).toBe(5);
  });

  it("treats a slot as free by default, so existing callers are unchanged", () => {
    expect(pickupCountdown(state(), "c001", STAMP, NOW, false)).toBe(5);
  });
});

describe("waitingForSlot (c0137)", () => {
  it("is true for a queued ready card when no slot is free", () => {
    expect(waitingForSlot(state(), "c001", NOW, false, false)).toBe(true);
  });

  it("is false when a slot is free — the countdown speaks instead", () => {
    expect(waitingForSlot(state(), "c001", NOW, false, true)).toBe(false);
  });

  it("holds even when the grace period is off — the slot is the constraint", () => {
    expect(waitingForSlot(state({ pickupDelay: 0 }), "c001", NOW, false, false)).toBe(true);
  });

  it("is false with no companion, or a stale one", () => {
    expect(waitingForSlot(null, "c001", NOW, false, false)).toBe(false);
    const stale = state({ updated: "2000-01-01T00:00:00" });
    expect(waitingForSlot(stale, "c001", NOW, false, false)).toBe(false);
  });

  it("is false for a card that is not queued in ready", () => {
    expect(waitingForSlot(state({ ready: ["c002"] }), "c001", NOW, false, false)).toBe(false);
  });

  it("is false once the card is running — it already holds a slot", () => {
    const running = state({ runs: [{ cardId: "c001", phase: "running" }] });
    expect(waitingForSlot(running, "c001", NOW, false, false)).toBe(false);
  });

  it("is false when the card is blocked — that reason takes precedence", () => {
    expect(waitingForSlot(state(), "c001", NOW, true, false)).toBe(false);
  });
});
