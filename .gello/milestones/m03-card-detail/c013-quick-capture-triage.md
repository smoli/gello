---
id: c013
title: Quick capture to inbox + triage to milestone
status: backlog
milestone: m03
priority: high
depends: [c005, c009]
tags: [ui, core]
created: 2026-07-16
updated: 2026-07-16
---

## What

The idea-capture flow: a global shortcut/button opens a minimal input; submit
creates a card in `.gello/inbox/` with the next free ID. Triage: assigning an
inbox card to a milestone moves the file into the milestone folder, updates
the `milestone` field, and rewrites relative asset links.

## Acceptance criteria

- [ ] Title (+ optional body) → inbox card file, in under 5 seconds from focus
- [ ] New card gets next free sequential ID
- [ ] Inbox renders as its own area/column on the board
- [ ] Triage moves the file, sets `milestone`, rewrites asset link prefixes
- [ ] Triaged card's images still resolve (test with a real attachment)

## Notes

## Log

- 2026-07-16 created from concept breakdown
