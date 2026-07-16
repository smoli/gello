// Board mutations: pure planning via cards.ts, persistence via fs.ts.

import {
  replaceCardBody,
  updateCardFields,
  type BoardConfig,
  type Card,
  type CardFieldChanges,
} from "./cards";
import { writeFileAtomic } from "./fs";

export interface MoveResult {
  /** The card with new status/updated — available synchronously for
   *  optimistic UI. */
  card: Card;
  /** Resolves when the file write has landed; rejects on failure so the
   *  caller can roll back. */
  persisted: Promise<void>;
}

/**
 * Persist frontmatter field changes: computes the surgical edit synchronously
 * and starts the atomic write immediately (no debounce). Throws synchronously
 * on changes that would produce an invalid card, before anything is written.
 */
export function saveCardFields(
  root: string,
  card: Card,
  changes: CardFieldChanges,
  config: BoardConfig,
  today: string,
): MoveResult {
  const { card: updated, raw } = updateCardFields(card, changes, today, config);
  const persisted = writeFileAtomic(`${root}/${card.path}`, raw);
  return { card: updated, persisted };
}

/** Move a card to a new status (drag & drop / keyboard move). */
export function moveCard(
  root: string,
  card: Card,
  status: string,
  config: BoardConfig,
  today: string,
): MoveResult {
  return saveCardFields(root, card, { status }, config, today);
}

/** Replace the card body (checkbox toggles, later inline editing). */
export function saveCardBody(
  root: string,
  card: Card,
  newBody: string,
  today: string,
): MoveResult {
  const { card: updated, raw } = replaceCardBody(card, newBody, today);
  const persisted = writeFileAtomic(`${root}/${card.path}`, raw);
  return { card: updated, persisted };
}

/** Today as an ISO date (YYYY-MM-DD) for `updated` bumps. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
