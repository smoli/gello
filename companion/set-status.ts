// c0105: moving the active card between statuses, Node-side. The write behind
// the `set_status` MCP tool — the companion's second agent-facing surface after
// `add_question` (ask.ts). Same boundary: the write runs in the per-run MCP
// server (scoped to `GELLO_CARD_ID`), not the runner, so the companion process
// still never edits cards.
//
// The bookkeeping mirrors the app's `saveCardFields` (board-actions.ts): stamp
// `status-changed`, drop a stale manual `order`, append a dated Log line — so an
// agent move lands on disk the same shape as a drag-drop move. board-actions
// pulls in Tauri and can't be imported here, so the pieces are reused directly
// from the shared card modules.

import { join } from "node:path";
import type { Card } from "../src/lib/cards.ts";
import { replaceCardBody, updateCardFields, type CardFieldChanges } from "../src/lib/cards.ts";
import { nowIsoDateTime } from "../src/lib/dates.ts";
import { appendLogLine } from "../src/lib/markdown.ts";
import { loadBoardFrom, writeCardAtomic } from "./core.ts";

/**
 * Move card `cardId` to `status` and return the updated card. Throws when the
 * card is unknown or the status is not a board column. A move to the status the
 * card already has is a no-op — no rewrite, no re-stamp, no duplicate Log line.
 */
export function setCardStatus(root: string, cardId: string, status: string): Card {
  const model = loadBoardFrom(root);
  const card = [...model.cards, ...model.epics.flatMap((e) => e.cards)].find(
    (c) => c.id === cardId,
  );
  if (!card) throw new Error(`no such card: ${cardId}`);
  if (status === card.status) return card;

  const now = nowIsoDateTime();
  const today = now.slice(0, 10);
  // c056: stamp when the status was assigned; a manual rank belonged to the
  // column being left, so clear it (updateCardFields validates the status).
  let changes: CardFieldChanges = { status, statusChanged: now };
  if (card.order !== null) changes = { ...changes, order: null };
  let { card: updated, raw } = updateCardFields(card, changes, today, model.config);

  ({ card: updated, raw } = replaceCardBody(
    updated,
    appendLogLine(updated.body, `${today} status → ${status} (agent)`),
    today,
    model.config,
  ));
  writeCardAtomic(join(root, card.path), raw);
  return updated;
}
