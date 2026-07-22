---
id: c0116
title: New Idea open full editor
status: discuss
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T06:45:18
epic: e02
---

```gelloquestion
Before I build this: "focus the Details textarea → open the full card detail editor" can mean two quite different things, and one of them creates a file from a focus event. Three decisions.

**1. What should focusing Details do?**

- [ ] **A — Escalate.** Create the card right there (title + whatever body is typed), close the capture panel, open that card's full detail view in edit mode with the cursor in the body. The card exists on disk from that moment; backing out means deleting it. (My recommendation — it matches "open the full card detail editor" literally, and reuses `CardDetail`'s existing `startInEdit`.)
- [ ] **B — Grow in place.** The capture panel itself expands to a large centred editor (same fields, much more room). Nothing is written until Add, so Escape still leaves no trace.

**2. Only if A: what if the title is still empty when Details gets focus?** (Tab from an empty title lands there immediately.)

- [ ] Don't escalate yet — keep the small form until a title is typed, then escalate on the next focus
- [ ] Escalate anyway and create the card with a placeholder title ("Untitled")
- [ ] Escalate anyway, but let the full editor hold an untitled draft and only write the file on its first save

**3. Which capture modes get this?**

- [ ] New idea only
- [ ] New idea + New issue (⌘I and report-issue both use the same form)
- [ ] All three, including New epic (its Goal field, opening the epic detail)
```

When Creating a new Idea, the dialog is quite small. Focussing on the detail teaxt area, open the full card detail editor

## Log

- 2026-07-22 status → discuss (app)
- 2026-07-22 status → ready (app)
- 2026-07-22 status → discuss (app)
- 2026-07-22 status → in-progress (agent)
- 2026-07-22 status → discuss (app)
