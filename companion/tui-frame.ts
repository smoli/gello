// gello-companion dashboard composition (c0112).
//
// The TUI is drawn with raw ANSI — no dependency — so the *composition* is kept
// a pure function from state to screen lines. Every layout rule lives here and
// is unit-tested; the terminal shell (tui.ts) only writes what this returns and
// owns nothing but I/O. That split is what keeps a hand-rolled renderer
// testable without driving a real terminal.

import type { RunUsage } from "./stream.ts";
import { formatElapsed, type BoardSlice, type SessionTotals } from "./tui-model.ts";

/** One active run, as the dashboard shows it. */
export interface RunRow {
  cardId: string;
  title: string;
  phase: string;
  startedAt: number;
  usage?: RunUsage;
  /** The c0109 activity line, already phrased. */
  activity?: string;
}

export interface DashboardState {
  boardRoot: string;
  agent: string;
  model?: string;
  scope: string;
  trigger: string;
  permissionMode: string;
  wipLimit: number;
  /** When the companion started, for the session run time. */
  startedAt: number;
  totals: SessionTotals;
  board: BoardSlice;
  runs: RunRow[];
  /** Lines of the selected card's pane, oldest first. */
  paneLines: readonly string[];
  selected: string | null;
  collapsed: boolean;
  now: number;
  /** The companion's latest lifecycle or error message. While the TUI owns the
   *  screen these cannot go to stdout, so the newest is shown in the frame. */
  status?: string;
}

export interface Size {
  columns: number;
  rows: number;
}

/** Truncate to `width` with an ellipsis. Never returns more than `width`
 *  characters, so a line can't wrap and corrupt the frame. */
export function fit(text: string, width: number): string {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  if (width === 1) return "…";
  return `${text.slice(0, width - 1)}…`;
}

/** The next/previous card, wrapping. Falls back to the first card when nothing
 *  is selected or the selection has gone (its run ended). */
export function cycleCard(
  cards: readonly string[],
  selected: string | null,
  direction: 1 | -1,
): string | null {
  if (cards.length === 0) return null;
  const at = selected === null ? -1 : cards.indexOf(selected);
  if (at === -1) return cards[0];
  return cards[(at + direction + cards.length) % cards.length];
}

/** What a keypress means. Navigation and view only — nothing here drives a run. */
export type Action = "prev" | "next" | "toggle" | "quit";

/** Decode one input sequence. Unknown keys are ignored, which is what keeps the
 *  dashboard read-only: there is no key that pauses, kills or reconfigures. */
export function decodeKey(sequence: string): Action | null {
  switch (sequence) {
    case "\x1b[C":
    case "\x1b[B":
      return "next";
    case "\x1b[D":
    case "\x1b[A":
      return "prev";
    case " ":
    case "c":
      return "toggle";
    case "\x03":
      return "quit";
    default:
      return null;
  }
}

/** Compact token count: 1200 → 1.2k. */
function tokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function money(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

function usageCell(usage: RunUsage | undefined): string {
  if (!usage) return "—";
  const counts = `${tokens(usage.inputTokens)}/${tokens(usage.outputTokens)}`;
  return usage.totalCostUsd === undefined
    ? counts
    : `${counts} ${money(usage.totalCostUsd)}`;
}

/**
 * Lay the dashboard out for a terminal of `size`. Always returns exactly
 * `size.rows` lines, each at most `size.columns` wide, so the caller can write
 * the frame blind — a resize just produces a different frame.
 */
export function composeFrame(state: DashboardState, size: Size): string[] {
  const w = size.columns;
  const lines: string[] = [];

  // --- header
  lines.push(
    fit(
      `gello-companion  ${state.boardRoot}  agent=${state.agent} ` +
        `model=${state.model ?? "—"}`,
      w,
    ),
  );
  lines.push(
    fit(
      `scope=${state.scope} trigger=${state.trigger} perms=${state.permissionMode} ` +
        `wip=${Number.isFinite(state.wipLimit) ? state.wipLimit : "∞"}  ` +
        `up ${formatElapsed(state.startedAt, state.now)}  ` +
        `${tokens(state.totals.inputTokens)}/${tokens(state.totals.outputTokens)} tok  ` +
        `${money(state.totals.costUsd)}`,
      w,
    ),
  );
  if (state.status) lines.push(fit(state.status, w));
  lines.push(fit("─".repeat(w), w));

  // --- board slice: what is queued, what is blocked on the human, the shape
  const ready = state.board.ready.length > 0 ? state.board.ready.join(" ") : "—";
  const waiting = state.board.waiting.length > 0 ? state.board.waiting.join(" ") : "—";
  lines.push(fit(`ready: ${ready}`, w));
  lines.push(fit(`waiting on you: ${waiting}`, w));
  if (state.board.tally.length > 0) {
    lines.push(fit(state.board.tally.map((t) => `${t.column} ${t.count}`).join(" · "), w));
  }
  lines.push(fit("─".repeat(w), w));

  // --- runs
  if (state.runs.length === 0) {
    lines.push(fit("no active runs", w));
  } else {
    for (const run of state.runs) {
      const marker = run.cardId === state.selected ? "▸" : " ";
      const head =
        `${marker} ${run.cardId}  ${run.phase}  ` +
        `${formatElapsed(run.startedAt, state.now)}  ${usageCell(run.usage)}  ${run.title}`;
      lines.push(fit(head, w));
      if (run.activity) lines.push(fit(`    ${run.activity}`, w));
    }
  }

  // --- the selected card's pane, filling whatever height is left
  if (state.selected) {
    lines.push(fit(`─── ${state.selected} ${state.collapsed ? "(collapsed)" : ""}`.trimEnd(), w));
    if (!state.collapsed) {
      const room = Math.max(0, size.rows - lines.length);
      // the newest lines are the interesting ones, so show the tail
      for (const line of state.paneLines.slice(-room)) lines.push(fit(line, w));
    }
  }

  // pad or clip to exactly the terminal height
  while (lines.length < size.rows) lines.push("");
  return lines.slice(0, size.rows);
}
