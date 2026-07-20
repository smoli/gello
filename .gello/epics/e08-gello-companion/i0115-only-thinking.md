---
id: i0115
title: "Only „Thinking…\""
status: in-progress
type: issue
ref: c0109
epic: e08
created: 2026-07-20
updated: 2026-07-21
status-changed: 2026-07-21T00:09:55
---

It only shows thinking although the agent did:

c0110] → mcp__gello__set_status(in-progress)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/.gello/epics/e08-gello-companion/c0110-start-companion-from-ui.md)
[c0110] → Bash(ls src-tauri/src/; echo "=== git.rs ==="; sed -n '1,60p' src-tauri/src/git.rs 2>/dev/null; echo "=== lib.rs invoke_handl…)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src-tauri/src/lib.rs)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src-tauri/src/lib.rs)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src/components/TitleBar.tsx)
[c0110] → Bash(grep -n "bin\|companion\|gello-companion" package.json; echo "=== git commit tauri command in git.rs ==="; grep -n "pub …)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src/lib/board-io.ts)
[c0110] → Bash(grep -n "projectFolder\|function projectFolder\|dirname\|board.root\|setRunner\|readCompanionState\|runner\b" src/App.ts…)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src/lib/status.ts)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src/App.tsx)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src/App.tsx)
[c0110] → Bash(grep -rn "toast\|notify\|setError\|Notification\|banner\|message(" src/App.tsx src/lib/*.ts | grep -vi "commit message\|…)
[c0110] → Bash(grep -n "error &&\|{error}\|error-banner\|className=\"error\|setError(null)" src/App.tsx | head; echo "=== render of err…)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src/App.tsx)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src/components/TitleBar.test.tsx)
[c0110] → Bash(grep -n "fn detect_skill_dirs\|project_root\|projectRoot" src-tauri/src/lib.rs; echo "=== how git_commit_board is invoke…)
[c0110] → Read(/Users/stephan/WebstormProjects/gello/src-tauri/src/git.rs)
[c0110] → Bash(grep -n "cfg(test)\|mod tests\|use super" src-tauri/src/git.rs | head)
[c0110] → Write(/Users/stephan/WebstormProjects/gello/src-tauri/src/companion.rs)
[c0110] → Edit(/Users/stephan/WebstormProjects/gello/src-tauri/src/lib.rs)
[c0110] → Edit(/Users/stephan/WebstormProjects/gello/src-tauri/src/lib.rs)
[c0110] → Edit(/Users/stephan/WebstormProjects/gello/src-tauri/src/lib.rs)
[c0110] → Bash(cd src-tauri && cargo test companion 2>&1 | tail -25)

## Investigation (agent, 2026-07-21)

Root cause: a **stale companion process** running code that predated c0109, not
a code defect. Evidence:

- The **live** `.companion/state.json` now carries a correct `activity` field
  for the running card, so the companion transport works.
- The app pipeline is wired end-to-end (App → Board → Column → CardFront →
  `cardActivity`), and a reproduction feeding the real `state.json` shape
  through `parseCompanionState` + `cardActivity` yields "Updating status", not
  "Thinking…". So there is no app-side defect either.
- Timing: c0109's transport (`activity` in `state.json`) landed at
  22:56 on 2026-07-20. The companion that worked c0110 (~23:16) was an earlier
  process (the current `gello-companion` PID started 00:09 on 2026-07-21).
  That old process still emitted tool lines to the **terminal** (the c0104
  `renderEvent` path, which predates c0109), but never wrote the new `activity`
  field — so the card fell back to "Thinking…" the whole run.

So: the current build already behaves correctly; the fix for the observed run is
operational (restart the companion after updating). There is no reproducing test
for a code bug, because the code is not the bug.

What I can still add regardless: an **end-to-end regression test** across the
companion→state.json→app seam (each layer is unit-tested today, but not the
boundary), so this multi-stage feature can't silently regress later. Awaiting a
call on disposition — see the question.

## Log

- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 (agent) diagnosed: stale pre-c0109 companion, not a code bug; the
  live state.json + a real-data repro confirm the current build works. Asked
  the human how to dispose the card.
