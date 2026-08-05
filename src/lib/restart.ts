// Restarting a stopped card, as the card front sees it (c0141).
//
// A run that dies abnormally (quota, connection, crash) leaves the card in
// `in-progress` with no live run, and dispatch never re-picks it. The card
// offers a manual restart — but only for a card the companion owns a session
// for, never one a human moved to `in-progress` and is hand-editing.

import { isCompanionLive, type CompanionState } from "./companion";

/**
 * Whether `cardId` is a stopped card that may be restarted: the companion is
 * live and owns a session for it (it published the id in `owned`), the card is
 * `in-progress`, and no run is live for it in the state file. A parked card is
 * a live `waiting-for-input` run, so it is not stopped.
 *
 * `cardStatus` is the board fact (this module reads the companion state, not the
 * board); the caller supplies it.
 */
export function isStoppedCard(
  state: CompanionState | null,
  cardId: string,
  cardStatus: string,
  now: number,
): boolean {
  if (!isCompanionLive(state, now)) return false;
  if (cardStatus !== "in-progress") return false;
  if (!state!.owned.includes(cardId)) return false;
  return !state!.runs.some((run) => run.cardId === cardId);
}
