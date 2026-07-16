---
id: c025
title: Editing Card title
status: review
priority: normal
created: 2026-07-16
updated: 2026-07-16
---

In Edit mode make the card title editable as well

## Acceptance criteria

- [x] Edit mode shows the title as an input, prefilled
- [x] Save persists title + body in a single atomic write
- [x] Empty title falls back to the original (no blank titles)
- [x] Escape cancels title and body edits together
- [x] Conflict detection (c010) covers title edits too

## Notes

- `saveCardEdit` (board-actions): title change as surgical frontmatter edit
  composed with the body replacement BEFORE the single write — never two
  writes for one Save. Title quoting via the existing formatScalar path.
- CardDetail: h1 swaps to an input during edit; shared editorKeyDown
  (⌘S saves, Escape cancels) for title input and body textarea; blank
  title drafts fall back to the original title.
- `onSaveBody` prop renamed `onSaveEdit({title, body}, force)`; the c010
  compare-at-save conflict flow wraps the whole edit unchanged.
- Note: the card file keeps its filename (c025-editing-card-title.md) even
  if the title changes — IDs, not slugs, are the stable reference; slug is
  cosmetic. Rename-on-title-change deliberately not done (would break links
  and churn git history).
- 7 new/updated tests. Suite: 153.

## Log

- 2026-07-16 captured via quick capture (Stephan)
- 2026-07-16 flagged ready from inbox, picked up (agent), status → in-progress
- 2026-07-16 7 tests (red → green), all gates clean, status → review
