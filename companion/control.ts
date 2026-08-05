// gello-companion control channel (c0119 stop, c0141 restart): the
// app→companion direction.
//
// The desktop app has no IPC to the companion process; they coordinate only
// through `.gello/` files. `state.json` is the companion→app channel; this
// `control.json` is the reverse, carrying commands. The **app is the sole
// writer**, the companion the sole reader — so there is no two-writer race. The
// companion tracks which request ids it has already acted on (and baselines the
// ones present at startup), so a stale request never re-fires against a later
// run. Stop and restart share this one channel.

import { join } from "node:path";
import { companionDir } from "./core.ts";

/** What a control request asks for: end a live run, or re-run a stopped card. */
export type ControlKind = "stop" | "restart";

/** One app→companion command. `id` is unique per request so the companion acts
 *  on each exactly once; `cardId` names the card. */
export interface ControlRequest {
  id: string;
  kind: ControlKind;
  cardId: string;
}

/** Absolute path of the control file (`<root>/.companion/control.json`). */
export function controlPath(root: string): string {
  return join(companionDir(root), "control.json");
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Parse the control file into requests. Defensive like the app's read of
 * `state.json`: missing, half-written or malformed content yields `[]`, and a
 * single bad entry is dropped rather than failing the whole read. A missing or
 * unrecognised `kind` defaults to `stop` — c0119 wrote entries with no kind.
 */
export function parseControlRequests(raw: string): ControlRequest[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof data !== "object" || data === null) return [];
  const requests = (data as Record<string, unknown>).requests;
  if (!Array.isArray(requests)) return [];
  const out: ControlRequest[] = [];
  for (const entry of requests) {
    if (typeof entry !== "object" || entry === null) continue;
    const r = entry as Record<string, unknown>;
    if (!isString(r.id) || !isString(r.cardId)) continue;
    out.push({ id: r.id, kind: r.kind === "restart" ? "restart" : "stop", cardId: r.cardId });
  }
  return out;
}

/**
 * The requests whose id has not been seen before, recording them as seen. Used
 * two ways: at startup, call it once to *baseline* the file (seed `seen` without
 * acting), so a request written while the companion was down cannot re-fire
 * against a card that has since moved on; thereafter, each read acts only on
 * genuinely new requests.
 */
export function takeUnseen<T extends { id: string }>(requests: T[], seen: Set<string>): T[] {
  const fresh: T[] = [];
  for (const request of requests) {
    if (seen.has(request.id)) continue;
    seen.add(request.id);
    fresh.push(request);
  }
  return fresh;
}
