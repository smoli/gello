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
 * configured off, a card that is not queued, a run that has already started, a
 * card `blocked` by an open dependency (c0125), or a card with no clock at all.
 *
 * The clock is `status-changed` when the card has one. A card created straight
 * in the trigger status never changed status and has none, so the companion
 * times it from when it first saw the card (i0124) and publishes that in the
 * state file — i0157, which is what makes such a card count down here too.
 *
 * `blocked` and `slotFree` are passed in rather than derived: this module knows
 * the companion's state, not the board. The caller supplies those board facts.
 */
export function pickupCountdown(
  state: CompanionState | null,
  cardId: string,
  statusChanged: string | null,
  now: number,
  blocked = false,
  slotFree = true,
): number | null {
  if (!state || !isCompanionLive(state, now)) return null;
  if (state.pickupDelay <= 0) return null;
  if (!state.ready.includes(cardId)) return null;
  // c0125: the companion gates on `depends` before the grace period, so a
  // blocked card is never picked up — a countdown would promise a pickup that
  // cannot happen, and it hides the line saying what it is waiting on.
  if (blocked) return null;
  // c0137: with every WIP slot taken the companion cannot dispatch either, so
  // the countdown is just as misleading — the "waiting on a slot" line applies.
  if (!slotFree) return null;
  // already dispatched — the c0109 activity line speaks for it from here
  if (state.runs.some((run) => run.cardId === cardId)) return null;

  let since = statusChanged === null ? NaN : Date.parse(statusChanged);
  if (Number.isNaN(since)) {
    // i0157: no stamp — fall back to the companion's own first-seen clock, the
    // one it actually times the window on. The stamp wins when both exist,
    // matching the companion's order (runner.pickupWait).
    const seen = state.firstSeen?.[cardId];
    since = seen === undefined ? NaN : Date.parse(seen);
    if (Number.isNaN(since)) return null;
  }

  const remaining = state.pickupDelay * 1000 - (now - since);
  // round up, so a part-second never renders as a misleading 0
  return remaining > 0 ? Math.ceil(remaining / 1000) : null;
}

/**
 * c0137: whether a queued ready card is held only by a full WIP — every slot
 * taken, so the companion cannot dispatch it. True drives the "waiting on a
 * slot" line, the counterpart to the countdown for when no slot is free.
 * Independent of the grace period: the slot is the constraint, not the delay.
 * `blocked` takes precedence — a blocked card waits on its dependency, not a
 * slot — and a running card already holds one.
 */
export function waitingForSlot(
  state: CompanionState | null,
  cardId: string,
  now: number,
  blocked: boolean,
  slotFree: boolean,
): boolean {
  if (!state || !isCompanionLive(state, now)) return false;
  if (!state.ready.includes(cardId)) return false;
  if (blocked) return false;
  if (state.runs.some((run) => run.cardId === cardId)) return false;
  return !slotFree;
}
