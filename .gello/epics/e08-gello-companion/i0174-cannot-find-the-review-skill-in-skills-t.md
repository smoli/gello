---
id: i0174
title: Cannot find the review-skill in skills.ts
status: done
type: issue
ref: c0166
epic: e08
created: 2026-08-09
updated: 2026-08-09
status-changed: 2026-08-09T07:55:06
usage-tokens: 27955
usage-cost: 3.085145
---

## What

The review skill ([[c0166]]) was a string in `companion/review.ts`, not one of
the gello-managed skills in `src/lib/skills.ts` — so looking for it where the
other skills are found nothing, and the human could not invoke it by hand.
Move it: `gello-review` becomes an installed skill like `gello-discuss`, and
the companion embeds that skill's text in its review-run prompt.

## Acceptance criteria

- [x] `gello-review` is a `SkillTemplate` in `src/lib/skills.ts` and part of
      `ALL_SKILLS`, so the app installs it.
- [x] The skill text has exactly one home; `companion/review.ts` holds no copy.
- [x] The review-run prompt still carries the whole skill, so a run needs
      nothing installed in the target project.
- [x] The skill works when invoked by hand with no card named (it finds the
      `review` cards itself).
- [x] The docs point at the new home.

## Question

Which fix do you want?

- [ ] **Pointer only** — leave the design as is, add a comment in `src/lib/skills.ts` naming `companion/review.ts` as the home of the review skill (and note it in the companion README). No behaviour change.
- [ ] **Also install it** — add a `gello-review` skill to `ALL_SKILLS` so `/gello-review` exists for reviewing a card by hand, sharing one source of the checklist text with `REVIEW_SKILL` so the two cannot drift. The companion keeps embedding it in the prompt (no new dependency on the installer). Costs a `SKILL_VERSION`-style install into every board.
- [x] **Move it** — make the installed skill the only home and have the companion read it from `skills.ts`. Undoes c0166's "must not depend on the installer" decision; I'd advise against it.
- [ ] Something else (say what below).

With the skill being in the skills directory, which is atm solely managed by the desktop app, the user can invoke that skill manually as well, which is a win in my opinion. I’d move it

## Notes

- The "must not depend on the installer" half of [[c0166]] survives: the
  companion imports the template and embeds `skillInstructions(REVIEW_SKILL)`
  in the prompt. It never reads `.claude/skills/` — only the *authoring* home
  moved, not the delivery.
- `skillInstructions(skill)` strips the YAML frontmatter from a skill body.
  `name` / `description` are there for skill discovery and are noise in a
  prompt.
- The skill gains a "Pick the card" step (the grep for `status: review`), which
  a hand invocation needs and the companion's prompt makes redundant by naming
  the card.
- No `SKILL_VERSION` bump: a new skill has no file on disk, so every install
  target already sees it as an install.
- `.claude/skills/gello-review/SKILL.md` is committed too, generated with
  `managedSkillFile` so the app recognises it as current.

## Log

- 2026-08-09 status → in-progress (agent)
- 2026-08-09 asked which fix; human chose "move it" — the installer is the home
- 2026-08-09 `gello-review` in `src/lib/skills.ts` + `skillInstructions`;
  `companion/review.ts` derives the prompt from it; 11 tests
- 2026-08-09 status → review (agent)
- 2026-08-09 status → done (app)
