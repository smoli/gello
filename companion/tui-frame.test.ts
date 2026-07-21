import { describe, expect, it } from "vitest";
import { fit, composeFrame, decodeKey, cycleCard, type DashboardState } from "./tui-frame.ts";
import { emptyTotals, addUsage } from "./tui-model.ts";

// c0112: the dashboard is drawn with raw ANSI, so the *composition* is kept a
// pure function from state to screen lines. That is where every layout rule
// lives and where the acceptance criteria are checked; the terminal shell only
// writes what this returns.

describe("fit", () => {
  it("leaves text that already fits", () => {
    expect(fit("abc", 5)).toBe("abc");
  });

  it("truncates with an ellipsis, never exceeding the width", () => {
    expect(fit("abcdef", 5)).toBe("abcd…");
    expect(fit("abcdef", 5)).toHaveLength(5);
  });

  it("handles degenerate widths without throwing", () => {
    expect(fit("abc", 0)).toBe("");
    expect(fit("abc", 1)).toBe("…");
  });
});

describe("cycleCard", () => {
  const cards = ["c001", "c002", "c003"];

  it("moves to the next and previous card", () => {
    expect(cycleCard(cards, "c001", 1)).toBe("c002");
    expect(cycleCard(cards, "c002", -1)).toBe("c001");
  });

  it("wraps at both ends", () => {
    expect(cycleCard(cards, "c003", 1)).toBe("c001");
    expect(cycleCard(cards, "c001", -1)).toBe("c003");
  });

  it("selects the first card when nothing is selected yet", () => {
    expect(cycleCard(cards, null, 1)).toBe("c001");
  });

  it("is null when there are no cards", () => {
    expect(cycleCard([], null, 1)).toBeNull();
  });

  it("recovers when the selected card has gone (its run ended)", () => {
    expect(cycleCard(cards, "c999", 1)).toBe("c001");
  });
});

describe("decodeKey", () => {
  it("maps arrow keys to card navigation", () => {
    expect(decodeKey("\x1b[C")).toBe("next"); // right
    expect(decodeKey("\x1b[D")).toBe("prev"); // left
    expect(decodeKey("\x1b[B")).toBe("next"); // down
    expect(decodeKey("\x1b[A")).toBe("prev"); // up
  });

  it("toggles the pane on space or c", () => {
    expect(decodeKey(" ")).toBe("toggle");
    expect(decodeKey("c")).toBe("toggle");
  });

  it("quits on Ctrl-C", () => {
    expect(decodeKey("\x03")).toBe("quit");
  });

  it("ignores anything else — the TUI drives nothing", () => {
    // no key may pause, kill or reconfigure a run
    for (const key of ["x", "\r", "p", "k", "q", "1"]) {
      expect(decodeKey(key)).toBeNull();
    }
  });
});

// --- the frame ---------------------------------------------------------------

function state(over: Partial<DashboardState> = {}): DashboardState {
  return {
    boardRoot: "/proj/.gello",
    agent: "claude",
    model: "claude-opus-4-8",
    scope: "epic",
    trigger: "ready",
    permissionMode: "auto",
    wipLimit: 2,
    startedAt: 0,
    totals: emptyTotals(),
    board: { ready: [], waiting: [], tally: [] },
    runs: [],
    paneLines: [],
    selected: null,
    collapsed: false,
    now: 0,
    ...over,
  };
}

const SIZE = { columns: 80, rows: 24 };
const frameText = (s: DashboardState, size = SIZE) => composeFrame(s, size).join("\n");

describe("composeFrame", () => {
  it("fills exactly the terminal height and never overruns the width", () => {
    const lines = composeFrame(
      state({
        board: { ready: ["c001"], waiting: [], tally: [{ column: "ready", count: 1 }] },
        runs: [{ cardId: "c001", title: "A very long card title ".repeat(10), phase: "running", startedAt: 0 }],
        paneLines: Array.from({ length: 100 }, (_, i) => `line ${i}`),
        selected: "c001",
      }),
      SIZE,
    );
    expect(lines).toHaveLength(SIZE.rows);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(SIZE.columns);
  });

  it("re-lays out for a different terminal size", () => {
    const narrow = composeFrame(state(), { columns: 40, rows: 10 });
    expect(narrow).toHaveLength(10);
    for (const line of narrow) expect(line.length).toBeLessThanOrEqual(40);
  });

  // criterion: header shows board, agent, model, session run time and totals
  it("heads with the board, agent and model", () => {
    const text = frameText(state());
    expect(text).toContain("/proj/.gello");
    expect(text).toContain("claude");
    expect(text).toContain("claude-opus-4-8");
  });

  it("shows the session run time and running token/cost totals", () => {
    const totals = addUsage(emptyTotals(), {
      inputTokens: 1200,
      outputTokens: 340,
      totalCostUsd: 0.0123,
    });
    const text = frameText(state({ totals, startedAt: 0, now: 125_000 }));
    expect(text).toContain("2m05s"); // session run time
    expect(text).toMatch(/1200|1\.2k/); // input tokens
    expect(text).toContain("340");
    expect(text).toContain("$0.01");
  });

  it("names the configured scope, trigger, permissions and WIP limit", () => {
    const text = frameText(state());
    expect(text).toContain("epic");
    expect(text).toContain("ready");
    expect(text).toContain("auto");
    expect(text).toContain("2");
  });

  it("shows a placeholder model until the agent reports one", () => {
    expect(frameText(state({ model: undefined }))).toContain("model=—");
  });

  it("shows an unlimited WIP as a symbol, not the word Infinity", () => {
    const text = frameText(state({ wipLimit: Infinity }));
    expect(text).not.toContain("Infinity");
    expect(text).toContain("wip=∞");
  });

  // The companion's own lifecycle and error lines cannot go to stdout while the
  // TUI owns the screen, so the newest one is shown in the frame instead.
  it("surfaces the latest companion message, so errors are not swallowed", () => {
    expect(frameText(state({ status: "could not write state.json: EACCES" }))).toContain(
      "could not write state.json: EACCES",
    );
  });

  // criterion: the board slice
  it("lists the ready queue, the cards waiting on input, and a column tally", () => {
    const text = frameText(
      state({
        board: {
          ready: ["c010", "c011"],
          waiting: ["c020"],
          tally: [
            { column: "ready", count: 2 },
            { column: "done", count: 7 },
          ],
        },
      }),
    );
    expect(text).toContain("c010");
    expect(text).toContain("c011");
    expect(text).toContain("c020");
    expect(text).toMatch(/ready[^\n]*2/);
    expect(text).toMatch(/done[^\n]*7/);
  });

  // criterion: each active run shows phase, elapsed, tokens/cost and activity
  it("gives each run its phase, elapsed, tokens/cost and current activity", () => {
    const text = frameText(
      state({
        now: 65_000,
        runs: [
          {
            cardId: "c001",
            title: "Wire the thing",
            phase: "running",
            startedAt: 5_000,
            usage: { inputTokens: 900, outputTokens: 120, totalCostUsd: 0.02 },
            activity: "Editing runner.ts",
          },
        ],
      }),
    );
    expect(text).toContain("c001");
    expect(text).toContain("Wire the thing");
    expect(text).toContain("running");
    expect(text).toContain("1m00s");
    expect(text).toContain("Editing runner.ts");
    expect(text).toContain("$0.02");
  });

  it("says so when nothing is running", () => {
    expect(frameText(state())).toMatch(/no active runs/i);
  });

  // criterion: a pane per running card, collapsible
  it("shows the selected card's pane lines", () => {
    const text = frameText(
      state({ selected: "c001", paneLines: ["[c001] → Read(a.ts)", "[c001] → Bash(ls)"] }),
    );
    expect(text).toContain("→ Read(a.ts)");
    expect(text).toContain("→ Bash(ls)");
  });

  it("hides the pane body when collapsed but still names the card", () => {
    const text = frameText(
      state({ selected: "c001", collapsed: true, paneLines: ["[c001] → Read(a.ts)"] }),
    );
    expect(text).not.toContain("Read(a.ts)");
    expect(text).toContain("c001");
  });

  it("shows the newest pane lines when there are more than fit", () => {
    const many = Array.from({ length: 200 }, (_, i) => `line ${i}`);
    const text = frameText(state({ selected: "c001", paneLines: many }));
    expect(text).toContain("line 199"); // the tail, not the head
    expect(text).not.toContain("line 0 ");
  });

  it("marks which card is selected when several are running", () => {
    const text = frameText(
      state({
        selected: "c002",
        runs: [
          { cardId: "c001", title: "One", phase: "running", startedAt: 0 },
          { cardId: "c002", title: "Two", phase: "running", startedAt: 0 },
        ],
      }),
    );
    // the selected card is marked somewhere on its row
    const row = text.split("\n").find((l) => l.includes("c002"))!;
    const other = text.split("\n").find((l) => l.includes("c001"))!;
    expect(row).not.toBe(other);
    expect(row.trimStart()[0]).not.toBe(other.trimStart()[0]);
  });
});
