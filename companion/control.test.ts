import { describe, expect, it } from "vitest";
import { controlPath, parseControlRequests, takeUnseen } from "./control.ts";

// c0119/c0141: the app cannot talk to the companion process directly — they
// coordinate only through `.gello/` files. The state file is the
// companion→app channel; this control file is the app→companion one, carrying
// commands (stop a run, restart a stopped card). The companion is the sole
// reader, the app the sole writer; both a stop (c0119) and a restart (c0141)
// share this one channel.

describe("controlPath", () => {
  it("is control.json under the companion dir", () => {
    expect(controlPath("/proj/.gello")).toBe("/proj/.gello/.companion/control.json");
  });
});

describe("parseControlRequests", () => {
  it("reads each request's kind and card", () => {
    const raw = JSON.stringify({
      requests: [
        { id: "a1", kind: "stop", cardId: "c001" },
        { id: "a2", kind: "restart", cardId: "c002" },
      ],
    });
    expect(parseControlRequests(raw)).toEqual([
      { id: "a1", kind: "stop", cardId: "c001" },
      { id: "a2", kind: "restart", cardId: "c002" },
    ]);
  });

  it("defaults a missing/unknown kind to stop (c0119 wrote no kind)", () => {
    const raw = JSON.stringify({
      requests: [
        { id: "a1", cardId: "c001" }, // c0119 shape — no kind
        { id: "a2", kind: "bogus", cardId: "c002" },
      ],
    });
    expect(parseControlRequests(raw)).toEqual([
      { id: "a1", kind: "stop", cardId: "c001" },
      { id: "a2", kind: "stop", cardId: "c002" },
    ]);
  });

  it("returns nothing for missing, empty or malformed content", () => {
    expect(parseControlRequests("")).toEqual([]);
    expect(parseControlRequests("not json")).toEqual([]);
    expect(parseControlRequests("null")).toEqual([]);
    expect(parseControlRequests("[]")).toEqual([]);
    expect(parseControlRequests(JSON.stringify({}))).toEqual([]);
  });

  it("drops entries without a string id and card, keeping the good ones", () => {
    const raw = JSON.stringify({
      requests: [
        { id: "a1", kind: "stop", cardId: "c001" },
        { id: 5, cardId: "c002" }, // bad id
        { cardId: "c003" }, // no id
        { id: "a4" }, // no card
        "nope", // not an object
        { id: "a5", kind: "restart", cardId: "c005" },
      ],
    });
    expect(parseControlRequests(raw)).toEqual([
      { id: "a1", kind: "stop", cardId: "c001" },
      { id: "a5", kind: "restart", cardId: "c005" },
    ]);
  });
});

describe("takeUnseen", () => {
  it("returns only requests whose id has not been seen, and records them", () => {
    const seen = new Set<string>();
    const first = takeUnseen([{ id: "a1", kind: "stop" as const, cardId: "c001" }], seen);
    expect(first).toEqual([{ id: "a1", kind: "stop", cardId: "c001" }]);
    // the same request again is not returned twice
    expect(takeUnseen([{ id: "a1", kind: "stop" as const, cardId: "c001" }], seen)).toEqual([]);
    // a new one is
    expect(
      takeUnseen(
        [
          { id: "a1", kind: "stop" as const, cardId: "c001" },
          { id: "a2", kind: "restart" as const, cardId: "c002" },
        ],
        seen,
      ),
    ).toEqual([{ id: "a2", kind: "restart", cardId: "c002" }]);
  });

  it("baselines a set: seeding without acting means later reads find nothing new", () => {
    const seen = new Set<string>();
    takeUnseen([{ id: "old", kind: "stop" as const, cardId: "c001" }], seen);
    expect(takeUnseen([{ id: "old", kind: "stop" as const, cardId: "c001" }], seen)).toEqual([]);
  });
});
