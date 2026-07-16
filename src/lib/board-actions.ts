// Board mutations: pure planning via cards.ts, persistence via fs.ts.

import { updateCardFields, type BoardConfig, type Card } from "./cards";
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
 * Move a card to a new status: computes the surgical frontmatter edit
 * synchronously and starts the atomic write immediately (no debounce —
 * the write must land right after the drop). Throws synchronously on an
 * illegal target status, before anything is written.
 */
export function moveCard(
  root: string,
  card: Card,
  status: string,
  config: BoardConfig,
  today: string,
): MoveResult {
  const { card: updated, raw } = updateCardFields(card, { status }, today, config);
  const persisted = writeFileAtomic(`${root}/${card.path}`, raw);
  return { card: updated, persisted };
}

/** Today as an ISO date (YYYY-MM-DD) for `updated` bumps. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
