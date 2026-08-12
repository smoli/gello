// c0148: the single source of truth for a card's live status line — the one the
// card front shows below the title (activity, pickup countdown, waiting-on-a-
// slot / queue line, run-stopped, blocked, startable). Extracted so the card
// detail can show the *same* line and the two can never drift.
//
// Pure: it resolves the highest-priority treatment that applies and its
// read-only text. The renderer (CardStatusLine) turns that into DOM — plain
// text everywhere, plus the interactive Restart button / blocked-dep links on
// the card front, where handlers are passed.

import { cardActivity, activityClassName, activityTreatment } from "./activity";
import { pickupCountdown, waitingForSlot } from "./pickup";
import { isStoppedCard } from "./restart";
import { queueLine } from "./queue-lines";
import type { CompanionState } from "./companion";
import type { Card } from "./cards";
import {
  blockersFor,
  hasFreeWipSlot,
  isStartable,
  nextSlotWaiter,
  openDependencies,
  type BoardModel,
  type Blocker,
} from "./board";

export type CardStatusKind =
  | "activity"
  | "countdown"
  | "waiting-slot"
  | "stopped"
  | "blocked"
  | "startable";

export interface CardStatusLine {
  kind: CardStatusKind;
  /** Read-only text — what the detail shows, and the front's text for every
   *  non-interactive kind. */
  text: string;
  /** The `.card-activity` treatment class. */
  className: string;
  /** A stale companion state file marks the activity line (c0109). */
  stale?: boolean;
  /** The unfinished dependencies, for the front's clickable "waiting on …". */
  blockers?: Blocker[];
}

/**
 * The blocked line for `blockers`, or null when nothing is open. Split out of
 * `cardStatusLine` (c0157) for a surface that has the board but no companion
 * state — the cross-project view — so both phrase the line the same way.
 */
export function blockedStatusLine(blockers: Blocker[]): CardStatusLine | null {
  if (blockers.length === 0) return null;
  const text = blockers.map((b) => (b.missing ? `${b.id} (missing)` : b.id)).join(", ");
  return {
    kind: "blocked",
    text: `waiting on ${text}`,
    className: "card-activity card-activity-blocked",
    blockers,
  };
}

/** The board facts the status line needs beyond the companion state — all
 *  already computed per card by the board (c0123/c0125/c0137/c0139). */
export interface CardStatusFacts {
  /** Any dependency still open, regardless of status (c0125). */
  blocked: boolean;
  /** A WIP slot is free board-wide (c0137). */
  slotFree: boolean;
  /** Id of the card genuinely next when a slot frees (c0143); the rest of the
   *  slot-waiters get a funny queue line. */
  slotWaiterTopId: string | null;
  /** The unfinished dependencies holding this card back (c0123). */
  blockers: Blocker[];
  /** A backlog card whose dependencies have all cleared (c0139). */
  startable: boolean;
}

/**
 * The status line to show for `card`, or null when it has none. The priority —
 * activity, then countdown, then waiting-on-a-slot, then stopped, then blocked,
 * then startable — matches the card front's render order, so the detail mirrors
 * the front exactly.
 */
export function cardStatusLine(
  runner: CompanionState | null,
  card: Card,
  facts: CardStatusFacts,
  now: number,
): CardStatusLine | null {
  const activity = cardActivity(runner, card.id, now);
  if (activity) {
    return {
      kind: "activity",
      text: activity.label,
      className: activityClassName(activityTreatment(activity)),
      stale: activity.stale,
    };
  }

  const countdown = pickupCountdown(
    runner,
    card.id,
    card.statusChanged,
    now,
    facts.blocked,
    facts.slotFree,
  );
  if (countdown !== null) {
    return {
      kind: "countdown",
      text: `picking up in ${countdown}s`,
      className: "card-activity card-activity-pending",
    };
  }

  if (waitingForSlot(runner, card.id, now, facts.blocked, facts.slotFree)) {
    return {
      kind: "waiting-slot",
      text: card.id === facts.slotWaiterTopId ? "waiting on a slot" : queueLine(card.id),
      className: "card-activity card-activity-pending",
    };
  }

  if (isStoppedCard(runner, card.id, card.status, now)) {
    return {
      kind: "stopped",
      text: "run stopped",
      className: "card-activity card-activity-stopped",
    };
  }

  const blocked = blockedStatusLine(facts.blockers);
  if (blocked) return blocked;

  if (facts.startable) {
    return {
      kind: "startable",
      text: "startable",
      className: "card-activity card-activity-startable",
    };
  }

  return null;
}

/** The status facts for `card`, derived from the whole board (the slot facts are
 *  board-wide). Lets a caller with only the model + companion state resolve the
 *  line without recomputing the board's per-card bookkeeping. */
export function cardStatusFacts(
  model: BoardModel,
  card: Card,
  runner: CompanionState | null,
  now: number,
): CardStatusFacts {
  const slotFree = hasFreeWipSlot(model);
  const waiters = [...model.cards, ...model.epics.flatMap((g) => g.cards)].filter((c) =>
    waitingForSlot(runner, c.id, now, openDependencies(model, c).length > 0, slotFree),
  );
  return {
    blocked: openDependencies(model, card).length > 0,
    slotFree,
    slotWaiterTopId: nextSlotWaiter(waiters),
    blockers: blockersFor(model, card),
    startable: isStartable(model, card),
  };
}

/** Resolve a card's status line straight from the model + companion state — the
 *  card detail's entry point (c0148). */
export function resolveCardStatusLine(
  model: BoardModel,
  card: Card,
  runner: CompanionState | null,
  now: number,
): CardStatusLine | null {
  return cardStatusLine(runner, card, cardStatusFacts(model, card, runner, now), now);
}
