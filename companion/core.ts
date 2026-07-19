// gello-companion core (c0093): the pure, Node-side pieces the companion CLI
// builds on — reading the board tree, detecting cards entering `ready`, and
// the state file the desktop app reads. Board logic itself is reused from
// board.ts; nothing here re-parses cards.

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join, relative, sep, dirname } from "node:path";
import { loadBoard, type BoardFile, type BoardModel } from "../src/lib/board.ts";
import type { Card } from "../src/lib/cards.ts";

/**
 * Walk up from `start` looking for a `.gello/` directory; returns its absolute
 * path, or null if none up to the filesystem root. Mirrors the Rust
 * `find_board_root`, so the companion locates the board the same way the app
 * does.
 */
export function findBoardRoot(start: string): string | null {
  let dir = start;
  for (;;) {
    const candidate = join(dir, ".gello");
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch {
      // not here — keep walking up
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Read every file under the `.gello` root into `BoardFile[]`, mirroring the
 * Rust `read_board_files` command: paths are relative to the root with forward
 * slashes so `loadBoard` sees the same contract on every platform.
 */
export function readBoardFiles(root: string): BoardFile[] {
  const files: BoardFile[] = [];
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const abs = join(entry.parentPath, entry.name);
    const path = relative(root, abs).split(sep).join("/");
    files.push({ path, content: readFileSync(abs, "utf8") });
  }
  return files;
}

/** Load the board directly from disk (companion-side loadBoardFromDisk). */
export function loadBoardFrom(root: string): BoardModel {
  return loadBoard(readBoardFiles(root));
}

const READY = "ready";

/** Index a model's cards (standalone + epic) by id. */
function cardsById(model: BoardModel): Map<string, Card> {
  const all = [...model.cards, ...model.epics.flatMap((e) => e.cards)];
  return new Map(all.map((c) => [c.id, c]));
}

/**
 * Cards that newly entered the `ready` column between two board loads: `ready`
 * now and not `ready` before (a brand-new ready card counts). With no previous
 * model (first load), every ready card is "entering". This is the companion's
 * dispatch trigger — the actual run is wired later (c0097).
 */
export function cardsEnteringReady(
  prev: BoardModel | null,
  next: BoardModel,
): Card[] {
  const before = prev ? cardsById(prev) : new Map<string, Card>();
  const entered: Card[] = [];
  for (const card of cardsById(next).values()) {
    if (card.status !== READY) continue;
    if (before.get(card.id)?.status !== READY) entered.push(card);
  }
  return entered;
}

// --- state file -----------------------------------------------------------------

/** The companion's published state (c0093): the desktop app reads this file. */
export interface CompanionState {
  /** Overall runner status. c0093 only ever publishes `idle`; runs come with
   *  the dispatch flow (c0097). */
  status: "idle" | "running" | "waiting";
  /** Card ids currently sitting in `ready` (detected, awaiting dispatch). */
  ready: string[];
  /** Card ids with a parked, unanswered `## Open question` (c0096) — the app
   *  shows a "needs input" badge for these. */
  waiting: string[];
  /** Active runs — empty until the dispatch flow lands (c0097). */
  runs: RunState[];
  /** ISO timestamp of the last update. */
  updated: string;
}

export interface RunState {
  cardId: string;
  phase: "running" | "waiting-for-input" | "done" | "error";
}

export function initialState(now: string): CompanionState {
  return { status: "idle", ready: [], waiting: [], runs: [], updated: now };
}

/** Absolute path of the companion state file (`<root>/.companion/state.json`). */
export function companionStatePath(root: string): string {
  return join(root, ".companion", "state.json");
}

/** The companion's private state dir (`<root>/.companion/`), gitignored. */
export function companionDir(root: string): string {
  return join(root, ".companion");
}

/** Write a JSON value into `.companion/` atomically (temp + rename). */
export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

/** Read a JSON file, or `fallback` when it is missing or unparseable. */
export function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Write the state file atomically (temp + rename), creating `.companion/`. */
export function writeStateFile(root: string, state: CompanionState): void {
  writeJsonAtomic(companionStatePath(root), state);
}
