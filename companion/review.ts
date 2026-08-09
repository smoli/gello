// The review run's prompt (c0166): what a review agent is told, and how its
// verdict is read back.
//
// Under AFK mode a card entering `review` gets a review run (c0167) in a fresh
// session — a second agent that checks the implementer's work instead of
// trusting the status move.
//
// The checklist itself is the gello-review skill in src/lib/skills.ts (i0174
// moved it there, so the human can invoke it by hand as well). It is embedded
// in the prompt rather than looked up on disk: the companion runs against any
// project, and a run must not depend on whether the human ever installed
// anything into `.claude/skills/`.
//
// The verdict format — a `## Review` section, one `### <stamp> — <pass|fail>`
// entry per round — is in src/lib/review.ts, because the board reads it too
// (c0170 shows each sign-off card's verdict). Re-exported here so c0167 / c0168
// keep reading the verdict off this module.

import type { Card } from "../src/lib/cards.ts";
import { REVIEW_SKILL, skillInstructions } from "../src/lib/skills.ts";

export {
  formatReviewEntry,
  latestReview,
  parseReview,
  type ReviewEntry,
  type ReviewVerdict,
} from "../src/lib/review.ts";

/** The prompt for a review run on `card` (c0167). Self-contained: the skill
 *  rides along, so the run depends on nothing being installed in the project. */
export function buildReviewPrompt(card: Card): string {
  return (
    `Review gello card ${card.id} — "${card.title}" (${card.path}). You are ` +
    `the reviewer of someone else's work on this card, not its implementer. ` +
    `Follow this skill:\n\n${skillInstructions(REVIEW_SKILL)}`
  );
}
