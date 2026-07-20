---
id: i0113
title: tag display should be the same app wide
status: done
type: issue
ref: i0110
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T22:39:33
---

I prefer the toolbar design for tags.

## What

Tag chips were drawn two different ways. The board toolbar filter (i0110) uses
a pale tinted fill with the tag colour as the border and contrast-picked text.
Card fronts and the tag manager used a raw full-colour fill instead. Make every
tag surface use the toolbar's resting look.

## Acceptance criteria

- [x] Card-front tag chips use the same resting look as an unselected toolbar
  filter chip: tinted fill, tag-colour border, contrast-picked text.
- [x] Tag manager row chips use the same resting look.
- [x] A selected toolbar filter chip keeps its full-colour fill (unchanged).
- [x] One shared helper produces the chip style, so the surfaces cannot drift.

## Notes

- Added `tagChipStyle(colour)` to `lib/tags.ts` returning
  `{ backgroundColor, borderColor, color }` — the resting look, factoring out
  the `tintColor(colour, 0.82)` + `readableTextColor` combo the toolbar had
  inline. Unit-tested in `tags.test.ts`.
- Wired it into the card front and the tag manager row (both were raw
  full-colour fills) and into the toolbar's unselected branch. The selected
  filter chip stays full-colour inline.
- The `.tag-chip` CSS already had a `1px solid transparent` border slot, so the
  border colour is set inline on every surface now; no CSS change needed.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 unified tag chips on the toolbar resting look via a shared
  `tagChipStyle` helper (card fronts + tag manager); tests green (agent)
- 2026-07-20 status → review (agent)
- 2026-07-20 status → done (app)
