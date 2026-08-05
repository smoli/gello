import { describe, expect, it } from "vitest";
import { controlPath, parseStopRequests, takeUnseen } from "./control.ts";

// c0119: the app cannot talk to the companion process directly — they
// coordinate only through `.gello/` files. The state file is the
// companion→app channel; this control file is the app→companion one, carrying
// stop requests. The companion is the sole reader, the app the sole writer.

describe("controlPath", () => {
  it("is control.json under the companion dir", () => {
    expect(controlPath("/proj/.gello")).toBe("/proj/.gello/.companion/control.json");
  });
});

describe("parseStopRequests", () => {
  it("reads the stop requests, each an id + card", () => {
    const raw = JSON.stringify({
      requests: [
        { id: "a1", cardId: "c001" },
        { id: "a2", cardId: "c002" },
      ],
    });
    expect(parseStopRequests(raw)).toEqual([
      { id: "a1", cardId: "c001" },
      { id: "a2", cardId: "c002" },
    ]);
  });

  it("returns nothing for missing, empty or malformed content", () => {
    expect(parseStopRequests("")).toEqual([]);
    expect(parseStopRequests("not json")).toEqual([]);
    expect(parseStopRequests("null")).toEqual([]);
    expect(parseStopRequests("[]")).toEqual([]);
    expect(parseStopRequests(JSON.stringify({}))).toEqual([]);
  });

  it("drops entries without a string id and card, keeping the good ones", () => {
    const raw = JSON.stringify({
      requests: [
        { id: "a1", cardId: "c001" },
        { id: 5, cardId: "c002" }, // bad id
        { cardId: "c003" }, // no id
        { id: "a4" }, // no card
        "nope", // not an object
        { id: "a5", cardId: "c005" },
      ],
    });
    expect(parseStopRequests(raw)).toEqual([
      { id: "a1", cardId: "c001" },
      { id: "a5", cardId: "c005" },
    ]);
  });
});

describe("takeUnseen", () => {
  it("returns only requests whose id has not been seen, and records them", () => {
    const seen = new Set<string>();
    const first = takeUnseen([{ id: "a1", cardId: "c001" }], seen);
    expect(first).toEqual([{ id: "a1", cardId: "c001" }]);
    // the same request again is not returned twice
    expect(takeUnseen([{ id: "a1", cardId: "c001" }], seen)).toEqual([]);
    // a new one is
    expect(takeUnseen([{ id: "a1", cardId: "c001" }, { id: "a2", cardId: "c002" }], seen)).toEqual([
      { id: "a2", cardId: "c002" },
    ]);
  });

  it("baselines a set: seeding without acting means later reads find nothing new", () => {
    const seen = new Set<string>();
    // startup: mark everything present as seen without acting on it
    takeUnseen([{ id: "old", cardId: "c001" }], seen);
    // a re-read of the same file acts on nothing — no stale kill
    expect(takeUnseen([{ id: "old", cardId: "c001" }], seen)).toEqual([]);
  });
});
