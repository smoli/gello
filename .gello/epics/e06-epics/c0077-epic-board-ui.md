---
id: c0077
title: Epic board UI — filter, labels, "No epic"
status: done
epic: e06
depends: [c0076]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T07:24:18
---

## What

Reflect the epic model in the board UI.

- The milestone filter becomes the **epic filter**; card labels read "epic".
- Standalone (`.gello/cards/`) cards render normally in their status columns
  with no epic label.
- The epic filter gains a **"No epic"** option that isolates standalone
  cards.

## Acceptance criteria

- [x] Toolbar filter is labelled/behaves as an epic filter; card fronts show
      the epic (or nothing for standalones)
- [x] Standalone cards appear in the status columns like any card
- [x] "No epic" filter option shows only cards with no epic
- [x] Epic filter composes with the type filter, tag surfaces (c0058), and
      search, as the milestone filter did

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): toolbar epic filter (All epics / <epics> /
  No epic, shown when standalone cards exist); standalone (.gello/cards/)
  cards render in status columns with no epic label; card fronts show epic
  title, "inbox", or nothing. Detail selector label → Epic. Tests added
  (standalone render + No-epic isolation); full suite green.
- 2026-07-18 status → done (app)
