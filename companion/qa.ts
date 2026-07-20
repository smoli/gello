// gello-companion card-based Q&A (c0096, reframed by c0102).
//
// The agent parks a question by calling the `add_question` tool, which writes a
// `gelloquestion` fenced block and sets `awaiting: input` (shared core —
// src/lib/gello-question.ts, so the format lives in exactly one place). The
// human answers in the app, which un-fences the block in place and clears the
// marker (c0101).
//
// The protocol is carried by the `awaiting` marker, which is durable on disk —
// so a companion that was down while the human answered still sees it:
//
//   awaiting: input     → parked, waiting on the human (fence present)
//   awaiting: answered  → the human answered; resume, then clear the marker
//   (absent)            → nothing pending
//
// The companion only reads here; the writes are the `add_question` tool
// (question in), the app (answer out), and clearing the marker on resume.

import type { BoardModel } from "../src/lib/board.ts";
import type { Card } from "../src/lib/cards.ts";
import { parseGelloQuestion } from "../src/lib/gello-question.ts";

/** True while the card carries an unanswered question block. */
export function hasOpenQuestion(body: string): boolean {
  return parseGelloQuestion(body) !== null;
}

function allCards(model: BoardModel): Card[] {
  return [...model.cards, ...model.epics.flatMap((e) => e.cards)];
}

/** Cards parked on an unanswered question — drives the app's "needs input"
 *  badge (c0100) and the companion's `waiting` state. */
export function cardsAwaitingInput(model: BoardModel): Card[] {
  return allCards(model).filter((c) => c.awaiting === "input");
}

/**
 * Cards the human has answered and that are waiting to be resumed. Marker-based
 * rather than a model diff, so a cold start sees them too; the runner clears the
 * marker when it resumes, which is what stops it re-firing.
 */
export function cardsAnswered(model: BoardModel): Card[] {
  return allCards(model).filter((c) => c.awaiting === "answered");
}
