---
id: c0077
title: Epic board UI — filter, labels, "No epic"
status: ready
priority: normal
milestone: m06
depends: [c0076]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T06:09:13
---

## What

Reflect the epic model in the board UI.

- The milestone filter becomes the **epic filter**; card labels read "epic".
- Standalone (`.gello/cards/`) cards render normally in their status columns
  with no epic label.
- The epic filter gains a **"No epic"** option that isolates standalone
  cards.

## Acceptance criteria

- [ ] Toolbar filter is labelled/behaves as an epic filter; card fronts show
      the epic (or nothing for standalones)
- [ ] Standalone cards appear in the status columns like any card
- [ ] "No epic" filter option shows only cards with no epic
- [ ] Epic filter composes with the type filter, tag surfaces (c0058), and
      search, as the milestone filter did

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
