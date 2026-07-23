---
id: c0128
title: Create OS notification when a card has an open question
status: in-progress
created: 2026-07-23
updated: 2026-07-23
status-changed: 2026-07-23T07:24:05
epic: e02
---

## What

When a companion run parks a question (c0096/c0102), the agent halts until you
answer — and if you have walked away, nothing tells you. Fire an **OS
notification** the moment a card parks, so the async Q&A loop does not depend on
you happening to look at the board.

**The trigger is already in hand and already the right one.** The app polls
`CompanionState` every 2s (c0100) and its `waiting: string[]` is the parked-
card list — populated by the companion from `awaiting: input` markers, so it is
*inherently companion-only*. That satisfies "not open questions from
discussions" for free: a discuss-card question never enters `waiting`.

**Edge-triggered, not level.** Notify on the *transition* into `waiting` — an
id present now and not on the previous poll — so a park fires exactly one
banner, never one every 2s while it sits unanswered. On the first observation
after the app loads, the current `waiting` set is taken as the baseline and
does **not** notify, so opening the app never bursts banners for parks that were
already there.

**Always, regardless of focus** (your call): a park fires a banner whether or
not the window is focused. Edge-triggering bounds it to one banner per actual
park, so even the answer→resume→re-park loop stays to one banner per new
question.

**Click focuses the app and opens the card.** The notification carries the card
id; clicking it raises/focuses the gello window and routes straight to that
card's detail (the app already has `onOpenCardId` and window focus via
`getCurrentWindow`), landing you on the question.

**Wiring that does not exist yet:** the Tauri notification plugin is not
installed — this needs `tauri-plugin-notification` (Rust), its JS counterpart,
and a capability entry. Permission is requested the first time a park would
notify; if denied, notifications are simply off and the needs-input badge
(c0100) still carries the signal.

**Scope: the app is the notifier.** Notifications require the gello window open
(backgrounded is fine — that is the main case). A fully-closed app with only a
headless companion running will not notify; surfacing parks without the app is
a separate concern.

## Acceptance criteria

- [x] A card newly entering the companion state's `waiting` set fires one OS
      notification naming the card (id + title)
- [x] A card that stays in `waiting` across polls does not re-notify
- [x] Parks already present in `waiting` when the app loads do not notify
- [x] The notification fires whether or not the window is focused
- [x] Clicking the notification focuses/raises the window and opens that card's
      detail
- [x] A card only in a discussion open-question state (not in `waiting`) never
      notifies
- [x] Notification permission is requested lazily; if denied, no notification
      is attempted and the rest of the app is unaffected
- [x] The transition detection (which ids newly parked) is a pure,
      unit-tested function, separate from the Tauri notification call
- [x] No notification when there is no companion / no state file

## Discussion

- **Always, regardless of focus** (human's call): rejected notifying only when
  unfocused/minimised. Edge-triggering is what keeps "always" from becoming
  noise — one banner per park, not per poll, and not per loop turn.
- **Click focuses + opens the card** (human's call): the notification carries
  the card id and deep-links to the detail, so it is one click from banner to
  the answer box. Rejected: focus-only (an extra hunt on a busy board) and a
  passive banner.
- **`waiting` is the right signal**: it is companion-published and derived from
  `awaiting: input`, so it already excludes discussion questions — no new
  classification is needed to honour the card's exclusion.
- **Baseline on first observation** (my call, flag if wrong): notifying for
  pre-existing parks on every app open would burst banners for old news; the
  badge already shows those. The alternative — notify once on open for anything
  already waiting — is defensible if you want a nudge when reopening the app.
- **App-side, not the companion**: the notifier is the running app, consistent
  with this being an e02 board-UI card. A headless companion notifying on its
  own (so you are told even with the app closed) is a different, larger idea.
- **Open**: whether a notification should also fire on other run outcomes worth
  attention — a run erroring, or all work finishing — or stay strictly to
  parked questions; the notification's exact wording.

## Notes

- The transition detection is `newlyParkedIds(prevWaiting, next)` in
  `companion.ts` — a plain set difference, unit-tested. The baseline lives in
  the same signature: `prevWaiting === null` means "not observed yet" and
  returns nothing, so the first poll after load/project-switch never notifies.
  The App keeps `prevWaiting` between polls, storing `next?.waiting ?? []` — so
  a *gone* companion counts as observed-empty, not a reset to baseline, and a
  companion that starts *after* the app still fires on its first real park.
- Everything Tauri is behind two thin seams that no-op outside a Tauri window,
  like `window.ts`: `notifyPark`/`onNotificationOpen` in `notify.ts` and
  `focusWindow` in `window.ts`. They are not unit-tested (the boundary is not);
  the App *wiring* to them is, by mocking `notify` and driving the poll.
- The `waiting` set is companion-published from `awaiting: input`, so a
  discussion open-question never enters it — the exclusion the card wants comes
  for free, no new classification.
- Plugin wiring added: `tauri-plugin-notification` (Rust, in `lib.rs`), its JS
  counterpart, and `notification:default` in the capability. Permission is
  requested lazily inside `notifyPark`; denied → it returns and the badge
  (c0100) still carries the signal.
- **Honest limitation:** the click→focus→open path is wired
  (`onAction` + the card id in the notification's `extra`, then `focusWindow` +
  open), but a body-click callback is not exercisable headless and its
  delivery depends on the plugin/OS. The banner-per-park path is the tested,
  load-bearing part; the click is best-effort on top. Worth a real-app check.

## Log

- 2026-07-23 status → discuss (app)
- 2026-07-23 discussed (human): OS notification on a companion park, triggered
  by a card newly entering the state file's `waiting` set (edge, not level);
  always fires regardless of focus; clicking focuses the app and opens the
  card. Needs the Tauri notification plugin wired.
- 2026-07-23 status → backlog (app)
- 2026-07-23 status → ready (app)
- 2026-07-23 status → in-progress (agent)
- 2026-07-23 edge-triggered OS notification on a companion park: pure
  newlyParkedIds (8 tests) + notify/focus seams + App wiring (2 tests);
  tauri-plugin-notification wired and building
