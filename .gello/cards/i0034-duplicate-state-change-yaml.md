---
id: i0034
title: Duplicate state change YAML
status: in-progress
type: issue
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T07:17:38
---

In another project I’ve got a duplicatestate change entry

## Investigation (agent)

Reproduced the failure shape. A card with two `status-changed:` lines fails to
parse ("YAML error: Map keys must be unique") and lands in the **needs-attention
lane** — it can't be loaded or fixed in the app, only by hand-editing the file.

- The app never *creates* the duplicate from a valid card: every write goes
  through `setFrontmatterRawValue`, which replaces the existing line
  (verified LF + CRLF, with/without an existing stamp — count stays 1).
- So the second line comes from **outside the app**: most likely an agent
  following the CLAUDE.md convention ("set `status-changed` on every status
  change") by *appending* a stamp instead of replacing the existing one.
- Two gaps compound it: (a) the parser rejects the whole card on a duplicate
  key rather than tolerating it, so it can't self-heal; (b) `setFrontmatterRawValue`
  replaces only the first match, so even if it loaded, a stale duplicate would
  persist.

## Proposed fix (needs a call — see chat)

1. Parser: tolerate a duplicate frontmatter key, last value wins (matches
   lenient YAML / most tools), so the card loads instead of going to
   needs-attention.
2. Writer: collapse duplicate `field:` lines to one on the next surgical write
   (self-heal).
3. Convention: make the CLAUDE.md/skill wording explicit that setting
   `status-changed` *replaces* — never appends — to prevent creation.


## Log

- 2026-07-19 status → ready (app)
