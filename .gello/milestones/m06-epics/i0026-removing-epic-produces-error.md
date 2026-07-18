---
id: i0026
title: Removing Epic produces error
status: review
type: issue
ref: c0078
epic: m06
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T07:43:36
order: 10
---

It determins the folder before updating, trying to update the file in the cards folder I guess

## What

Bug (dogfooding, ref c0078): reassigning a card to **"No epic"** triages it into
`.gello/cards/` — but that folder doesn't exist yet on a board that has never
had a standalone card, so the atomic write fails and surfaces an error.

Root cause: the Rust `atomic_write` requires the parent directory to already
exist; `cards/` (the standalone home added in c0076) is created on demand.

Fix: `atomic_write` now `create_dir_all`s the parent directory before writing.
Purely a Rust-layer fix — the triage path logic was already correct.

## Acceptance criteria

- [x] Triaging a card to "No epic" writes it into `.gello/cards/`, creating
      the folder if absent, with no error
- [x] Existing writes into existing folders are unaffected

## Log

- 2026-07-18 status → ready (app)
- 2026-07-18 fixed (agent): Rust atomic_write now create_dir_all's the parent
  before writing, so triage-to-standalone into a not-yet-existing cards/ folder
  succeeds. cargo + vitest green. (Needs a Rust rebuild — tauri dev auto-rebuilds.)
- 2026-07-18 ROOT CAUSE (agent): the real data loss. Clearing the epic on a
  card that is ALREADY standalone triages cards/x → cards/x — source path ==
  dest path — and triageCard did write-new *then* delete-old, deleting the file
  it had just written. Guarded: skip the delete when newPath === card.path.
  Reproducing test in board-actions.test.ts. (The earlier create_dir_all fix
  handled the first-time cards/ folder; this handles the second removal.)
