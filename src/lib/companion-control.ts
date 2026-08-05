// The app side of the c0119 stop channel: build `.companion/control.json`.
//
// The app is the sole writer of this file, the companion the sole reader (see
// companion/control.ts). The shape here must match its `parseStopRequests`.
// A short capped history is kept — not because the companion needs it (it acts
// on each id once and baselines the rest), but so two stops in quick succession
// are not lost if the second write lands before the companion reads the first.

interface StopRequest {
  id: string;
  cardId: string;
}

/** How many requests to retain. Stops are rare and the companion baselines the
 *  file, so this only guards against losing a burst; it need not be large. */
export const STOP_REQUEST_CAP = 50;

/** The current requests, tolerant of a missing or half-written file. */
function readCurrent(raw: string): StopRequest[] {
  try {
    const data = JSON.parse(raw) as unknown;
    if (typeof data !== "object" || data === null) return [];
    const requests = (data as { requests?: unknown }).requests;
    if (!Array.isArray(requests)) return [];
    return requests.filter(
      (r): r is StopRequest =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as StopRequest).id === "string" &&
        typeof (r as StopRequest).cardId === "string",
    );
  } catch {
    return [];
  }
}

/** The next control-file content: the current requests plus a new stop for
 *  `cardId` under a fresh `id`, capped to the most recent `STOP_REQUEST_CAP`. */
export function appendStopRequest(currentRaw: string, id: string, cardId: string): string {
  const requests = [...readCurrent(currentRaw), { id, cardId }].slice(-STOP_REQUEST_CAP);
  return `${JSON.stringify({ requests }, null, 2)}\n`;
}
