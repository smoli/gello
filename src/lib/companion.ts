// Reads the gello-companion's published state file
// (`.gello/.companion/state.json`) for the title-bar runner indicator (c0100).
// The companion is a separate process that writes this file; the app only
// reads it. An absent file means the companion isn't running → no indicator.
//
// The shape mirrors the companion's own CompanionState (companion/core.ts), but
// the app must not trust it blindly — a half-written or stale file is parsed
// defensively (unknown/garbage → treated as "no companion").

import { readFileRaw } from "./board-io";

export type RunPhase = "running" | "waiting-for-input" | "done" | "error";

/** Per-run token/cost the companion reports (c0104); the c0100 popover shows
 *  it. All fields optional — a backend without a figure omits it. */
export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  totalCostUsd?: number;
  numTurns?: number;
  durationMs?: number;
  permissionDenials?: number;
}

/** The agent's latest tool call (c0109), published while a run is running. The
 *  app phrases it into a card line — the companion sends only the structured
 *  pair. */
export interface Activity {
  name: string;
  arg?: string;
}

export interface RunState {
  cardId: string;
  phase: RunPhase;
  usage?: RunUsage;
  activity?: Activity;
}

export type RunnerStatus = "idle" | "running" | "waiting";

export interface CompanionState {
  status: RunnerStatus;
  /** Card ids sitting in `ready` (detected, awaiting dispatch). */
  ready: string[];
  /** Card ids parked on an unanswered open turn. */
  waiting: string[];
  runs: RunState[];
  updated: string;
  /** c0117: the companion's configured pickup grace period, in seconds. The app
   *  ticks the countdown itself from this plus the card's `status-changed`, so
   *  no extra polling is needed. `0` means the companion dispatches at once. */
  pickupDelay: number;
}

const STATUSES: RunnerStatus[] = ["idle", "running", "waiting"];
const PHASES: RunPhase[] = ["running", "waiting-for-input", "done", "error"];

/** A companion state file older than this (by its `updated`) is treated as
 *  stale — the process likely died without cleaning up. Shared by the
 *  title-bar liveness check and the per-card activity line (activity.ts). */
export const STALE_MS = 30_000;

/**
 * Whether a companion is actually running for the open board: a state file
 * present and not stale. Null (no file) or a stale timestamp → not live (the
 * title bar offers "Start companion" instead of the indicator). An unparseable
 * timestamp is treated as live — only a corrupt file hits that, and hiding a
 * possibly-running companion's status behind Start is worse than the reverse.
 */
export function isCompanionLive(state: CompanionState | null, now: number): boolean {
  if (!state) return false;
  const t = Date.parse(state.updated);
  return Number.isNaN(t) || now - t <= STALE_MS;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

const USAGE_KEYS = [
  "cacheReadTokens",
  "cacheCreationTokens",
  "totalCostUsd",
  "numTurns",
  "durationMs",
  "permissionDenials",
] as const;

/** A run's usage, or undefined when absent/garbage. Requires numeric token
 *  counts; other figures are copied only when numeric (a partial file degrades
 *  to the subset it can trust rather than blanking the run). */
function parseUsage(value: unknown): RunUsage | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const r = value as Record<string, unknown>;
  if (typeof r.inputTokens !== "number" || typeof r.outputTokens !== "number") {
    return undefined;
  }
  const usage: RunUsage = { inputTokens: r.inputTokens, outputTokens: r.outputTokens };
  for (const key of USAGE_KEYS) {
    if (typeof r[key] === "number") usage[key] = r[key] as number;
  }
  return usage;
}

/** A run's activity, or undefined when absent/garbage. Requires a non-empty
 *  `name`; `arg` is copied only when a string (a partial value degrades to just
 *  the name rather than blanking the field). */
function parseActivity(value: unknown): Activity | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const r = value as Record<string, unknown>;
  if (typeof r.name !== "string" || r.name === "") return undefined;
  const activity: Activity = { name: r.name };
  if (typeof r.arg === "string") activity.arg = r.arg;
  return activity;
}

/**
 * Parse the state file's raw JSON into a CompanionState, or null when the
 * content is missing or not a recognizable state object (treated as "no
 * companion"). Unknown fields are ignored; malformed runs are dropped rather
 * than failing the whole parse, so a partially-written file degrades to a
 * usable subset instead of blanking the indicator.
 */
export function parseCompanionState(raw: string): CompanionState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;

  const runs: RunState[] = Array.isArray(record.runs)
    ? record.runs
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .filter((r) => typeof r.cardId === "string" && PHASES.includes(r.phase as RunPhase))
        .map((r) => {
          const usage = parseUsage(r.usage);
          const activity = parseActivity(r.activity);
          return {
            cardId: r.cardId as string,
            phase: r.phase as RunPhase,
            ...(usage ? { usage } : {}),
            ...(activity ? { activity } : {}),
          };
        })
    : [];

  return {
    status: STATUSES.includes(record.status as RunnerStatus)
      ? (record.status as RunnerStatus)
      : "idle",
    ready: stringArray(record.ready),
    waiting: stringArray(record.waiting),
    runs,
    updated: typeof record.updated === "string" ? record.updated : "",
    pickupDelay:
      typeof record.pickupDelay === "number" &&
      Number.isFinite(record.pickupDelay) &&
      record.pickupDelay >= 0
        ? record.pickupDelay
        : 0,
  };
}

/** The companion state file path for a `.gello` root. */
export function companionStatePath(root: string): string {
  return `${root}/.companion/state.json`;
}

/**
 * Read and parse the companion state, or null when the companion isn't running
 * (file absent / unreadable / unparseable). A null result is the signal to show
 * no indicator at all.
 */
export async function readCompanionState(root: string): Promise<CompanionState | null> {
  let raw: string;
  try {
    raw = await readFileRaw(companionStatePath(root));
  } catch {
    return null; // file absent → companion not running
  }
  return parseCompanionState(raw);
}
