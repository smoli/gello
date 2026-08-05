import { describe, expect, it, vi } from "vitest";
import {
  parseCompanionState,
  companionStatePath,
  readCompanionState,
  isCompanionLive,
  hasLiveRun,
  newlyParkedIds,
  STALE_MS,
  type CompanionState,
  type RunState,
} from "./companion";
import { readFileRaw } from "./board-io";

vi.mock("./board-io", () => ({ readFileRaw: vi.fn() }));

describe("parseCompanionState", () => {
  it("parses a full valid state", () => {
    const raw = JSON.stringify({
      status: "waiting",
      ready: ["c001"],
      waiting: ["c002"],
      runs: [{ cardId: "c003", phase: "running" }],
      updated: "2026-07-19T10:00:00",
      pickupDelay: 10,
      owned: [],
    });
    expect(parseCompanionState(raw)).toEqual({
      status: "waiting",
      ready: ["c001"],
      waiting: ["c002"],
      runs: [{ cardId: "c003", phase: "running" }],
      updated: "2026-07-19T10:00:00",
      pickupDelay: 10,
      owned: [],
    });
  });

  it("returns null for malformed JSON or a non-object", () => {
    expect(parseCompanionState("not json")).toBeNull();
    expect(parseCompanionState("")).toBeNull();
    expect(parseCompanionState("42")).toBeNull();
    expect(parseCompanionState("null")).toBeNull();
  });

  it("falls back to idle for an unknown status and empties missing arrays", () => {
    const s = parseCompanionState(JSON.stringify({ status: "bogus" }));
    expect(s).toEqual({
      status: "idle",
      ready: [],
      waiting: [],
      runs: [],
      updated: "",
      pickupDelay: 0,
      owned: [],
    });
  });

  // c0119: a deliberately stopped run reports `aborted`, distinct from `error`.
  it("keeps the aborted phase", () => {
    const raw = JSON.stringify({ runs: [{ cardId: "c001", phase: "aborted" }] });
    expect(parseCompanionState(raw)?.runs[0]).toEqual({ cardId: "c001", phase: "aborted" });
  });

  it("drops a run with an unknown phase (aborted is the only new one)", () => {
    const raw = JSON.stringify({ runs: [{ cardId: "c001", phase: "cancelled" }] });
    expect(parseCompanionState(raw)?.runs).toEqual([]);
  });

  it("drops malformed runs but keeps the valid ones", () => {
    const raw = JSON.stringify({
      status: "running",
      runs: [
        { cardId: "c001", phase: "running" },
        { cardId: "c002", phase: "nonsense" }, // bad phase → dropped
        { phase: "done" }, // no cardId → dropped
        { cardId: "c003", phase: "waiting-for-input" },
      ],
    });
    expect(parseCompanionState(raw)?.runs).toEqual([
      { cardId: "c001", phase: "running" },
      { cardId: "c003", phase: "waiting-for-input" },
    ]);
  });

  it("filters non-string entries out of ready/waiting", () => {
    const s = parseCompanionState(JSON.stringify({ ready: ["c001", 5, null], waiting: "x" }));
    expect(s?.ready).toEqual(["c001"]);
    expect(s?.waiting).toEqual([]);
  });

  // c0104: a run may carry per-run token/cost, which the c0100 popover shows.
  it("keeps a run's usage when present and well-formed", () => {
    const raw = JSON.stringify({
      status: "waiting",
      runs: [
        {
          cardId: "c001",
          phase: "waiting-for-input",
          usage: { inputTokens: 120, outputTokens: 340, totalCostUsd: 0.0123 },
        },
      ],
    });
    expect(parseCompanionState(raw)?.runs[0]).toEqual({
      cardId: "c001",
      phase: "waiting-for-input",
      usage: { inputTokens: 120, outputTokens: 340, totalCostUsd: 0.0123 },
    });
  });

  it("drops a run's usage when it is not an object, keeping the run", () => {
    const raw = JSON.stringify({
      runs: [{ cardId: "c001", phase: "running", usage: "lots" }],
    });
    expect(parseCompanionState(raw)?.runs[0]).toEqual({ cardId: "c001", phase: "running" });
  });

  // c0109: a running run may carry the agent's latest tool call as `activity`.
  it("keeps a run's activity when present and well-formed", () => {
    const raw = JSON.stringify({
      status: "running",
      runs: [{ cardId: "c001", phase: "running", activity: { name: "Edit", arg: "runner.ts" } }],
    });
    expect(parseCompanionState(raw)?.runs[0]).toEqual({
      cardId: "c001",
      phase: "running",
      activity: { name: "Edit", arg: "runner.ts" },
    });
  });

  it("keeps an activity with no arg (a tool that takes none)", () => {
    const raw = JSON.stringify({
      runs: [{ cardId: "c001", phase: "running", activity: { name: "TodoWrite" } }],
    });
    expect(parseCompanionState(raw)?.runs[0]).toEqual({
      cardId: "c001",
      phase: "running",
      activity: { name: "TodoWrite" },
    });
  });

  it("drops garbage activity but keeps the run (same contract as usage)", () => {
    for (const activity of [42, "editing", {}, { name: 5 }, { arg: "x" }, null]) {
      const raw = JSON.stringify({
        runs: [{ cardId: "c001", phase: "running", activity }],
      });
      expect(parseCompanionState(raw)?.runs[0]).toEqual({ cardId: "c001", phase: "running" });
    }
  });

  it("drops a non-string arg but keeps the activity name", () => {
    const raw = JSON.stringify({
      runs: [{ cardId: "c001", phase: "running", activity: { name: "Read", arg: 7 } }],
    });
    expect(parseCompanionState(raw)?.runs[0]).toEqual({
      cardId: "c001",
      phase: "running",
      activity: { name: "Read" },
    });
  });
});

// c0117: the app ticks the pickup countdown client-side, so it needs the
// configured delay from the state file.
// c0141: the companion publishes the card ids it owns a session for.
describe("owned parsing", () => {
  it("keeps the owned card ids", () => {
    const raw = JSON.stringify({ owned: ["c001", "c002"] });
    expect(parseCompanionState(raw)?.owned).toEqual(["c001", "c002"]);
  });

  it("defaults to empty and drops non-string entries", () => {
    expect(parseCompanionState(JSON.stringify({}))?.owned).toEqual([]);
    expect(parseCompanionState(JSON.stringify({ owned: ["c001", 5, null] }))?.owned).toEqual([
      "c001",
    ]);
    expect(parseCompanionState(JSON.stringify({ owned: "c001" }))?.owned).toEqual([]);
  });
});

describe("pickupDelay parsing", () => {
  it("keeps the published delay", () => {
    expect(parseCompanionState(JSON.stringify({ pickupDelay: 10, owned: [] }))?.pickupDelay).toBe(10);
  });

  it("keeps a zero delay rather than treating it as absent", () => {
    expect(parseCompanionState(JSON.stringify({ pickupDelay: 0, owned: [] }))?.pickupDelay).toBe(0);
  });

  it("falls back to no delay when it is missing or nonsense", () => {
    for (const value of [undefined, "10", -1, null, {}]) {
      const raw = JSON.stringify({ status: "idle", pickupDelay: value, owned: [] });
      expect(parseCompanionState(raw)?.pickupDelay).toBe(0);
    }
  });
});

// c0147: a card front offers a stop only when the card has a stoppable run.
describe("hasLiveRun", () => {
  const withRun = (phase: RunState["phase"]): CompanionState => ({
    status: "running",
    ready: [],
    waiting: [],
    runs: [{ cardId: "c001", phase }],
    updated: "2026-08-05T10:00:00",
    pickupDelay: 0,
    owned: [],
  });

  it("is true for a running or parked run", () => {
    expect(hasLiveRun(withRun("running"), "c001")).toBe(true);
    expect(hasLiveRun(withRun("waiting-for-input"), "c001")).toBe(true);
  });

  it("is false for a finished/errored/aborted run — nothing to stop", () => {
    for (const phase of ["done", "error", "aborted"] as const) {
      expect(hasLiveRun(withRun(phase), "c001")).toBe(false);
    }
  });

  it("is false for another card, or with no companion", () => {
    expect(hasLiveRun(withRun("running"), "c999")).toBe(false);
    expect(hasLiveRun(null, "c001")).toBe(false);
  });
});

describe("isCompanionLive", () => {
  function state(updated: string): CompanionState {
    return { status: "running", ready: [], waiting: [], runs: [], updated, pickupDelay: 0, owned: [] };
  }
  const now = Date.parse("2026-07-20T12:00:30");

  it("is false when there is no state (companion not running)", () => {
    expect(isCompanionLive(null, now)).toBe(false);
  });

  it("is true for a fresh state file", () => {
    expect(isCompanionLive(state("2026-07-20T12:00:20"), now)).toBe(true); // 10s old
  });

  it("is false when the state file has gone stale", () => {
    const stale = now + STALE_MS + 1_000; // well past the window
    expect(isCompanionLive(state("2026-07-20T12:00:30"), stale)).toBe(false);
  });

  it("treats an unparseable timestamp as live (can't confirm death)", () => {
    // real companions always write a parseable timestamp; only a corrupt file
    // hits this — keep showing status rather than hiding it behind Start.
    expect(isCompanionLive(state(""), now)).toBe(true);
  });
});

describe("newlyParkedIds (c0128)", () => {
  const waiting = (...ids: string[]): CompanionState => ({
    status: "waiting",
    ready: [],
    waiting: ids,
    runs: [],
    updated: "2026-07-23T10:00:00",
    pickupDelay: 0,
    owned: [],
  });

  it("baseline: the first observation (prev null) never notifies", () => {
    // opening the app never bursts banners for parks that were already there
    expect(newlyParkedIds(null, waiting("c001", "c002"))).toEqual([]);
    expect(newlyParkedIds(null, null)).toEqual([]);
  });

  it("fires for a card that just entered waiting", () => {
    expect(newlyParkedIds([], waiting("c005"))).toEqual(["c005"]);
  });

  it("fires only for the newcomer among cards already waiting", () => {
    expect(newlyParkedIds(["c001"], waiting("c001", "c005"))).toEqual(["c005"]);
  });

  it("does not re-fire for a card that stays parked across polls", () => {
    expect(newlyParkedIds(["c001"], waiting("c001"))).toEqual([]);
  });

  it("says nothing when a card leaves waiting and none is new", () => {
    expect(newlyParkedIds(["c001", "c002"], waiting("c001"))).toEqual([]);
  });

  it("reports several newcomers at once", () => {
    expect(newlyParkedIds([], waiting("c005", "c006"))).toEqual(["c005", "c006"]);
  });

  it("says nothing when the companion has gone (next null)", () => {
    expect(newlyParkedIds(["c001"], null)).toEqual([]);
  });

  it("fires once the companion appears after an observed-empty baseline", () => {
    // companion started after the app: baseline was empty, not null, so the
    // first real park still notifies
    expect(newlyParkedIds([], waiting("c005"))).toEqual(["c005"]);
  });
});

describe("companionStatePath", () => {
  it("points at .companion/state.json under the root", () => {
    expect(companionStatePath("/x/proj/.gello")).toBe("/x/proj/.gello/.companion/state.json");
  });
});

describe("readCompanionState", () => {
  it("returns the parsed state when the file exists", async () => {
    vi.mocked(readFileRaw).mockResolvedValueOnce(JSON.stringify({ status: "running" }));
    const s = await readCompanionState("/x/.gello");
    expect(s?.status).toBe("running");
    expect(readFileRaw).toHaveBeenCalledWith("/x/.gello/.companion/state.json");
  });

  it("returns null when the file is absent (companion not running)", async () => {
    vi.mocked(readFileRaw).mockRejectedValueOnce(new Error("ENOENT"));
    expect(await readCompanionState("/x/.gello")).toBeNull();
  });
});
