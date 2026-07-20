// i0115: an end-to-end guard across the companion → state.json → app seam.
// c0109 unit-tested each layer in isolation (the runner's RunState, the app's
// parse, the phrasing), but nothing pinned the *contract between them*: a field
// renamed on one side would pass both suites yet leave the card on "Thinking…".
// This drives a real tool call through the runner, serializes the published
// state exactly as the companion writes it, and asserts the app phrases it.
//
// (The reported i0115 run showed only "Thinking…" because the companion process
// predated c0109's transport code — an operational stale process, not a code
// defect. This test locks the code contract so a real regression can't recur.)

import { describe, expect, it } from "vitest";
import { loadBoard, type BoardModel } from "../src/lib/board.ts";
import { claudeAdapter } from "./adapters.ts";
import { Runner, type SpawnedRun } from "./runner.ts";
import type { RunState } from "./core.ts";
import type { LaunchSpec } from "./adapters.ts";
import { initialState, type CompanionState } from "./core.ts";
import { parseCompanionState } from "../src/lib/companion.ts";
import { cardActivity } from "../src/lib/activity.ts";

class FakeProc implements SpawnedRun {
  private exitCb: ((code: number | null) => void) | null = null;
  private stdoutCb: ((chunk: string) => void) | null = null;
  constructor(readonly spec: LaunchSpec) {}
  onExit(cb: (code: number | null) => void): void {
    this.exitCb = cb;
  }
  onStdout(cb: (chunk: string) => void): void {
    this.stdoutCb = cb;
  }
  stdout(chunk: string): void {
    this.stdoutCb?.(chunk);
  }
  exit(code: number | null): void {
    this.exitCb?.(code);
  }
}

function toolLine(name: string, input: Record<string, unknown>): string {
  return `${JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name, input }] },
  })}\n`;
}

function board(): BoardModel {
  return loadBoard([
    { path: "board.yaml", content: "columns: [ready, in-progress]\nwip_limits:\n  in-progress: 2\n" },
    { path: "cards/c001-x.md", content: "---\nid: c001\ntitle: Card c001\nstatus: ready\norder: 1\n---\n\n## What\n\ntask\n" },
  ]);
}

/** Serialize the runner's published runs into a state file exactly as the
 *  companion does (see core.ts writeStateFile), then round-trip through the app
 *  parser back to a state object. */
function publishAndReadBack(runs: RunState[]): CompanionState | null {
  const state: CompanionState = { ...initialState("2026-07-21T00:11:17"), runs, status: "running" };
  const raw = `${JSON.stringify(state, null, 2)}\n`;
  return parseCompanionState(raw);
}

describe("i0115 — activity survives the companion → state.json → app seam", () => {
  /** A runner whose spawned fake processes are captured for driving stdout. */
  function seamRunner() {
    const model = board();
    const procs: FakeProc[] = [];
    let published: RunState[] = [];
    const runner = new Runner({
      cwd: "/project",
      boardRoot: "/project/.gello",
      adapter: claudeAdapter,
      scope: "card",
      wipLimit: 2,
      spawn: (spec) => {
        const proc = new FakeProc(spec);
        procs.push(proc);
        return proc;
      },
      reload: () => model,
      onRuns: (runs) => (published = runs),
    });
    runner.sync(model);
    return { procs, published: () => published };
  }

  const now = Date.parse("2026-07-21T00:11:19"); // 2s after `updated` → fresh

  it("a tool call the runner sees becomes a phrased line on the card", () => {
    const { procs, published } = seamRunner();
    procs[0].stdout(toolLine("Edit", { file_path: "src/components/TitleBar.tsx" }));

    const back = publishAndReadBack(published());
    expect(cardActivity(back, "c001", now)?.label).toBe("Editing TitleBar.tsx");
  });

  it("the gello set_status tool phrases across the seam (the first call in a run)", () => {
    const { procs, published } = seamRunner();
    procs[0].stdout(toolLine("mcp__gello__set_status", { status: "in-progress" }));

    const back = publishAndReadBack(published());
    expect(cardActivity(back, "c001", now)?.label).toBe("Updating status");
  });
});
