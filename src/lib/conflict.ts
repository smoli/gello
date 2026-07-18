// c015: concurrent-edit policy. gello's app state is always derived from disk;
// the only transient state is the active field edit. Two rules keep concurrent
// edits (a human on the board + an agent rewriting files) from losing data:
//
//  1. Full body edit (inline editor): the whole body is being replaced, so an
//     external change can't be merged — the user is prompted (overwrite / keep
//     disk). Handled in the App (handleSaveEdit) + CardDetail conflict banner.
//  2. Surgical field/status/task edits (drag, status change, checkbox): only one
//     frontmatter field or one task line changes, so the edit is *rebased* onto
//     the current disk content before writing. An unrelated external change (an
//     agent rewriting the body while the user drags the card to Done) survives —
//     status comes from the app, body from disk (field-level last-write-wins).
//
// This module is the pure core of rule 2: given the card the app acted on and
// the file's current disk bytes, return the card the surgical write should be
// based on.

import { parseCard, type BoardConfig, type Card } from "./cards";

/**
 * Rebase a card onto the current disk content before a surgical write.
 *
 * - disk unchanged (or unreadable / just deleted → `null`): return the original
 *   card; there is nothing external to merge.
 * - disk changed and still parses: return the disk card, so the surgical edit
 *   applies on top of the external change instead of clobbering it.
 * - disk changed but no longer parses: return the original card — we don't graft
 *   an edit onto broken content; the write restores a valid card (LWW).
 */
export function rebaseCard(
  card: Card,
  diskRaw: string | null,
  config: BoardConfig,
): Card {
  if (diskRaw === null || diskRaw === card.raw) return card;
  const parsed = parseCard(card.path, diskRaw, config);
  return parsed.ok ? parsed.card : card;
}
