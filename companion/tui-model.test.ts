import { describe, expect, it } from "vitest";
import { loadBoard, type BoardModel } from "../src/lib/board.ts";

import {
  LogPanes,
  renderMode,
  boardSlice,
  addUsage,
  emptyTotals,
  formatElapsed,
} from "./tui-model.ts";

// c0112: the TUI's view-model — everything the dashboard shows, derived and
// testable on its own. The renderer is presentation over this.

// --- per-card log routing ----------------------------------------------------
// The acceptance criterion is that two concurrent runs never interleave, which
// is a property of the routing, not of the drawing.

describe("LogPanes", () => {
  it("keeps each card's lines in its own pane", () => {
    const panes = new LogPanes();
    panes.append("c001", "[c001] → Read(a.ts)");
    panes.append("c002", "[c002] → Read(b.ts)");
    panes.append("c001", "[c001] → Bash(ls)");

    expect(panes.lines("c001")).toEqual(["[c001] → Read(a.ts)", "[c001] → Bash(ls)"]);
    expect(panes.lines("c002")).toEqual(["[c002] → Read(b.ts)"]);
  });

  it("has no lines for a card that never wrote any", () => {
    expect(new LogPanes().lines("c999")).toEqual([]);
  });

  it("lists cards in the order they first wrote, so arrow-key order is stable", () => {
    const panes = new LogPanes();
    panes.append("c002", "x");
    panes.append("c001", "y");
    panes.append("c002", "z");
    expect(panes.cards()).toEqual(["c002", "c001"]);
  });

  it("keeps only the last N lines — a long run must not grow without bound", () => {
    const panes = new LogPanes(3);
    for (const n of [1, 2, 3, 4, 5]) panes.append("c001", `line ${n}`);
    expect(panes.lines("c001")).toEqual(["line 3", "line 4", "line 5"]);
  });

  it("drops a pane when its run ends, without touching the others", () => {
    const panes = new LogPanes();
    panes.append("c001", "a");
    panes.append("c002", "b");
    panes.drop("c001");
    expect(panes.cards()).toEqual(["c002"]);
    expect(panes.lines("c001")).toEqual([]);
  });

  it("notifies a subscriber when a line arrives, so the view can redraw", () => {
    const panes = new LogPanes();
    let notified = 0;
    const stop = panes.subscribe(() => notified++);
    panes.append("c001", "a");
    expect(notified).toBe(1);
    stop();
    panes.append("c001", "b");
    expect(notified).toBe(1); // unsubscribed
  });
});

// --- activation --------------------------------------------------------------

describe("renderMode", () => {
  it("uses the TUI on a real terminal", () => {
    expect(renderMode({ isTTY: true })).toBe("tui");
  });

  it("falls back to plain log lines when piped or redirected", () => {
    expect(renderMode({ isTTY: false })).toBe("plain");
  });

  it("falls back when the stream reports no TTY flag at all (headless)", () => {
    expect(renderMode({})).toBe("plain");
  });
});

// --- the companion-relevant board slice --------------------------------------

const BOARD = "columns: [inbox, ready, in-progress, review, done]\n";

function board(cards: Record<string, string>): BoardModel {
  return loadBoard([
    { path: "board.yaml", content: BOARD },
    ...Object.entries(cards).map(([id, status]) => ({
      path: `cards/${id}-x.md`,
      content: `---\nid: ${id}\ntitle: Card ${id}\nstatus: ${status}\n---\n\n## What\n\ntask\n`,
    })),
  ]);
}

describe("boardSlice", () => {
  it("lists the ready queue — what the companion picks up next", () => {
    const slice = boardSlice(board({ c001: "ready", c002: "ready", c003: "done" }), "ready");
    expect(slice.ready).toEqual(["c001", "c002"]);
  });

  it("honours a configured trigger status other than ready (c0099)", () => {
    // `inbox` is a real column here — a status absent from board.yaml would make
    // the card invalid rather than triggerable.
    const slice = boardSlice(board({ c001: "inbox", c002: "ready" }), "inbox");
    expect(slice.ready).toEqual(["c001"]);
  });

  it("tallies every configured column, including empty ones", () => {
    const slice = boardSlice(board({ c001: "ready", c002: "done", c003: "done" }), "ready");
    expect(slice.tally).toEqual([
      { column: "inbox", count: 0 },
      { column: "ready", count: 1 },
      { column: "in-progress", count: 0 },
      { column: "review", count: 0 },
      { column: "done", count: 2 },
    ]);
  });

  it("lists cards parked on an unanswered question", () => {
    const model = loadBoard([
      { path: "board.yaml", content: BOARD },
      {
        path: "cards/c001-x.md",
        content:
          "---\nid: c001\ntitle: Parked\nstatus: in-progress\nawaiting: input\n---\n\n" +
          "```gelloquestion\n### Which?\n\n- [ ] a\n```\n",
      },
    ]);
    expect(boardSlice(model, "ready").waiting).toEqual(["c001"]);
  });
});

// --- session totals ----------------------------------------------------------
// Cumulative across every run since the companion started, so a finished run
// still counts toward what the session cost.

describe("session totals", () => {
  it("starts at zero", () => {
    expect(emptyTotals()).toEqual({ inputTokens: 0, outputTokens: 0, costUsd: 0, runs: 0 });
  });

  it("accumulates tokens, cost and a run count", () => {
    let t = emptyTotals();
    t = addUsage(t, { inputTokens: 100, outputTokens: 20, totalCostUsd: 0.5 });
    t = addUsage(t, { inputTokens: 5, outputTokens: 2, totalCostUsd: 0.25 });
    expect(t).toEqual({ inputTokens: 105, outputTokens: 22, costUsd: 0.75, runs: 2 });
  });

  it("tolerates a backend that reports no cost", () => {
    const t = addUsage(emptyTotals(), { inputTokens: 1, outputTokens: 1 });
    expect(t.costUsd).toBe(0);
    expect(t.runs).toBe(1);
  });
});

// --- elapsed -----------------------------------------------------------------

describe("formatElapsed", () => {
  it("shows seconds under a minute", () => {
    expect(formatElapsed(0, 42_000)).toBe("42s");
  });

  it("shows minutes and seconds under an hour", () => {
    expect(formatElapsed(0, 125_000)).toBe("2m05s");
  });

  it("shows hours once past one", () => {
    expect(formatElapsed(0, 3_725_000)).toBe("1h02m");
  });

  it("never goes negative if the clock jitters", () => {
    expect(formatElapsed(1_000, 0)).toBe("0s");
  });
});
