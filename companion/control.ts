// gello-companion control channel (c0119): the app→companion direction.
//
// The desktop app has no IPC to the companion process; they coordinate only
// through `.gello/` files. `state.json` is the companion→app channel; this
// `control.json` is the reverse, carrying stop requests. The **app is the sole
// writer**, the companion the sole reader — so there is no two-writer race. The
// companion tracks which request ids it has already acted on (and baselines the
// ones present at startup), so a stale request never kills a later re-dispatch.

import { join } from "node:path";
import { companionDir } from "./core.ts";

/** One request to stop a run. `id` is unique per request so the companion acts
 *  on each exactly once; `cardId` names the run to stop. */
export interface StopRequest {
  id: string;
  cardId: string;
}

/** Absolute path of the control file (`<root>/.companion/control.json`). */
export function controlPath(root: string): string {
  return join(companionDir(root), "control.json");
}

function asString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Parse the control file into stop requests. Defensive like the app's read of
 * `state.json`: missing, half-written or malformed content yields `[]`, and a
 * single bad entry is dropped rather than failing the whole read.
 */
export function parseStopRequests(raw: string): StopRequest[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof data !== "object" || data === null) return [];
  const requests = (data as Record<string, unknown>).requests;
  if (!Array.isArray(requests)) return [];
  return requests.filter(
    (r): r is StopRequest =>
      typeof r === "object" &&
      r !== null &&
      asString((r as Record<string, unknown>).id) &&
      asString((r as Record<string, unknown>).cardId),
  );
}

/**
 * The requests whose id has not been seen before, recording them as seen. Used
 * two ways: at startup, call it once to *baseline* the file (seed `seen` without
 * acting), so a request written while the companion was down cannot kill a card
 * that has since been re-dispatched; thereafter, each read acts only on genuinely
 * new requests.
 */
export function takeUnseen(requests: StopRequest[], seen: Set<string>): StopRequest[] {
  const fresh: StopRequest[] = [];
  for (const request of requests) {
    if (seen.has(request.id)) continue;
    seen.add(request.id);
    fresh.push(request);
  }
  return fresh;
}
