---
id: c049
title: Columns should be only as long as needed for the cards in them
status: done
type: issue
ref: c047
milestone: m02
created: 2026-07-16
updated: 2026-07-16
---

## Log

- 2026-07-16 status → ready (app)
- 2026-07-16 status → done (app)

## Notes

- CSS-only: `.board-columns` aligns items flex-start (columns size to
  content), columns keep `max-height: 100%` with internal scroll for long
  ones. Empty columns shrink to just their header. Per CLAUDE.md, pure
  layout/styling carries no test — verify visually over the background.

## Log

- 2026-07-16 status → ready (app)
- 2026-07-17 fixed (CSS), status → review
