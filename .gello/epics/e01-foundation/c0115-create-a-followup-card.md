---
id: c0115
title: Create a followup card
status: done
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T08:08:39
epic: e01
---

## What

A **Follow up** action on a card in `review` or `done` that creates a new
**task** carrying `ref:` to the parent and landing straight in **`ready`** — so
with the companion running, an agent picks it up almost immediately. That is
the "follow-up prompt in a chat" feel: read the finished work, type one line,
work resumes.

**Mostly a generalization, not new machinery.** The existing *Report issue*
flow already does all of this — `createIssueFor` sets `ref: source.id`,
inherits the parent's `epic`, files the new card in the parent's folder, and
reserves an id so a pasted image lands in the right asset folder; `CardDetail`
already renders a clickable back-link to `ref`. It is only hardcoded to
`type: "issue"`. Follow-up is the same path with the card type (and id
allocator — `c` instead of `i`) parameterised.

**Two affordances, distinct intents:**

- **Report issue** — available on any card. Something is broken. Creates an
  issue in `backlog` (unchanged).
- **Follow up** — only on `review`/`done`. More work is needed on finished
  work. Creates a task in `ready`.

**The parent shows both, separately.** `openIssuesFor` currently filters
`type === "issue"`, so a follow-up task would be invisible from its parent. It
needs widening to any open card referencing the parent, then splitting into
**Open issues** and **Follow-ups** — keeping "unresolved problems" distinct
from "planned extra work".

**One consequence worth designing for:** landing in `ready` makes this the only
place in gello where a single UI click causes real agent spend (measured at
roughly $8–9 per card in the c0104 runs). The affordance should make that
legible rather than surprising.

## Acceptance criteria

- [x] A **Follow up** action appears on a card only when its status is `review`
      or `done`; **Report issue** stays available on any card
- [x] Follow up creates a **task** (`c` id) with `ref:` set to the parent and
      the parent's `epic`, filed in the parent's folder
- [x] The new follow-up's status is `ready`
- [x] With a companion running, a new follow-up is dispatched without any
      further action, once the WIP limit and the existing `ready` queue allow
- [x] A follow-up is created without an `order`, so it queues behind cards
      already ordered in `ready` rather than preempting them
- [x] The parent's detail lists **Open issues** and **Follow-ups** as separate
      sections, each showing only cards that are not `done`
- [x] A follow-up's detail shows the existing clickable back-link to its parent
- [x] Report issue is unchanged — still an `issue`, still `backlog`
- [x] Card creation stays one shared path parameterised by type; no duplicated
      creation logic
- [x] The UI makes clear that a follow-up goes straight to `ready` (i.e. that a
      running companion will start on it)

## Discussion

- **Two buttons, Follow up gated to review/done** (human's call): the intents
  read differently — a bug can surface any time, whereas a follow-up is by
  definition about work already finished. Rejected: merging both into one "New
  related card" with a type picker, which would add a click to the
  report-issue flow already in daily use.
- **Lands in `ready`** (human's call): the immediacy *is* the feature. Accepted
  tradeoff: one click can start real agent work, so the affordance must say so.
- **Both sections on the parent** (human's call): merging them into "related
  cards" would blur the open-issues problem signal; issues-only would let
  follow-ups get lost.
- **Reuse over reinvention**: the whole flow is `createIssueFor` +
  `openIssuesFor` with their hardcoded `issue` assumptions lifted. No new
  provenance concept — `ref` (c024) already means exactly this.
- **No body seeding**: the `ref` field and its back-link already state the
  parentage, so pre-filling "Follow-up to cNNNN" in the body would duplicate it.
- **Queue position: no jumping** (human's call). `planDispatch` orders `ready`
  by `order ?? Infinity`, so a follow-up created without an `order` sorts
  **last** — it waits behind whatever is already queued. That is deliberate: a
  ready column you ordered on purpose should not be preempted by a
  just-typed follow-up. It is also the zero-implementation default, so nothing
  special is needed. In practice the immediacy survives: while reviewing
  finished work the ready column is usually short or empty, so the follow-up
  starts right away anyway. Rejected: giving follow-ups the lowest `order` to
  push them to the front of the queue.
- **Open**: whether a follow-up inherits the parent's **tags** (report-issue
  does not today; same-area work argues yes); whether creating a follow-up
  should touch the parent's status (probably not — they are independent).

## Notes

- **Creation is one path.** `createIssueFor` became `createRefCardFor(root,
  model, source, input, today, kind)` with a `REF_CARD_KINDS` table holding the
  only per-kind differences: id namespace, `type`, landing status. `issue` →
  `nextIssueId` / `type: issue` / `backlog`; `followup` → `nextCardId` / no
  `type` line (task is the default) / `ready`. `createIssueFor` and
  `createFollowUpFor` are thin wrappers, so existing callers are untouched.
- **No `order` is written**, so `planDispatch` (which sorts `ready` by
  `order ?? Infinity`) puts a follow-up last. Criteria 4 and 5 needed no
  production code — the companion tests are characterisation tests that pin the
  behaviour the card depends on.
- **Backlinks split** via a new `openFollowUpsFor` alongside `openIssuesFor`:
  same non-done ref filter, partitioned on `type === "issue"`. Two sections in
  `CardDetail`, kept visually separate.
- **Report issue was ungated.** It was gated to review/done since c024; the
  card calls for it on any card, so the c024 gating test was rewritten
  deliberately (as its own change, not weakened to pass).
- **Ref back-link label is type-aware**: "found in:" for an issue, "follow-up
  to:" for a task. The shared link markup was already there; only the lead-in
  differs, since "found in" reads wrong on planned work.
- **The `ready` landing is stated in the draft form** ("Lands in ready — a
  running companion will start on it.") plus a button tooltip, so the one click
  that can start real agent spend is not a surprise.
- **Both open questions resolved as "no"**, matching the criteria and the
  reuse-over-reinvention line: a follow-up does **not** inherit the parent's
  tags (report-issue does not either — one shared path, no special-casing), and
  creating one does **not** touch the parent's status. Both are cheap to revisit
  if the tag-less follow-ups turn out to be annoying in practice.

## Log

- 2026-07-22 status → discuss (app)
- 2026-07-22 discussed (human): a Follow up action on review/done cards
  creating a `ref`-linked task in `ready` (companion picks it up); Report issue
  unchanged and always available; the parent lists Open issues and Follow-ups
  as separate sections. Implementation is `createIssueFor`/`openIssuesFor`
  generalised beyond `type: issue`.
- 2026-07-22 queue position settled (human): follow-ups take the default
  position and sort last in `ready` — an ordered ready column is not preempted.
- 2026-07-22 status → ready (app)
- 2026-07-22 status → in-progress (agent)
- 2026-07-22 implemented (agent): createRefCardFor + createFollowUpFor,
  openFollowUpsFor, Follow up action on review/done, report-issue ungated,
  separate Follow-ups section, ready-landing note on the draft form. 973 tests
  green.
- 2026-07-22 status → review (agent)
- 2026-07-22 status → done (app)
