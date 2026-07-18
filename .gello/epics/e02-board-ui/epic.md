---
id: e02
title: Board UI
status: backlog
---

## Goal

The Kanban view: columns from board.yaml, cards grouped by status, milestone
filtering, drag & drop that persists to frontmatter, and honest handling of
cards the parser can't read.

## Definition of done

- This repo's own board renders and cards can be dragged between columns,
  with the status change visible in the file within 100 ms.
- Malformed cards appear in a "needs attention" lane, never silently hidden.
- WIP limit overruns are visibly flagged.
