---
id: i0022
title: Pasting images not when issued for card
status: done
type: issue
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T23:09:49
epic: e02
---

If I report an issue for a card, the popup does not accept pasting an image

## What

Bug: the report-issue draft (c037 — "report issue" from a review/done card)
silently drops a pasted image. The quick-capture form and card detail both
accept pasted images; the issue draft does not.

Root cause: the issue-draft `CaptureForm` (App.tsx ~737) is the only one of
the three that isn't given an `onSaveImage` prop, so `useImageInsert` has no
save handler and the paste is a no-op. Fixing it is more than passing a
handler, because an issue draft has no file on disk yet (c037) and the new
issue lands in the **source card's folder** (possibly a milestone, two
levels deep) — not always `inbox/` like quick-capture.

## Acceptance criteria

- [x] Reproducing test (fails before fix): pasting an image into the
      report-issue draft persists an asset and inserts a Markdown link
      (previously nothing happened)
- [x] The issue-draft `CaptureForm` receives an `onSaveImage` (`handleIssueImage`)
      that reserves an issue id (i-namespace) once per draft and persists the
      image under it — mirroring quick-capture's `handleCaptureImage` (i0013)
- [x] The inserted link uses the correct depth for where the issue will be
      created: `assetLinkPrefix(issueSource.path)` — test asserts `../../` for
      a milestone-sourced issue
- [x] `submitIssueDraft`/`createIssueFor` use the reserved id (createIssueFor
      gained an optional `id`), so the created issue file and the image's
      asset folder match
- [x] Cancelling/escaping the draft drops the reservation (`handleDiscardIssueDraft`
      on cancel); a persisted-then-cancelled image is a harmless orphan, same
      as quick-capture

## Discussion

- **One form missing the wiring**: quick-capture (`onSaveImage={handleCaptureImage}`)
  and card detail (`onSaveImage={file => handleSaveImage(card, file)}`) both
  pass it; the issue draft doesn't. That's the immediate cause.
- **Reserved-id + link-depth are the real work**: reuse i0013's reservation
  mechanism but for the issue namespace, and compute the link prefix from
  the source card's location (issue is born in the same folder), not a
  hardcoded `../`.
- **Open**: whether to unify the three image-paste paths behind one helper
  now, or just wire the issue draft and leave the refactor — the quick-capture
  path hardcodes `../` (correct only because it's always inbox), so a shared
  helper taking the target path would remove that latent assumption. Chose the
  parallel handler for a tight bug fix; the refactor is left as a separate
  cleanup.

## Notes

- `createIssueFor` gained an optional `input.id`; `submitIssueDraft` passes the
  reserved issue id so the created file matches the pasted image's folder.
- App: `reservedIssue` ref + `handleIssueImage(source, file)` (reserves the
  i-namespace id once, links via `assetLinkPrefix(source.path)`) +
  `handleDiscardIssueDraft`; wired `onSaveImage`/`onCancel` onto the
  issue-draft `CaptureForm`.
- Surfaced + fixed a test-isolation gap: `writeAsset` wasn't reset in App
  test `beforeEach`, so its call count leaked between tests (the new
  ExactlyOnce assertion exposed it). Added the reset.
- Verified via an App-level integration test that renders the whole App and
  drives report-issue → paste (real File + DOM) → submit, asserting the
  reserved-id write, the `../../` link in the textarea, and the created issue
  file. Frontend-only change; `writeAsset` (Rust) is untouched. 427 tests,
  typecheck, lint all green.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 diagnosed (agent): issue-draft CaptureForm missing onSaveImage;
  fix needs reserved issue-id + source-folder link depth + createIssueFor
  using the reserved id
- 2026-07-17 picked up (agent), status → in-progress
- 2026-07-17 fixed TDD (reproducing test → onSaveImage + reserved id +
  assetLinkPrefix + createIssueFor id; fixed a writeAsset test-isolation
  leak); 427 green, gates clean, status → review
- 2026-07-17 status → done (app)
