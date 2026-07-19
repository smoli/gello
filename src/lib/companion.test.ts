import { describe, expect, it, vi } from "vitest";
import {
  parseCompanionState,
  companionStatePath,
  readCompanionState,
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
    });
    expect(parseCompanionState(raw)).toEqual({
      status: "waiting",
      ready: ["c001"],
      waiting: ["c002"],
      runs: [{ cardId: "c003", phase: "running" }],
      updated: "2026-07-19T10:00:00",
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
    expect(s).toEqual({ status: "idle", ready: [], waiting: [], runs: [], updated: "" });
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
