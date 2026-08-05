// The app side of the c0119/c0141 control channel: build `.companion/control.json`.
//
// The app is the sole writer of this file, the companion the sole reader (see
// companion/control.ts). The shape here must match its `parseControlRequests`:
// each request is an id, a kind (stop or restart), and a card. A short capped
// history is kept — not because the companion needs it (it acts on each id once
// and baselines the rest), but so two commands in quick succession are not lost
// if the second write lands before the companion reads the first.

type ControlKind = "stop" | "restart";

interface ControlRequest {
  id: string;
  kind: ControlKind;
  cardId: string;
}

/** How many requests to retain. Commands are rare and the companion baselines
 *  the file, so this only guards against losing a burst; it need not be large. */
export const CONTROL_REQUEST_CAP = 50;

/** The current requests, tolerant of a missing or half-written file. */
function readCurrent(raw: string): ControlRequest[] {
  try {
    const data = JSON.parse(raw) as unknown;
    if (typeof data !== "object" || data === null) return [];
    const requests = (data as { requests?: unknown }).requests;
    if (!Array.isArray(requests)) return [];
    return requests.filter(
      (r): r is ControlRequest =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as ControlRequest).id === "string" &&
        typeof (r as ControlRequest).cardId === "string",
    );
  } catch {
    return [];
  }
}

/** The next control-file content: the current requests plus a new command for
 *  `cardId` under a fresh `id`, capped to the most recent `CONTROL_REQUEST_CAP`. */
export function appendControlRequest(
  currentRaw: string,
  id: string,
  kind: ControlKind,
  cardId: string,
): string {
  const requests = [...readCurrent(currentRaw), { id, kind, cardId }].slice(-CONTROL_REQUEST_CAP);
  return `${JSON.stringify({ requests }, null, 2)}\n`;
}
