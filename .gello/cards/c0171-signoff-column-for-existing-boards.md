---
id: c0171
title: Existing boards do not get the signoff column
status: inbox
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T23:59:30
---

## What

[[c0164]] added `signoff` to the default lineup — `DEFAULT_BOARD_CONFIG` (the
no-board.yaml fallback) and the scaffold a fresh board is written from. A board
that already has a `board.yaml` keeps its own `columns:` list, so it has no
`signoff` column, and a card the review agent moves there lands in the
needs-attention lane (unknown status).

`planMigration` only runs for legacy boards (`isLegacyBoard`), so its
`addInboxColumn` trick has no hook here. Needs a decision: a board.yaml upgrade
on open, an offer in the app, or leave it to the user to edit the file.
