import { describe, expect, it } from "vitest";
import { Dashboard, frameToAnsi, terminalSize, type Screen } from "./tui.ts";
import { emptyTotals } from "./tui-model.ts";
import type { DashboardState } from "./tui-frame.ts";

// c0112: the shell's *behaviour* — terminal setup/restore, key navigation and
// resize — is wired to the UI, so it is tested against a fake screen. The
// drawing itself is composeFrame's job and is tested there.

function fakeScreen() {
  let size = { columns: 80, rows: 24 };
  const writes: string[] = [];
  const events = { key: (_s: string) => {}, resize: () => {} };
  let setup = 0;
  let restored = 0;
  const screen: Screen = {
    size: () => size,
    write: (text) => writes.push(text),
    setup: () => setup++,
    restore: () => restored++,
    onKey: (handler) => (events.key = handler),
    onResize: (handler) => (events.resize = handler),
  };
  return {
    screen,
    writes,
    press: (seq: string) => events.key(seq),
    resizeTo: (columns: number, rows: number) => {
      size = { columns, rows };
      events.resize();
    },
    setupCount: () => setup,
    restoredCount: () => restored,
    last: () => writes[writes.length - 1] ?? "",
  };
}

/** A snapshot provider with two running cards, whose pane follows the selection. */
function snapshot(selected: string | null): Omit<DashboardState, "selected" | "collapsed"> {
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
    runs: [
      { cardId: "c001", title: "One", phase: "running", startedAt: 0 },
      { cardId: "c002", title: "Two", phase: "running", startedAt: 0 },
    ],
    paneLines: [`pane line for ${selected ?? "nothing"}`],
    now: 0,
  };
}

function dashboard(fake = fakeScreen()) {
  let quit = 0;
  const board = new Dashboard(
    fake.screen,
    snapshot,
    () => ["c001", "c002"],
    () => quit++,
  );
  return { fake, board, quits: () => quit };
}

// A terminal does not always know its own size: a pty with no window size, or
// output that is a tty but unsized, reports 0 (or nothing). Taking that
// literally composes a zero-row frame and draws an empty screen — which is
// exactly what happened the first time this ran under a pty.
describe("terminalSize", () => {
  it("uses the terminal's own size when it has one", () => {
    expect(terminalSize({ columns: 120, rows: 40 })).toEqual({ columns: 120, rows: 40 });
  });

  it("falls back when the terminal reports zero", () => {
    expect(terminalSize({ columns: 0, rows: 0 })).toEqual({ columns: 80, rows: 24 });
  });

  it("falls back when the terminal reports nothing at all", () => {
    expect(terminalSize({})).toEqual({ columns: 80, rows: 24 });
  });

  it("falls back on a nonsense negative size", () => {
    expect(terminalSize({ columns: -5, rows: -1 })).toEqual({ columns: 80, rows: 24 });
  });
});

describe("frameToAnsi", () => {
  it("homes the cursor and clears each line, in a single write", () => {
    const out = frameToAnsi(["a", "b"]);
    expect(out.startsWith("\x1b[H")).toBe(true);
    expect(out).toContain("\x1b[2K"); // clear to end of line, so no stale text
  });
});

describe("Dashboard", () => {
  it("sets the terminal up and draws on start", () => {
    const { fake, board } = dashboard();
    board.start();
    expect(fake.setupCount()).toBe(1);
    expect(fake.writes.length).toBeGreaterThan(0);
  });

  it("restores the terminal on stop", () => {
    const { fake, board } = dashboard();
    board.start();
    board.stop();
    expect(fake.restoredCount()).toBe(1);
  });

  // criterion: Ctrl-C exits cleanly and restores the terminal
  it("restores the terminal and quits on Ctrl-C", () => {
    const { fake, board, quits } = dashboard();
    board.start();
    fake.press("\x03");
    expect(fake.restoredCount()).toBe(1);
    expect(quits()).toBe(1);
  });

  // criterion: a resize re-lays out without corrupting the view
  it("redraws at the new size on resize", () => {
    const { fake, board } = dashboard();
    board.start();
    fake.resizeTo(40, 10);
    const frame = fake.last().split("\r\n");
    expect(frame).toHaveLength(10);
    for (const line of frame) {
      expect(line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").length).toBeLessThanOrEqual(40);
    }
  });

  // criterion: arrow keys switch cards
  it("selects the first card on start and moves with the arrows", () => {
    const { fake, board } = dashboard();
    board.start();
    expect(fake.last()).toContain("▸ c001");

    fake.press("\x1b[C"); // right
    expect(fake.last()).toContain("▸ c002");
    expect(fake.last()).toContain("pane line for c002"); // the pane follows

    fake.press("\x1b[D"); // left
    expect(fake.last()).toContain("▸ c001");
  });

  // criterion: a key collapses/expands the pane
  it("collapses and expands the pane", () => {
    const { fake, board } = dashboard();
    board.start();
    expect(fake.last()).toContain("pane line for c001");

    fake.press(" ");
    expect(fake.last()).not.toContain("pane line for c001");
    expect(fake.last()).toContain("collapsed");

    fake.press(" ");
    expect(fake.last()).toContain("pane line for c001");
  });

  it("ignores keys that would drive a run", () => {
    const { fake, board, quits } = dashboard();
    board.start();
    const before = fake.writes.length;
    for (const key of ["p", "k", "q", "\r"]) fake.press(key);
    expect(quits()).toBe(0);
    expect(fake.writes.length).toBe(before); // nothing even redrew
  });
});
