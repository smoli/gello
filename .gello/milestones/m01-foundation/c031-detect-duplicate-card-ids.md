---
id: c031
title: Detect duplicate card IDs on the board
status: backlog
priority: normal
tags: [core]
created: 2026-07-16
updated: 2026-07-16
milestone: m01
---

## What

Two cards can end up with the same ID when created concurrently — it
happened for real on 2026-07-16: the app (quick capture) and an agent both
allocated c029 within the same minute, each computing `nextCardId` from
their own view of the board. Nothing detected it: `loadBoard` has no
uniqueness check and the dogfood test passed with both files present.

Proposed: `loadBoard` surfaces duplicate IDs — later occurrences (by path
order) go to the needs-attention lane with a "duplicate id" reason so the
dogfood test fails and the board shows the conflict. Longer term, a single
allocator (the app's MCP server / CLI, see c026 / c020) removes the race
for tool-mediated creation; detection stays as the safety net for direct
file edits.

## Acceptance criteria

- [ ] loadBoard flags all-but-one card per duplicated ID as invalid
      ("duplicate id cXXX, also used by <path>")
- [ ] Dogfood test fails when this repo's board has duplicate IDs
- [ ] Needs-attention lane shows the conflict

## Log

- 2026-07-16 captured after a real c029 collision (app quick capture vs agent)
