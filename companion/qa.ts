// gello-companion card-based Q&A parsing (c0096). The agent parks a turn in a
// card's `## Open question` section and exits; the human answers in place; the
// companion parses to detect when the turn is fully answered and resumes.
// The *agent* writes the card (question, archiving to `## History`, the
// `awaiting` marker); the companion only reads (this file).
//
// Format of `## Open question` (the current turn only):
//
//   ## Open question
//
//   ### <question text>
//   - [ ] option A          ← choice: answered when any box is [x]
//   - [ ] option B
//
//   ### <question text>
//   > answer here           ← open: answered when the blockquote has text
//
// Resolved turns move to a `## History` section below (agent-side, on resume).

import type { BoardModel } from "../src/lib/board.ts";
import type { Card } from "../src/lib/cards.ts";

const OPEN_HEADING = /^##[ \t]+Open question[ \t]*$/im;

export interface QuestionState {
  /** The `### ` question text. */
  text: string;
  /** True when the human has supplied an answer (a checked box or blockquote
   *  text). */
  answered: boolean;
}

export interface OpenTurn {
  /** Whether the card has a `## Open question` section at all. */
  present: boolean;
  /** The `### ` questions within it, in order. */
  questions: QuestionState[];
}

/** The lines of the `## Open question` section (between its heading and the
 *  next `## ` heading or EOF), or null when there is no such section. */
function openSection(body: string): string[] | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => OPEN_HEADING.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##[ \t]/.test(l)); // next ## heading
  return end === -1 ? rest : rest.slice(0, end);
}

/** A `### ` question block is answered when it has a checked box or a
 *  non-empty blockquote. */
function blockAnswered(blockLines: string[]): boolean {
  const checked = blockLines.some((l) => /^[ \t]*- \[[xX]\]/.test(l));
  const quoteText = blockLines.some((l) => /^[ \t]*>[ \t]*\S/.test(l));
  return checked || quoteText;
}

export function parseOpenTurn(body: string): OpenTurn {
  const section = openSection(body);
  if (section === null) return { present: false, questions: [] };

  const questions: QuestionState[] = [];
  let current: { text: string; lines: string[] } | null = null;
  const flush = () => {
    if (current) {
      questions.push({ text: current.text, answered: blockAnswered(current.lines) });
    }
  };
  for (const line of section) {
    const heading = /^###[ \t]+(.+?)[ \t]*$/.exec(line);
    if (heading) {
      flush();
      current = { text: heading[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return { present: true, questions };
}

/** A turn is answerable-and-answered: it exists, has at least one question,
 *  and every question is answered. This is the resume trigger. */
export function isOpenTurnAnswered(body: string): boolean {
  const turn = parseOpenTurn(body);
  return turn.present && turn.questions.length > 0 && turn.questions.every((q) => q.answered);
}

function allCards(model: BoardModel): Card[] {
  return [...model.cards, ...model.epics.flatMap((e) => e.cards)];
}

/**
 * Cards whose open turn just transitioned to fully answered — answered now and
 * not answered before (a brand-new answered turn counts). This is what the
 * companion watches to resume a session; the actual spawn is the dispatch
 * flow (c0097).
 */
export function cardsAnswered(prev: BoardModel | null, next: BoardModel): Card[] {
  const before = new Map(
    (prev ? allCards(prev) : []).map((c) => [c.id, isOpenTurnAnswered(c.body)]),
  );
  return allCards(next).filter(
    (c) => isOpenTurnAnswered(c.body) && before.get(c.id) !== true,
  );
}

/** Cards parked on an unanswered open turn — a `## Open question` is present
 *  but not fully answered. Drives the app's "needs input" badge (c0100). */
export function cardsAwaitingInput(model: BoardModel): Card[] {
  return allCards(model).filter(
    (c) => parseOpenTurn(c.body).present && !isOpenTurnAnswered(c.body),
  );
}
