// The AI review skill (c0166): what "reviewed" means for a gello card, and the
// format the verdict is recorded in.
//
// Under AFK mode a card entering `review` gets a review run (c0167) in a fresh
// session — a second agent that checks the implementer's work instead of
// trusting the status move. This module holds what that agent is told and how
// its verdict is read back:
//
//   REVIEW_SKILL       the checklist the review agent follows
//   buildReviewPrompt  the prompt c0167 hands to the review run
//   parseReview        the verdict entries on a card, for c0167 / c0168
//
// The skill travels in the prompt rather than as an installed agent skill: the
// companion runs against any project, and a run must not depend on whether the
// human ever installed something into `.claude/skills/`.
//
// The card is the only channel between the two agents, so the verdict is
// markdown on the card — a `## Review` section, one `### <stamp> — <pass|fail>`
// entry per round. Anything the format does not describe reads as no verdict,
// never as a pass: a malformed entry must not sign a card off (the same safe
// default as the AFK flag, afk.ts).

import type { Card } from "../src/lib/cards.ts";

export type ReviewVerdict = "pass" | "fail";

export interface ReviewEntry {
  verdict: ReviewVerdict;
  /** The entry's datetime, as written in the heading (empty if it carried none). */
  stamp: string;
  /** What was checked and why it passed or failed, as markdown. */
  notes: string;
}

/** One `## Review` entry in the documented shape. */
export function formatReviewEntry(entry: ReviewEntry): string {
  return `### ${entry.stamp} — ${entry.verdict}\n\n${entry.notes}\n`;
}

/** The checklist the review agent follows. Passed to the run by c0167. */
export const REVIEW_SKILL = `# Reviewing a gello card

The card is in \`review\`: an agent implemented it and claims it is done. Decide
whether that holds and record the decision on the card.

You verify, you do not implement. Do not edit, change or fix the code, do not
tick the card's criteria, and do not commit — a failed card goes back to its
implementer with your notes.

## The checks

1. **Read the card** — \`## What\`, \`## Acceptance criteria\`, \`## Notes\`,
   \`## Log\`. The What is the scope; the criteria are the spec.
2. **Read the diff** — the changes made for this card (\`git log\`, \`git show\`,
   \`git diff\` on the commits naming the card id). It has to match the What: no
   unrelated scope, no leftover debug code, no test weakened, skipped or
   \`.only\`'d to reach green.
3. **Verify every acceptance criterion** against the code, not against its
   checkbox — a ticked box with nothing behind it is an unmet criterion. Where
   the repo works test-first, a criterion no test covers is unmet.
4. **Run the repo's checks** — tests, lint, typecheck. Take the commands from
   the repo itself (CLAUDE.md, README, the package manifest); do not assume
   them. A check you could not run is not a pass; record that you could not run
   it.

## The verdict

It is a fail if any criterion is unmet, any check is red, the diff reaches
beyond the card's What, or a test was weakened to pass. Otherwise a pass.

Record it in a \`## Review\` section on the card (create it above \`## Log\` if
there is none), one entry per round, newest last:

\`\`\`markdown
## Review

### 2026-08-08T21:04:11 — fail

Checked: acceptance criteria, tests, lint, typecheck, diff.

- Criterion "a parked run frees its WIP slot" is unmet: \`planDispatch\` still
  counts a parked run.
- Tests red: 2 failures in \`companion/runner.test.ts\`.
\`\`\`

The heading is \`### <local ISO datetime> — <pass|fail>\`; the verdict word ends
that line and is what the companion reads. Under it, one line naming what you
checked, then the reasons — each concrete enough to act on, naming the
criterion, file or command. On a pass, the reasons are what you verified.

- **Pass** — write the entry, then move the card to \`signoff\`: call the
  \`set_status\` tool with \`signoff\` (without that tool, edit \`status\` and
  \`status-changed\` per the gello convention). A human takes it from there.
- **Fail** — write the entry and stop. Do not move the card to \`signoff\`; the
  notes are for the implementer, who gets the card back to fix it.
`;

/** The prompt for a review run on `card` (c0167). Self-contained: the skill
 *  rides along, so the run depends on nothing being installed in the project. */
export function buildReviewPrompt(card: Card): string {
  return (
    `Review gello card ${card.id} — "${card.title}" (${card.path}). You are ` +
    `the reviewer of someone else's work on this card, not its implementer. ` +
    `Follow this skill:\n\n${REVIEW_SKILL}`
  );
}

/** A level-2 heading line, e.g. `## Review` (but not `### …`). */
const H2_RE = /^##\s+(.*?)\s*$/;
/** An entry heading: `### <stamp> — <verdict>`, the verdict word last. */
const ENTRY_RE = /^###\s+(.*?)(?:\s*[—–-]\s*)?(pass|fail)\s*$/i;

/** Every verdict entry in the card body's `## Review` section, in order. */
export function parseReview(body: string): ReviewEntry[] {
  const entries: ReviewEntry[] = [];
  let inSection = false;
  let stamp = "";
  let verdict: ReviewVerdict | null = null;
  let notes: string[] = [];

  const flush = () => {
    if (verdict) entries.push({ verdict, stamp, notes: notes.join("\n").trim() });
    verdict = null;
    notes = [];
  };

  for (const line of body.split("\n")) {
    const heading = H2_RE.exec(line);
    if (heading) {
      flush();
      inSection = heading[1].toLowerCase() === "review";
      continue;
    }
    if (!inSection) continue;
    const entry = ENTRY_RE.exec(line);
    if (entry) {
      flush();
      stamp = entry[1].trim();
      verdict = entry[2].toLowerCase() as ReviewVerdict;
      continue;
    }
    if (verdict) notes.push(line);
  }
  flush();
  return entries;
}

/** The card's current verdict — the last review round, or `null` if none. */
export function latestReview(body: string): ReviewEntry | null {
  const entries = parseReview(body);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}
