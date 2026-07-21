// gello-companion dashboard view-model (c0112).
//
// Everything the TUI shows, derived here and testable on its own: which
// renderer to use, per-card log routing, the companion-relevant board slice,
// and session totals. The renderer is presentation over this — it holds no
// logic of its own, so the dashboard's behaviour is covered by unit tests
// rather than by driving a terminal.

import type { BoardModel } from "../src/lib/board.ts";
import type { RunUsage } from "./stream.ts";
import { cardsEnteringReady } from "./core.ts";
import { cardsAwaitingInput } from "./qa.ts";

// --- activation --------------------------------------------------------------

/** Plain log lines (today's behaviour) or the live dashboard. */
export type RenderMode = "plain" | "tui";

/**
 * Pick the renderer from the output stream. A real terminal gets the dashboard;
 * piped, redirected or headless output keeps the plain lines, so c0069 headless
 * runs and any `| grep` still work. Automatic — there is no flag to remember,
 * which is what lets c0110's Start button get the TUI for free.
 */
export function renderMode(stream: { isTTY?: boolean }): RenderMode {
  return stream.isTTY === true ? "tui" : "plain";
}

// --- per-card log routing ----------------------------------------------------

/** How many lines a pane keeps. A run can emit thousands; the pane shows a
 *  tail, and `runs.log` remains the complete transcript. */
const DEFAULT_LIMIT = 500;

/**
 * One ring buffer of output lines per running card.
 *
 * At WIP 2 a single merged stream interleaves two agents — which is exactly
 * what c0104's `[cardId]` prefixes work around. Routing each sink's lines into
 * its own buffer removes the problem instead of mitigating it: the sink already
 * knows its card, so this replaces `console.log` at the existing `emit` seam.
 */
export class LogPanes {
  private readonly panes = new Map<string, string[]>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly limit: number = DEFAULT_LIMIT) {}

  /** Append one rendered line to a card's pane, dropping the oldest past the cap. */
  append(cardId: string, line: string): void {
    const pane = this.panes.get(cardId) ?? [];
    pane.push(line);
    if (pane.length > this.limit) pane.splice(0, pane.length - this.limit);
    this.panes.set(cardId, pane);
    for (const listener of this.listeners) listener();
  }

  /** A card's lines, oldest first. Empty for a card that has written none. */
  lines(cardId: string): readonly string[] {
    return this.panes.get(cardId) ?? [];
  }

  /** Cards in the order they first wrote — a stable order to arrow through. */
  cards(): string[] {
    return [...this.panes.keys()];
  }

  /** Forget a card's pane once its run has ended. `runs.log` keeps the record. */
  drop(cardId: string): void {
    if (this.panes.delete(cardId)) {
      for (const listener of this.listeners) listener();
    }
  }

  /** Observe changes so the view can redraw. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// --- the companion-relevant board slice --------------------------------------

export interface ColumnTally {
  column: string;
  count: number;
}

export interface BoardSlice {
  /** Card ids in the trigger status — what the companion picks up next. */
  ready: string[];
  /** Card ids parked on an unanswered question. */
  waiting: string[];
  /** One count per configured column, in board order. */
  tally: ColumnTally[];
}

/**
 * The parts of the board the companion is about — a queue, what is blocked on
 * the human, and a tally. Deliberately not a mini kanban: the desktop app is
 * usually on the same screen and does that better.
 */
export function boardSlice(model: BoardModel, trigger: string): BoardSlice {
  const all = [...model.cards, ...model.epics.flatMap((e) => e.cards)];
  const counts = new Map<string, number>();
  for (const card of all) counts.set(card.status, (counts.get(card.status) ?? 0) + 1);
  return {
    ready: cardsEnteringReady(null, model, trigger).map((c) => c.id),
    waiting: cardsAwaitingInput(model).map((c) => c.id),
    tally: model.config.columns.map((column) => ({
      column,
      count: counts.get(column) ?? 0,
    })),
  };
}

// --- session totals ----------------------------------------------------------

export interface SessionTotals {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** How many runs have reported usage this session. */
  runs: number;
}

export function emptyTotals(): SessionTotals {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0, runs: 0 };
}

/** Fold one run's reported usage into the session totals. Cumulative across
 *  every run since the companion started, so a finished run still counts
 *  toward what the session cost. */
export function addUsage(totals: SessionTotals, usage: RunUsage): SessionTotals {
  return {
    inputTokens: totals.inputTokens + usage.inputTokens,
    outputTokens: totals.outputTokens + usage.outputTokens,
    costUsd: totals.costUsd + (usage.totalCostUsd ?? 0),
    runs: totals.runs + 1,
  };
}

// --- elapsed -----------------------------------------------------------------

/** Compact elapsed time: `42s`, `2m05s`, `1h02m`. Clamped at zero so a clock
 *  adjustment can never render a negative duration. */
export function formatElapsed(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}
