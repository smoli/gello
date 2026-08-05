import { describe, expect, it } from "vitest";
import { openSwitcher, cycleSwitcher } from "./switcher";

// c0146: the MRU project switcher's selection logic — pure, no key handling.
// The `items` are the `recent` list (already most-recent-first): current on
// top, previous next, and so on.

describe("openSwitcher (c0146)", () => {
  it("preselects the second entry — the previous project — so one hit toggles back", () => {
    expect(openSwitcher(["cur", "prev", "older"])).toEqual({
      items: ["cur", "prev", "older"],
      selected: 1,
    });
  });

  it("is a no-op with fewer than two projects — nothing to switch to", () => {
    expect(openSwitcher([])).toBeNull();
    expect(openSwitcher(["only"])).toBeNull();
  });

  it("keeps the MRU order untouched — the overlay is just a view over recent", () => {
    const items = ["a", "b", "c", "d"];
    expect(openSwitcher(items)!.items).toEqual(items);
  });
});

describe("cycleSwitcher (c0146)", () => {
  const state = { items: ["a", "b", "c"], selected: 1 };

  it("moves the selection down by one", () => {
    expect(cycleSwitcher(state, 1).selected).toBe(2);
  });

  it("moves the selection up by one", () => {
    expect(cycleSwitcher(state, -1).selected).toBe(0);
  });

  it("wraps past the bottom back to the top", () => {
    expect(cycleSwitcher({ items: ["a", "b", "c"], selected: 2 }, 1).selected).toBe(0);
  });

  it("wraps past the top back to the bottom", () => {
    expect(cycleSwitcher({ items: ["a", "b", "c"], selected: 0 }, -1).selected).toBe(2);
  });

  it("never reorders the frozen list while cycling", () => {
    expect(cycleSwitcher(state, 1).items).toEqual(state.items);
  });
});
