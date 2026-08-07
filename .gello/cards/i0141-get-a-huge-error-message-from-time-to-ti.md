---
id: i0141
title: Get a huge error message from time to time
status: review
type: issue
created: 2026-08-07
updated: 2026-08-07
status-changed: 2026-08-07T23:09:35
usage-tokens: 11752
usage-cost: 1.919207
---

![image](../assets/i0141/image.png)

## What

The error banner rendered the whole message inline. An auto-commit whose
pre-commit hook failed put a full `cargo test` log into it, so the banner
covered the entire window and there was no way to dismiss it.

## Acceptance criteria

- [x] The banner shows one summary line regardless of message length.
- [x] A message with more behind it offers Show details; expanding puts the
      full text in a scroll box capped at 30vh.
- [x] The banner has a dismiss button that clears the error.
- [x] A new error arriving while details are open starts collapsed.

## Notes

- No criteria were on the card (screenshot only), so the shape above is my
  reading of it: bound the banner, keep the detail reachable, make it
  dismissible. The message text itself is unchanged — a failing hook's output
  is worth keeping, just not at full height.
- Extracted the banner into `src/components/BoardError.tsx` (+ CSS) and used it
  at both render sites in `App.tsx`; `.board-error` moved out of `App.css`.
- The full suite is flaky in `src/App.test.tsx` (`emitChange is not a
  function`) on a clean tree too — filed as i0142, not caused by this change.

## Log

- 2026-08-07 status → ready (app)
- 2026-08-07 status → in-progress (agent)
- 2026-08-07 status → review (agent)
