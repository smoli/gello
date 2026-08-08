// The AFK flag (c0162): the app→companion switch that turns AFK mode on.
//
// AFK mode ([[c0161]]) lets the companion drain the ready queue unattended — a
// parked question frees its WIP slot (c0163), a `review` card gets an AI review
// (c0167). It is a momentary "I'm leaving now" switch, so it is neither
// committed board content nor a `companion.yaml` setting: it is a per-machine
// file next to the other app→companion traffic in `.gello/.companion/`.
//
//     .gello/.companion/afk.json     {"afk": true}
//
// The **app is the sole writer**, the companion the sole reader — the same
// split as `control.json` (see control.ts), so there is no two-writer race.
// Unlike control.json this is level state, not a request log: the companion
// reads the current value, it does not act on entries once.
//
// Absent file, unparseable content, missing field, non-boolean value: AFK is
// **off**. The safe default is the unattended behaviours staying off, so a
// half-written file can never leave the companion running unattended.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { companionDir } from "./core.ts";

/** Absolute path of the AFK flag file (`<root>/.companion/afk.json`). */
export function afkPath(root: string): string {
  return join(companionDir(root), "afk.json");
}

/** The flag file's content for a given state — the contract the app writes to. */
export function afkFileContent(afk: boolean): string {
  return `${JSON.stringify({ afk }, null, 2)}\n`;
}

/** Read the flag out of the file's raw text. Anything unrecognised is `false`. */
export function parseAfk(raw: string): boolean {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  if (typeof data !== "object" || data === null) return false;
  return (data as Record<string, unknown>).afk === true;
}

/** The current AFK state on disk for a board root; `false` when no flag file. */
export function readAfk(root: string): boolean {
  try {
    return parseAfk(readFileSync(afkPath(root), "utf8"));
  } catch {
    return false; // absent → off
  }
}

/**
 * Re-read the flag and hand the value to `apply` only when it differs from
 * `current`; returns the value now on disk. The companion calls this at startup
 * and on every `afk.json` watcher event, so a toggle takes effect without a
 * restart and a watcher burst does not re-announce the same state.
 */
export function syncAfk(
  root: string,
  current: boolean,
  apply: (afk: boolean) => void,
): boolean {
  const next = readAfk(root);
  if (next !== current) apply(next);
  return next;
}
