// c0143: when more cards sit in `ready` than there are WIP slots, every queued
// card used to show the same "waiting on a slot" line — a wall of identical
// text (c0137). The one card actually next keeps that honest line; every other
// queued card shows a stable, funny queue line picked here.

/** 50 queue-themed lines — deadpan, absurd, and dev/nerdy, mixed. Constant, so
 *  the picker below is deterministic. All SFW. */
export const QUEUE_LINES: readonly string[] = [
  "Reviewing its life choices.",
  "Technically first, spiritually last.",
  "Waiting with quiet dignity.",
  "Practising patience. Involuntarily.",
  "Holding. Please continue to hold.",
  "Contemplating the nature of the queue.",
  "Assured its call is important to us.",
  "Ticket taken, number clutched.",
  "Standing by, as instructed.",
  "Not stuck. Marinating.",
  "Fighting three geese for the slot.",
  "Bribing the scheduler with cookies.",
  "Teaching the card ahead to hurry up.",
  "Building a tiny raft to jump the queue.",
  "Negotiating with the WIP limit. Going poorly.",
  "Stuck behind someone paying in coins.",
  "Waiting for the bouncer's nod.",
  "Doing hot laps in the parking lot.",
  "Rehearsing its entrance.",
  "Told to wait here and not move. So.",
  "Spinning on a mutex.",
  "await slot; // still awaiting.",
  "Blocked on a semaphore that never signals.",
  "Politely deadlocked.",
  "In the run queue, dreaming of CPU.",
  "Yielding the thread. Again.",
  "Backing off, exponentially.",
  "Cache is warm; the slot is not.",
  "SELECT * FROM slots WHERE free — 0 rows.",
  "Parked. No pun intended.",
  "Third in line, first in its heart.",
  "Watching the slot like a hawk.",
  "Warming up in the bullpen.",
  "On deck.",
  "Loitering with intent.",
  "Queued and quietly judging the throughput.",
  "Waiting for its number to be called.",
  "Almost. So very almost.",
  "Buffering…",
  "Doing breathing exercises.",
  "Refreshing the queue in its head.",
  "Next-next-next in line.",
  "Holding the elevator for no one.",
  "Idling with the engine running.",
  "Ready. Willing. Unslotted.",
  "Counting the cards ahead. Twice.",
  "Reading old magazines in the waiting room.",
  "Whistling nonchalantly.",
  "Pretending it's not in a hurry.",
  "Any second now.",
];

/**
 * The queue line for a card, chosen by a hash of its id so it stays put across
 * the 2s polls (no flicker) — the same name-hash `tags.ts` uses for tag
 * colours. No uniqueness: two cards may land on the same line.
 */
export function queueLine(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return QUEUE_LINES[Math.abs(hash) % QUEUE_LINES.length];
}
