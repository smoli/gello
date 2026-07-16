---
id: c039
title: Rename bug to issue
status: review
priority: normal
created: 2026-07-16
updated: 2026-07-16
milestone: m02
---

## Notes

- Full rename of the type value: default types are now `[task, issue]`;
  UI labels ("+ New issue", "Report issue", "New issue for cXXX", "Open
  issues against this card"), code identifiers (createIssueFor,
  openIssuesFor), CSS classes (type-issue), and the capture shortcut
  (**⌘B → ⌘I**) all follow.
- All existing `type: bug` cards on this board migrated to `type: issue`
  (9 files — including one that raced back into the inbox mid-migration
  and was caught by the dogfood test).
- Breaking note for other boards (none exist yet): `type: bug` without a
  `types: [..., bug]` key in board.yaml is now invalid; adding the key
  restores it — the open-set design absorbing the rename.

## Log

- 2026-07-16 captured via quick capture (Stephan)
- 2026-07-17 renamed across code, tests, docs, and board files, status → review
