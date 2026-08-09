---
id: i0174
title: Cannot find the review-skill in skills.ts
status: in-progress
type: issue
ref: c0166
epic: e08
created: 2026-08-09
updated: 2026-08-09
status-changed: 2026-08-09T07:35:30
usage-tokens: 3590
usage-cost: 0.551649
---

The review skill is real, it just isn't in `src/lib/skills.ts`. c0166 put it in `companion/review.ts` as `REVIEW_SKILL`, a string that rides along inside the review run's prompt — deliberately, so a review run works against any project regardless of whether the human ever ran the skill installer. `skills.ts` (the installer, `.claude/skills/gello-*`) never mentions it, which is why looking there finds nothing.

Which fix do you want?

- [ ] **Pointer only** — leave the design as is, add a comment in `src/lib/skills.ts` naming `companion/review.ts` as the home of the review skill (and note it in the companion README). No behaviour change.
- [ ] **Also install it** — add a `gello-review` skill to `ALL_SKILLS` so `/gello-review` exists for reviewing a card by hand, sharing one source of the checklist text with `REVIEW_SKILL` so the two cannot drift. The companion keeps embedding it in the prompt (no new dependency on the installer). Costs a `SKILL_VERSION`-style install into every board.
- [ ] **Move it** — make the installed skill the only home and have the companion read it from `skills.ts`. Undoes c0166's "must not depend on the installer" decision; I'd advise against it.
- [ ] Something else (say what below).

With the skill being in the skills directory, which is atm solely managed by the desktop app, the user can invoke that skill manually as well, which is a win in my opinion. I’d move it

## Log

- 2026-08-09 status → in-progress (agent)
