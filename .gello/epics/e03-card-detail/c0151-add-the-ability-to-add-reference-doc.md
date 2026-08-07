---
id: c0151
title: Add the ability to add reference doc
status: review
created: 2026-08-06
updated: 2026-08-07
status-changed: 2026-08-07T07:39:16
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

- [x] A file of any type can be attached to a card by drop or file picker
- [x] The file is copied under `.gello/assets/<card-id>/` and committed
      (self-contained, travels with the board)
- [x] The attachment is recorded in a `## References` section of the card body,
      as a relative link labelled with the original filename
- [x] The card detail lists references with an open/view control; a
      markdown/text reference can render inline, other types open externally
- [x] The reference link is resolvable both by the app (rendered/opened) and by
      an agent working from the repo root, so the companion can read the file by
      path
- [x] Moving the card between folders rewrites its reference links, exactly as
      existing asset links are rewritten
- [x] Two files of the same name attached to one card are disambiguated (no
      silent overwrite)
- [x] Removing a reference removes its `## References` entry (asset-file cleanup
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

## Notes

- **Where it lives**: `src/lib/references.ts` (pure section edits: parse, add,
  remove, strip, and the kind of a target), `src/components/CardReferences.tsx`
  (the panel), wired from `CardDetail` through four props — `onSaveFile`,
  `onChangeBody`, `onOpenReference`, `loadReferenceText`. The panel owns the
  section, so `## References` is cut from the rendered body and shown once, with
  its controls. Without the handlers the section renders as plain markdown.
- **Reuses the image store**: `writeAsset` takes any bytes and already dedupes
  the filename, so two files of one name land as `spec.pdf` and `spec-2.pdf`
  while both keep the original name as their label. Only the naming is new —
  `suggestedFileAssetName` keeps the file's own extension instead of deriving
  one from a mime type.
- **Open questions from the discussion, resolved**:
  - *Path base*: card-relative holds. An agent is given the card's path and
    resolves the link against the card's folder, the same walk `resolveFromCard`
    does — covered by a test over every card folder shape (`cards/`, an epic,
    and both `archive/` variants).
  - *PDF/binary*: OS default, via a new `open_asset` Rust command. It resolves
    the board-relative path under the board root and refuses anything that
    climbs out, so the webview can only open files the board holds. Going
    through our own command avoids widening the opener plugin's JS scope to
    `**` (its path scope is static, and a board root is not).
  - *Asset cleanup*: same policy as images — removing the entry leaves the file;
    `assets/<card-id>/` is removed when the card is deleted.
  - *URL / repo-path references without a copy*: not added, as discussed.
- **Committed for free**: the auto-commit stages `.gello` with `add -A -- .`,
  which covers binaries under `assets/`.
- Not exercised in the running app (the Rust command is compile- and
  unit-tested; the panel is covered by component tests).

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
- 2026-08-07 implemented: `## References` section module, the card-detail panel
  (open externally / render inline / remove), the `open_asset` Rust command, and
  the App wiring. concept.md § Attachments documents the format.
- 2026-08-07 status → review (agent)
