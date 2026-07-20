---
id: c0075
title: Swimlanes by tag
status: discuss
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T16:17:17
---

Spun out of [[c0058]] (tags refinement): grouping the board into horizontal
lanes is a larger board-layout change than tag chips/filter/management, so
it lives on its own.

## What

Optionally split the board into horizontal **swimlanes** — each lane a value
of a chosen grouping axis, showing that value's cards across the status
columns. A control selects the axis: **None** (today's single grid), **Tag**,
or **Epic**. This broadens the card from tag-only to a general group-by, which
also satisfies concept.md's "swimlanes … by epic" (§UI) with the same lane
layer; the epic axis is nearly free since epic membership is already
first-class on the board.

- **Lanes** = the distinct axis values present in the currently visible
  (filtered) set, plus a **leftover lane** for cards missing that field:
  "Untagged" (tag axis) or "No epic" (epic axis). No card is hidden merely by
  turning lanes on.
- **A card appears in every matching lane.** On the tag axis a card tagged
  `ui core` shows in both the ui and core lanes (epic is single-valued, so no
  duplication there).
- **Lanes group the *filtered* set.** The tag / epic / type / search filters
  run first; lanes group whatever is visible. So grouping by tag with a tag
  filter active shows exactly the selected tags as lanes — the tag selection
  both narrows the cards and picks the lanes.
- **A drop changes status only.** Dragging a card lands it in a lane×column
  cell, but only the *column* (status) is written — never the lane. Dragging
  across lanes does **not** retag or re-assign the epic (v1).
- Reuses the tag surfaces from [[c0058]] and the same `tags:` field; the epic
  axis reuses existing epic membership.

## Acceptance criteria

- [ ] A group-by control offers None / Tag / Epic; None is the current single
      grid
- [ ] On Tag, each tag present in the filtered set is a lane; on Epic, each
      epic present is a lane
- [ ] A card with multiple tags renders in each of its tag lanes
- [ ] Cards missing the field land in a leftover lane ("Untagged" / "No epic"),
      so turning lanes on hides no card
- [ ] Lanes group the already-filtered set — active tag/epic/type/search
      filters still apply, and the lanes are the values left visible
- [ ] Dragging a card between columns updates only its status; dragging between
      lanes does not change its tags or epic
- [ ] Each lane×column cell is a drop target and shows its cards in the column's
      sort order
- [ ] Switching the axis back to None restores the exact current single-grid
      board

## Discussion

- **General group-by, not tag-only** (human's call): one lane layer with a
  selectable axis (None/Tag/Epic) reconciles the card with concept.md's
  epic-swimlanes line and reuses one rendering path. Rejected: tag-only (leaves
  concept.md's epic swimlanes unbuilt); epic-first-then-tag (defers, but the
  lane layer is the shared work either way).
- **Card in every matching lane** (human's call): truthful to multi-valued
  tags. Rejected: a single "primary" (first-tag) lane — simpler and
  duplication-free, but a card's home would hinge on tag order and its other
  tags wouldn't show as lanes. The cost accepted: a tag-lane drag must write
  status to the one card, and every instance reflects it on reload.
- **Lanes over the filtered set** (human's call): filters first, grouping
  second — predictable, and the tag selection naturally doubles as the lane
  chooser. Rejected: lanes ignoring filters; grouping disabling its own filter.
- **Leftover lane, never hide** (human's call, refined): the "chosen subset"
  is expressed through the filter selection; the leftover lane is the
  field-missing bucket (Untagged / No epic), so no card silently vanishes.
  Rejected: hiding untagged/no-epic cards when lanes are on.
- **Drops are status-only**: cross-lane drag as retag/re-epic is ambiguous
  under the every-matching-lane model (which tag would it set?), so v1 writes
  only the column. A future card could add explicit drag-to-retag.
- **Open**: whether choosing which tags are lanes should be a *separate*
  selector from the hide-filter (show ui/core as lanes while docs cards still
  appear in a leftover lane) — currently they are the same selection; lane
  header affordances (collapse a lane, per-lane card count); performance with
  many lanes × columns on a large board.

## Log

- 2026-07-18 spun out of c0058 during the tags-refinement discussion
- 2026-07-18 status → discuss (app)
- 2026-07-20 discussed (human): broadened to a general group-by axis
  (None/Tag/Epic, satisfying concept.md's epic swimlanes); a card shows in
  every matching tag lane; lanes group the filtered set; a leftover
  Untagged/No-epic lane so nothing hides; drops change status only, not lane.
