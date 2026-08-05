---
id: i0134
title: Two runs can pick up the same card
status: inbox
type: issue
created: 2026-08-06
updated: 2026-08-06
status-changed: 2026-08-06T00:12:00
---

## What

Nothing stops two agent sessions from working one card in one working copy.
It happened on i0131: a session started by hand and a companion run both took
the card and both edited `src-tauri/src/git.rs`, interleaving edits in a file
neither could see the other writing. `cargo test` errors changed shape between
two runs a minute apart, which is how each of them noticed.

`status: in-progress` is the only claim a card carries, and it says nothing about
*who* holds it. The companion's `state.json` tracks its own runs, so it can't
see a hand-started session, and a hand-started session has no reason to look.

It resolved by luck here — one side parked a question and stopped, the other
finished from the merged disk state — but the ordinary outcome is one side's work
silently overwritten.

Worth deciding whether a card should record its holder (a session id in
frontmatter, cleared on exit) and whether picking up a card that already has a
live holder should refuse or ask.
