import { describe, expect, it } from "vitest";
import { isStoppedCard } from "./restart";
import type { CompanionState } from "./companion";

// c0141: a stopped card is one whose run died abnormally — in-progress, the
// companion is live and owns its session, and it has no live run. Only such a
// card gets a restart affordance; never a human-worked in-progress card.

const NOW = Date.parse("2026-07-28T12:00:05");

function state(over: Partial<CompanionState> = {}): CompanionState {
  return {
    status: "running",
    ready: [],
    waiting: [],
    runs: [],
    updated: "2026-07-28T12:00:00", // fresh → live
    pickupDelay: 0,
    owned: ["c001"],
    ...over,
  };
}

describe("isStoppedCard", () => {
  it("is true for an in-progress, owned card with no live run", () => {
    expect(isStoppedCard(state(), "c001", "in-progress", NOW)).toBe(true);
  });

  it("is false with no companion", () => {
    expect(isStoppedCard(null, "c001", "in-progress", NOW)).toBe(false);
  });

  it("is false when the companion has gone stale (no longer live)", () => {
    expect(isStoppedCard(state({ updated: "2000-01-01T00:00:00" }), "c001", "in-progress", NOW)).toBe(
      false,
    );
  });

  it("is false for a card the companion owns no session for (human-worked)", () => {
    expect(isStoppedCard(state({ owned: [] }), "c001", "in-progress", NOW)).toBe(false);
  });

  it("is false when the card is not in-progress", () => {
    for (const status of ["ready", "review", "done", "backlog", "inbox"]) {
      expect(isStoppedCard(state(), "c001", status, NOW)).toBe(false);
    }
  });

  it("is false while a run is live for the card (running)", () => {
    const running = state({ runs: [{ cardId: "c001", phase: "running" }] });
    expect(isStoppedCard(running, "c001", "in-progress", NOW)).toBe(false);
  });

  it("is false while the card is parked (a live waiting-for-input run)", () => {
    const parked = state({ runs: [{ cardId: "c001", phase: "waiting-for-input" }] });
    expect(isStoppedCard(parked, "c001", "in-progress", NOW)).toBe(false);
  });
});
