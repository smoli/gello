// Phrasing for a card's live activity line (c0109). The companion publishes the
// structured tool call (`activity: {name, arg}`); phrasing is the app's job, so
// rewording never needs a companion release and card width stays the app's
// concern. `cardActivity` turns the companion state into the one line a card
// shows — or null when there should be none.

import type { Activity, CompanionState } from "./companion";

/** A running run older than this (by the state file's `updated`) is treated as
 *  stale: a crashed or wedged companion would otherwise pin a line forever. */
const STALE_MS = 30_000;

/** Cap the phrased line; the card also truncates visually (one line, ellipsis). */
const MAX = 60;

/** Tool → verb. Keyed on the bare tool name (MCP prefix stripped). An unmapped
 *  tool falls back to its own name. */
const VERBS: Record<string, string> = {
  Edit: "Editing",
  Write: "Editing",
  Read: "Reading",
  Bash: "Running",
  Grep: "Searching",
  Glob: "Searching",
  set_status: "Updating status",
  add_question: "Asking a question",
};

/** Tools whose argument is a file path — show its basename, not the whole path. */
const PATH_TOOLS = new Set(["Edit", "Write", "Read"]);

/** Tools whose verb already says everything — the argument adds nothing. */
const NO_ARG_TOOLS = new Set(["set_status", "add_question"]);

/** Strip an MCP tool's `mcp__<server>__` prefix, leaving the bare tool name. */
function bareName(name: string): string {
  return name.replace(/^mcp__.+?__/, "");
}

/** Last path segment (forward or back slashes). */
function basename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** Collapse whitespace to one bounded line. */
function oneLine(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > MAX ? `${flat.slice(0, MAX)}…` : flat;
}

/** One card-width line for a tool call: "Editing runner.ts", "Running pnpm
 *  test", "Updating status". */
export function phraseActivity(activity: Activity): string {
  const name = bareName(activity.name);
  const verb = VERBS[name] ?? name;
  if (NO_ARG_TOOLS.has(name)) return verb;
  const arg = activity.arg?.trim();
  if (!arg) return verb;
  return `${verb} ${oneLine(PATH_TOOLS.has(name) ? basename(arg) : arg)}`;
}

export interface CardActivity {
  /** The phrased line, e.g. "Editing runner.ts" or "Thinking…". */
  label: string;
  /** True when the state file has gone stale — render the line as suspect. */
  stale: boolean;
}

function isStale(updated: string, now: number): boolean {
  const t = Date.parse(updated);
  if (Number.isNaN(t)) return true; // can't confirm freshness → treat as stale
  return now - t > STALE_MS;
}

/**
 * The activity line for a card, or null when there should be none: no companion
 * running, no run for the card, or a run that isn't `running` (a parked run
 * shows the needs-input badge; done/errored runs show nothing). A running run
 * with no tool call yet shows "Thinking…".
 */
export function cardActivity(
  state: CompanionState | null,
  cardId: string,
  now: number,
): CardActivity | null {
  if (!state) return null;
  const run = state.runs.find((r) => r.cardId === cardId);
  if (!run || run.phase !== "running") return null;
  return {
    label: run.activity ? phraseActivity(run.activity) : "Thinking…",
    stale: isStale(state.updated, now),
  };
}
