---
id: i0177
title: A resume waiting for a slot still reads as "needs input"
status: inbox
created: 2026-08-09
updated: 2026-08-09
status-changed: 2026-08-09T14:20:00
---

Since i0173 an answered card can wait for a WIP slot before it resumes. The
companion logs `answered, waiting for a slot`, but the run's published phase
stays `waiting-for-input`, so the app shows the "needs input" badge on a card
whose question the human has already answered. It looks like the answer did not
land.

A truthful state needs a new run phase (or a flag on the run) in
`.companion/state.json` and a badge for it in the app.
