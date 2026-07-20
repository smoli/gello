---
id: i0034
title: Duplicate state change YAML
status: done
type: issue
created: 2026-07-19
updated: 2026-07-20
status-changed: 2026-07-20T07:36:11
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
- 2026-07-20 status → done (app)

## Resolution (human's call: keep strict + repair action)

- Parsing stays strict — a duplicate-key card still lands in the needs-attention
  lane (a duplicate key is genuinely malformed).
- Added a **"Fix duplicate keys"** button in that lane, shown only when the file
  has collapsible duplicates. It reads the file, collapses each repeated key to
  its **last** value (`collapseDuplicateFrontmatterKeys`), and writes it back;
  the watcher reloads it as a valid card.
- Hardened the convention (creation side): CLAUDE.md and the gello-discuss skill
  now say to *replace* `status-changed`, never append; one line per key. Bumped
  the skill version to v4 so installs update.

## Log

- 2026-07-19 status → ready (app)
- 2026-07-19 fixed (agent): collapseDuplicateFrontmatterKeys (pure, last-wins,
  CRLF-safe) + a needs-attention "Fix duplicate keys" action; convention
  hardened in CLAUDE.md + the shipped discuss skill (v4). 507 tests green.
