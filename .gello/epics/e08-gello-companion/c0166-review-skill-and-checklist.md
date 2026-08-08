---
id: c0166
title: Review skill + checklist
status: review
epic: e08
depends: []
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T23:50:12
usage-tokens: 21721
usage-cost: 1.896769
---

## What

The skill the AI review agent follows during AFK ([[c0161]]). It defines what
"reviewed" means for a gello card: verify the acceptance criteria are met,
tests pass, lint/typecheck are green, and the diff is sane against the card's
`## What`. It records a pass/fail verdict on the card (verdict + what was
checked, with reasons on fail) and, on pass, moves the card to `signoff`
([[c0164]]); on fail it leaves review notes for the implementer ([[c0168]]
wires the reject flow). Authored as a bundled skill/prompt the companion passes
to the review run ([[c0167]]).

## Acceptance criteria

- [x] A documented review skill/checklist exists (acceptance criteria, tests,
      lint/typecheck, diff review).
- [x] The skill specifies recording a verdict on the card (pass/fail + what was
      checked; reasons on fail).
- [x] On pass, the skill instructs moving the card to `signoff`.
- [x] On fail, the skill instructs writing review notes for the implementer (no
      move to `signoff`).
- [x] The verdict/notes format is defined (e.g. a `## Review` section) so
      [[c0167]] / [[c0168]] can act on it.

## Notes

- `companion/review.ts` holds all three pieces: `REVIEW_SKILL` (the checklist),
  `buildReviewPrompt` (what [[c0167]] hands the run), and `parseReview` /
  `latestReview` (what [[c0167]] / [[c0168]] read the verdict back with).
- **The skill travels in the prompt, not as an installed skill.** The board
  already has a skill installer (`src/lib/skills.ts` → `.claude/skills/`), but
  the companion runs against any project and a review run must not depend on
  whether the human ever ran the installer. Rejected for that reason.
- **Format**: a `## Review` section, one `### <local ISO datetime> — <pass|fail>`
  entry per round, newest last; the verdict word ends the heading line. Notes
  are the entry body. Parsing is tolerant on the separator and casing, and
  anything unrecognised reads as *no verdict*, never as a pass — a malformed
  entry must not sign a card off (same safe default as [[c0162]]).
- The reviewer changes no code and commits nothing; a fail leaves the card in
  `review` with the notes, and [[c0168]] routes it back to the implementer.
- Check commands are taken from the repo's own docs rather than hard-coded, for
  the same reason the commit clause defers to CLAUDE.md.
- A test parses the format example out of the skill text, so the documented
  shape and the parser cannot drift apart.

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
- 2026-08-08 status → in-progress (agent)
- 2026-08-08 review skill + `## Review` verdict format in `companion/review.ts`,
  documented in the companion README; 18 tests
- 2026-08-08 status → review (agent)
