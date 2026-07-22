---
id: c0116
title: New Idea open full editor
status: discuss
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T06:45:18
epic: e02
---

## What

The capture panel is cramped for anything longer than a sentence. Focusing the
**Details** textarea should **expand the capture panel in place** into a large
centred editor — the same fields, much more room — so a real description can be
typed without leaving capture.

**Grow in place, not escalate.** Nothing is written to disk until **Add**;
`CaptureForm` already guarantees that ("nothing exists on disk until submit"),
and this must stay true. A focus event must never create a card.

**All three capture modes** get it — new idea, new issue (⌘I / report-issue),
and new epic. That is cheap rather than expensive here: `CaptureForm.tsx` is
already the one shared form behind all three (i0028 just relabels the second
field **Goal** in epic mode), and because the panel grows in place, no
`CardDetail`/`EpicDetail` is involved at all.

**Escape gets a guard.** The expanded editor can hold paragraphs, so a single
reflex Escape now discards far more than it used to: Escape closes immediately
when the body is empty (today's behaviour), and asks for confirmation when
there is content. The handler already lives in one place
(`CaptureForm.tsx:44`, which deliberately stops Escape falling through to a
card detail behind the panel), so the guard hooks in there.

Once expanded, the panel **stays** expanded until the capture closes — it does
not collapse when the textarea loses focus.

## Acceptance criteria

- [ ] Focusing the Details/Goal textarea expands the capture panel into a
      larger centred editor
- [ ] Text already typed into the title and body survives the expansion
- [ ] The panel does not collapse when the textarea loses focus; it stays
      expanded until the capture closes
- [ ] Nothing is written to disk until Add — cancelling still leaves no file
- [ ] Escape with an empty body closes the capture immediately, as today
- [ ] Escape with a non-empty body asks for confirmation before discarding
- [ ] All three modes get it: new idea, new issue (⌘I / report-issue), new epic
      (Goal field)
- [ ] Pasting an image into the draft still works while expanded (the i0013 /
      i0022 reserved-id path is unaffected)
- [ ] The textarea keeps its current Enter-inserts-a-newline behaviour

## Discussion

- **Grow in place** (human's call): a *focus event* must never create a file.
  Rejected: escalating into the real card's detail view via `CardDetail`'s
  `startInEdit` — it reads more literally as "open the full card detail editor",
  but it would write the card to disk the moment focus lands in the body, so
  backing out would mean deleting a card. Also rejected: an explicit
  "open full editor" button, which adds a step to a flow meant to be fast.
- **All three modes** (human's call), and cheap *because* of the previous
  decision — one shared `CaptureForm`, no detail views, so epics stop being the
  expensive case they would have been under escalation.
- **Escape confirms when there is content** (human's call): the risk scales
  with the editor. Rejected: two-stage collapse-then-close (extra state, and
  Escape stops meaning "cancel"), and leaving Escape unchanged (now discards
  much more).
- **The whole change is essentially one component** — `CaptureForm.tsx` (111
  lines) plus its styles; the three modes and the single Escape handler are
  already unified there.
- **Open**: exactly what "expanded" looks like — the panel growing in situ vs.
  transitioning to a centred overlay — a visual call better made in the running
  app than on this card; whether the expanded state should be remembered as the
  default for subsequent captures.

## Log

- 2026-07-22 status → discuss (app)
- 2026-07-22 dragged to `ready` by accident; the companion dispatched an agent
  which parked a question before being stopped. Marker and question cleared,
  card returned to `discuss` — no code was written for it.
- 2026-07-22 discussed (human): grow the capture panel in place (never create a
  card from a focus event); all three capture modes, which is cheap because
  `CaptureForm` is already shared; Escape confirms before discarding a
  non-empty body.
