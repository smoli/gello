---
id: c0151
title: Add the ability to add reference doc
status: in-progress
created: 2026-08-06
updated: 2026-08-07
status-changed: 2026-08-07T07:24:27
epic: e03
---

## What

Attach a **reference document** to a card — a spec, a design note, a PDF
someone sent — so it lives with the card and is one click away in the detail.

- **Copied in, not linked** (human's call): the file is copied under
  `.gello/assets/<card-id>/`, reusing the image-attach path (`writeAsset`), and
  committed — so it travels with the board and is self-contained. Any file type,
  not only images.
- **Added by drop or picker**, like image paste, but any type — and instead of
  inserting an inline image it appends to a **`## References`** section of the
  card body (a relative link, the original filename as the label).
- **Shown in the card detail**: the References section lists each doc with an
  open/view control. A markdown/text reference can render inline; other types
  (PDF, etc.) open externally.

**The agent gets it for free** (human's insight): because the doc is a real
committed repo file and its path is named on the card, a companion agent — which
works from the repo root and reads the card — can open the reference itself when
relevant. No dedicated agent-context wiring here; the context pack (c0134) may
later *auto*-include references, but the basic capability falls out of "copy
into the repo + name the path on the card". This resolves the audience
question: a human-reference feature that is agent-usable by construction.

**Reuse, not new infrastructure**: the asset store, `writeAsset`, and the
card-detail attach flow already exist for images; this generalises them to any
file and routes the result into `## References` rather than an inline image.

## Acceptance criteria

- [ ] A file of any type can be attached to a card by drop or file picker
- [ ] The file is copied under `.gello/assets/<card-id>/` and committed
      (self-contained, travels with the board)
- [ ] The attachment is recorded in a `## References` section of the card body,
      as a relative link labelled with the original filename
- [ ] The card detail lists references with an open/view control; a
      markdown/text reference can render inline, other types open externally
- [ ] The reference link is resolvable both by the app (rendered/opened) and by
      an agent working from the repo root, so the companion can read the file by
      path
- [ ] Moving the card between folders rewrites its reference links, exactly as
      existing asset links are rewritten
- [ ] Two files of the same name attached to one card are disambiguated (no
      silent overwrite)
- [ ] Removing a reference removes its `## References` entry (asset-file cleanup
      follows the same policy as images — see Open)

## Discussion

- **Copy-in, not link** (human's call): self-contained and travels with the
  board, reusing the asset path. And a copied file *is* a repo path, which is
  what makes the agent story work. Rejected: link-to-repo-file / URL (a path can
  rot, a URL isn't offline) — revisitable later as an addition.
- **Agent-usable by construction** (human's insight): the doc is in the repo and
  its path is on the card, so the agent can Read it itself when working the card
  — no context-pack dependency. c0134 may later auto-include references; not
  required here.
- **A `## References` body section** (human's call): a distinct, listable place
  reusing the attach plumbing, not references buried inline in prose.
- **Open**:
  - **Path base** — the app renders asset links *card-relative* (like images:
    `](../assets/…`), but an agent's cwd is the repo root. The reference entry
    must be resolvable by both; the agent is given the card's path, so a
    card-relative link resolves for it too — confirm this holds rather than
    needing a project-relative form.
  - **PDF/binary in the detail** — open externally via the OS default vs a
    future inline viewer.
  - **Asset cleanup** — deleting a reference should mirror the image policy for
    removing an orphaned asset file.
  - Whether to later also support URL / repo-path references without a copy.

## Log

- 2026-08-06 status → discuss (app)
- 2026-08-07 status → backlog (app)
- 2026-08-07 status → discuss (app)
- 2026-08-07 discussed (human): copy the doc into `.gello/assets/<id>/` (reusing
  the image-attach path, any file type), record it in a `## References` section,
  open/view from the card detail; the agent picks it up itself via the on-card
  repo path, so no context-pack wiring is needed here.
- 2026-08-07 status → ready (app)
- 2026-08-07 status → in-progress (agent)
