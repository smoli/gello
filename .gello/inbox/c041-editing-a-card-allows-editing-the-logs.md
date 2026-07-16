---
id: c041
title: Editing a card allows editing the logs
status: backlog
priority: normal
type: issue
created: 2026-07-16
updated: 2026-07-17
---

## What

Bug (dogfooding): edit mode in card detail puts the entire card body into
the textarea, so the `## Log` section — append-only, dated history — can be
rewritten or deleted like any other text.

Fix: the app editor excludes the `## Log` section. The editor textarea
shows the body *without* Log; Log renders read-only below the editor. On
save, the body is reassembled so the untouched log lines survive
byte-for-byte. This is an app-UX guardrail only — the file stays plain
Markdown, fully editable by agents and external editors. `## Notes`
remains editable (working state, not history).

## Acceptance criteria

- [ ] Entering edit mode on a card with a `## Log` section: the textarea
      contains the body without the Log section; the Log renders read-only
      alongside the editor
- [ ] Saving an edit reassembles body + Log; log lines survive
      byte-for-byte (position and formatting preserved)
- [ ] Cards without a `## Log` section edit exactly as today
- [ ] A draft that introduces its own `## Log` heading is refused with a
      clear message (no way to smuggle in a second/log-overwriting section)
- [ ] Log section boundaries: from the `## Log` heading to the next `##`
      heading or end of file — content after a later heading stays editable
- [ ] Conflict handling (file changed on disk while editing) still works
      with the split editor

## Discussion

- **Exclude-from-editor over warn-on-change**: a warning still allows
  history rewrites; exclusion makes them impossible in the app while
  keeping the change small. (Rejected: editable-with-warning.)
- **No dedicated "add log entry" field for now** — considered (read-only +
  append input) and deferred; can be its own card if wanted.
- **Notes stay editable**: humans correcting or pruning notes is
  legitimate; only Log is history.
- **Guardrail is app-level only**: the Markdown file is the source of
  truth and remains freely editable outside the app — by design.
