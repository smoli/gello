// c0102: parking a question, Node-side. The one write behind both agent-facing
// surfaces — the `add_question` MCP tool (Claude) and the `gello ask` CLI (pi,
// which has no MCP). Neither formats anything itself: the fence and the
// `awaiting` marker come from the shared core (src/lib/gello-question.ts), so
// the format cannot drift between hosts the way a prompt convention did.

import { join } from "node:path";
import type { Card } from "../src/lib/cards.ts";
import { todayIsoDate } from "../src/lib/dates.ts";
import { withQuestionAdded } from "../src/lib/gello-question.ts";
import { loadBoardFrom, writeCardAtomic } from "./core.ts";

/**
 * Park `markdown` as an open question on card `cardId` and return that card.
 * Throws when the card is unknown, the markdown is empty, or the card already
 * carries an unanswered question.
 */
export function askQuestion(root: string, cardId: string, markdown: string): Card {
  if (markdown.trim() === "") throw new Error("question markdown is empty");

  const model = loadBoardFrom(root);
  const card = [...model.cards, ...model.epics.flatMap((e) => e.cards)].find(
    (c) => c.id === cardId,
  );
  if (!card) throw new Error(`no such card: ${cardId}`);

  const result = withQuestionAdded(card, markdown, todayIsoDate(), model.config);
  if (result === null) {
    throw new Error(`card ${cardId} already has an open question`);
  }
  writeCardAtomic(join(root, card.path), result.raw);
  return result.card;
}
