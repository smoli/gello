---
id: e04
title: Live sync
status: backlog
---

## Goal

The magic moment: an agent edits card files while the app is open, and the
board updates live. File watching, debounced reconciliation, and a
last-write-wins policy that never loses user keystrokes to a stale overwrite.

## Definition of done

- External edits (status change, new card, deleted card) appear on the board
  without reload.
- Editing a card in-app while the same file changes on disk resolves without
  data loss beyond the documented last-write-wins field semantics.
