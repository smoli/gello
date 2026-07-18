---
id: c020
title: Tiny gello CLI for agent board queries
status: inbox
tags: [agent-dx]
created: 2026-07-16
updated: 2026-07-16
---

## What

A minimal CLI reusing src/lib/board.ts: `gello ls <status>`, `gello next`
(highest-priority ready card with deps done), `gello move <id> <status>`.
For agents, structured queries beat grep once boards get big; also gives
validation on writes without needing the app running.

Origin: discussion on card discoverability by status (2026-07-16) — grep
recipes in CLAUDE.md cover it for now; this is the upgrade path if that
ever burns too many tokens.

## Log

- 2026-07-16 captured to inbox
