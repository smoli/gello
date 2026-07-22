---
id: c0116
title: New Idea open full editor
status: in-progress
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T08:09:21
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

- [x] Focusing the Details/Goal textarea expands the capture panel into a
      larger centred editor
- [x] Text already typed into the title and body survives the expansion
- [x] The panel does not collapse when the textarea loses focus; it stays
      expanded until the capture closes
- [x] Nothing is written to disk until Add — cancelling still leaves no file
- [x] Escape with an empty body closes the capture immediately, as today
- [x] Escape with a non-empty body asks for confirmation before discarding
- [x] All three modes get it: new idea, new issue (⌘I / report-issue), new epic
      (Goal field)
- [x] Pasting an image into the draft still works while expanded (the i0013 /
      i0022 reserved-id path is unaffected)
- [x] The textarea keeps its current Enter-inserts-a-newline behaviour

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

## Notes

- All of it is `CaptureForm.tsx` plus its styles, as the discussion predicted:
  two pieces of state (`expanded`, `confirmingDiscard`), a class swap on the
  panel, and the confirm row in place of Add/Cancel. No new component, nothing
  touched in `App.tsx`, so the three modes and the report-issue overlay get it
  from the shared form.
- Expanded is a class, not a different render tree — the same input and
  textarea nodes stay mounted, so the typed text and the focus stay put and
  the i0013 paste path is untouched. `rows` goes 3 → 16 so the field grows
  even before CSS.
- The report-issue overlay (c040) already centres the panel, so the expanded
  rule's centring transform is reset there; only the width changes.
- Escape while the confirm prompt is up dismisses the prompt instead of
  confirming it, so a reflex double-tap cannot blow through the guard. Only
  Escape is guarded — clicking Cancel is a deliberate aim at a button, and
  routing it through the prompt was not asked for.
- Still open from the discussion: whether centred-overlay is the right look
  versus growing in the corner. It is one CSS rule
  (`.quick-capture-expanded`), so it is cheap to change after seeing it live.

## Log

- 2026-07-22 status → discuss (app)
- 2026-07-22 dragged to `ready` by accident; the companion dispatched an agent
  which parked a question before being stopped. Marker and question cleared,
  card returned to `discuss` — no code was written for it.
- 2026-07-22 discussed (human): grow the capture panel in place (never create a
  card from a focus event); all three capture modes, which is cheap because
  `CaptureForm` is already shared; Escape confirms before discarding a
  non-empty body.
- 2026-07-22 status → backlog (app)
- 2026-07-22 status → ready (app)
- 2026-07-22 status → backlog (app)
- 2026-07-22 status → ready (app)
- 2026-07-22 status → backlog (app)
- 2026-07-22 status → ready (app)
- 2026-07-22 status → in-progress (agent)
