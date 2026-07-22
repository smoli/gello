// The pickup grace period as the card front sees it (c0117).
//
// The companion holds a card in the trigger status for `pickupDelay` seconds
// before dispatching, so an accidental drag can be undone. That window is
// useless if it is invisible, so the card shows a countdown — derived here from
// the published delay plus the card's own `status-changed`, and ticked
// client-side. Nothing extra is polled: both halves are already on hand.

import { isCompanionLive, type CompanionState } from "./companion";

/**
 * Seconds left before the companion picks this card up, or null when there is
 * no countdown to show: no companion attached (or a stale one), the delay
 * configured off, a card that is not queued, a run that has already started, or
 * a card with no usable `status-changed` — which the companion itself treats as
 * eligible immediately, so inventing a window here would be a lie.
 */
export function pickupCountdown(
  state: CompanionState | null,
  cardId: string,
  statusChanged: string | null,
  now: number,
): number | null {
  if (!state || !isCompanionLive(state, now)) return null;
  if (state.pickupDelay <= 0) return null;
  if (!state.ready.includes(cardId)) return null;
  // already dispatched — the c0109 activity line speaks for it from here
  if (state.runs.some((run) => run.cardId === cardId)) return null;

  const since = statusChanged === null ? NaN : Date.parse(statusChanged);
  if (Number.isNaN(since)) return null;

  const remaining = state.pickupDelay * 1000 - (now - since);
  // round up, so a part-second never renders as a misleading 0
  return remaining > 0 ? Math.ceil(remaining / 1000) : null;
}
