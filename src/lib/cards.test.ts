import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOARD_CONFIG,
  collapseDuplicateFrontmatterKeys,
  newCardRaw,
  newEpicRaw,
  parseBoardConfig,
  parseCard,
  parseEpic,
  replaceCardBody,
  updateCardFields,
} from "./cards";

const FULL_CARD = `---
id: c003
title: Kanban view with drag & drop
status: ready
milestone: m02
priority: high
depends: [c001]
tags: [ui, core]
created: 2026-07-16
updated: 2026-07-16
---

## What

Render the board.

- [ ] Columns render
`;

const MINIMAL_CARD = `---
id: c042
title: Just an idea
status: backlog
---

A quick inbox note.
`;

describe("parseCard", () => {
  it("parses a full card into a typed Card", () => {
    const result = parseCard("milestones/m02/c003-kanban.md", FULL_CARD);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const card = result.card;
    expect(card.id).toBe("c003");
    expect(card.title).toBe("Kanban view with drag & drop");
    expect(card.status).toBe("ready");
    expect(card.epic).toBe("m02");
    expect(card.depends).toEqual(["c001"]);
    expect(card.tags).toEqual(["ui", "core"]);
    expect(card.created).toBe("2026-07-16");
    expect(card.updated).toBe("2026-07-16");
    expect(card.body).toContain("## What");
    expect(card.body).toContain("- [ ] Columns render");
    expect(card.path).toBe("milestones/m02/c003-kanban.md");
    expect(card.raw).toBe(FULL_CARD);
  });

  it("applies defaults for a minimal card (inbox style)", () => {
    const result = parseCard("inbox/c042-just-an-idea.md", MINIMAL_CARD);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.epic).toBeNull();
    expect(result.card.depends).toEqual([]);
    expect(result.card.tags).toEqual([]);
    expect(result.card.created).toBeNull();
    expect(result.card.updated).toBeNull();
  });

  it("coerces a scalar depends/tags value into a one-element array", () => {
    const raw = `---\nid: c001\ntitle: T\nstatus: backlog\ndepends: c000\ntags: ui\n---\nbody\n`;
    const result = parseCard("x.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.depends).toEqual(["c000"]);
    expect(result.card.tags).toEqual(["ui"]);
  });

  it("rejects malformed YAML with a typed invalid result, not a throw", () => {
    const raw = `---\nid: c001\n  title: [unclosed\nstatus:\n---\nbody\n`;
    const result = parseCard("bad.md", raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalid.path).toBe("bad.md");
    expect(result.invalid.reason).toMatch(/yaml/i);
    expect(result.invalid.raw).toBe(raw);
  });

  it("rejects a status that is not a board column", () => {
    const raw = MINIMAL_CARD.replace("status: backlog", "status: doing");
    const result = parseCard("x.md", raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalid.reason).toMatch(/status/i);
    expect(result.invalid.reason).toContain("doing");
  });

  it("accepts a custom status when the board config allows it", () => {
    const raw = MINIMAL_CARD.replace("status: backlog", "status: doing");
    const config = { columns: ["todo", "doing"], wipLimits: {}, types: ["task"], background: null };
    const result = parseCard("x.md", raw, config);

    expect(result.ok).toBe(true);
  });

  it("rejects cards missing required fields (id, title, status)", () => {
    for (const line of ["id: c042", "title: Just an idea", "status: backlog"]) {
      const raw = MINIMAL_CARD.replace(`${line}\n`, "");
      const result = parseCard("x.md", raw);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.invalid.reason).toContain(line.split(":")[0]);
    }
  });

  it("rejects a file with no frontmatter block", () => {
    const result = parseCard("x.md", "# just markdown\n");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalid.reason).toMatch(/frontmatter/i);
  });

  it("i0025: ignores a leftover priority line — card still parses", () => {
    const raw = MINIMAL_CARD.replace(
      "status: backlog",
      "status: backlog\npriority: urgent",
    );
    const result = parseCard("x.md", raw);

    // priority was removed; the line is just an unknown, tolerated field
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.raw).toContain("priority: urgent"); // preserved byte-for-byte
  });
});

describe("updateCardFields", () => {
  it("changes status with a byte-exact one-line edit plus updated bump", () => {
    const parsed = parseCard("x.md", FULL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { raw } = updateCardFields(
      parsed.card,
      { status: "in-progress" },
      "2026-07-17",
    );

    expect(raw).toBe(
      FULL_CARD.replace("status: ready", "status: in-progress").replace(
        "updated: 2026-07-16",
        "updated: 2026-07-17",
      ),
    );
  });

  it("returns a card consistent with the new raw", () => {
    const parsed = parseCard("x.md", FULL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { card } = updateCardFields(
      parsed.card,
      { status: "done" },
      "2026-07-17",
    );

    expect(card.status).toBe("done");
    expect(card.updated).toBe("2026-07-17");
    expect(card.body).toBe(parsed.card.body);
  });

  it("preserves comments and unknown frontmatter fields byte-for-byte", () => {
    const raw = `---
id: c009
title: T
status: backlog
# reviewer: do not lose this comment
x-custom: kept
updated: 2026-07-16
---
Body
`;
    const parsed = parseCard("x.md", raw);
    if (!parsed.ok) throw new Error("fixture must parse");

    const updated = updateCardFields(parsed.card, { status: "ready" }, "2026-07-17");

    expect(updated.raw).toContain("# reviewer: do not lose this comment");
    expect(updated.raw).toContain("x-custom: kept");
    expect(updated.raw).toBe(
      raw
        .replace("status: backlog", "status: ready")
        .replace("updated: 2026-07-16", "updated: 2026-07-17"),
    );
  });

  it("appends fields that are not present yet (milestone on an inbox card, updated)", () => {
    const parsed = parseCard("inbox/c042.md", MINIMAL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { card, raw } = updateCardFields(
      parsed.card,
      { epic: "m03" },
      "2026-07-17",
    );

    expect(card.epic).toBe("m03");
    expect(card.updated).toBe("2026-07-17");
    // appended inside the frontmatter block, body untouched
    expect(raw).toContain("epic: m03\n");
    expect(raw).toContain("updated: 2026-07-17\n");
    expect(raw.endsWith("A quick inbox note.\n")).toBe(true);
    const reparsed = parseCard("inbox/c042.md", raw);
    expect(reparsed.ok).toBe(true);
  });

  it("updates tags as a flow-style list", () => {
    const parsed = parseCard("x.md", FULL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { card, raw } = updateCardFields(
      parsed.card,
      { tags: ["ui", "agent-dx"] },
      "2026-07-17",
    );

    expect(card.tags).toEqual(["ui", "agent-dx"]);
    expect(raw).toContain("tags: [ui, agent-dx]\n");
    expect(raw).toBe(
      FULL_CARD.replace("tags: [ui, core]", "tags: [ui, agent-dx]").replace(
        "updated: 2026-07-16",
        "updated: 2026-07-17",
      ),
    );
  });

  it("clears tags with an empty list", () => {
    const parsed = parseCard("x.md", FULL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { card, raw } = updateCardFields(parsed.card, { tags: [] }, "2026-07-17");

    expect(card.tags).toEqual([]);
    expect(raw).toContain("tags: []\n");
  });

  it("serializes numeric order as an unquoted number, including zero and negatives (i0007)", () => {
    const parsed = parseCard("x.md", FULL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    for (const value of [0, -10, 5, 12.5]) {
      const { card, raw } = updateCardFields(parsed.card, { order: value }, "2026-07-17");
      expect(card.order).toBe(value);
      expect(raw).toContain(`order: ${value}\n`);
      // and it re-parses as a number, not a quoted string
      const reparsed = parseCard("x.md", raw);
      expect(reparsed.ok).toBe(true);
    }
  });

  it("rejects a field update whose result would not parse", () => {
    const parsed = parseCard("x.md", FULL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    expect(() =>
      updateCardFields(parsed.card, { status: "not-a-column" }, "2026-07-17"),
    ).toThrow(/status/i);
  });
});

describe("replaceCardBody", () => {
  it("swaps the body and bumps updated, frontmatter otherwise byte-identical", () => {
    const parsed = parseCard("x.md", FULL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { card, raw } = replaceCardBody(
      parsed.card,
      "\n## What\n\nNew body.\n",
      "2026-07-18",
    );

    expect(card.body).toBe("\n## What\n\nNew body.\n");
    expect(raw).toBe(
      FULL_CARD.replace(/\n\n## What[\s\S]*$/, "\n\n## What\n\nNew body.\n").replace(
        "updated: 2026-07-16",
        "updated: 2026-07-18",
      ),
    );
  });
});

describe("card types and refs (c024)", () => {
  it("defaults type to task and ref to null", () => {
    const result = parseCard("x.md", MINIMAL_CARD);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.type).toBe("task");
    expect(result.card.ref).toBeNull();
  });

  it("parses an explicit type and ref", () => {
    const raw = MINIMAL_CARD.replace(
      "status: backlog",
      "status: backlog\ntype: issue\nref: c007",
    );
    const result = parseCard("x.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.type).toBe("issue");
    expect(result.card.ref).toBe("c007");
  });

  it("rejects a type outside the configured set (symmetric with status)", () => {
    const raw = MINIMAL_CARD.replace(
      "status: backlog",
      "status: backlog\ntype: chore",
    );
    const result = parseCard("x.md", raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalid.reason).toMatch(/type/i);
    expect(result.invalid.reason).toContain("chore");
  });

  it("accepts custom types from board.yaml", () => {
    const raw = MINIMAL_CARD.replace(
      "status: backlog",
      "status: backlog\ntype: chore",
    );
    const config = {
      columns: ["backlog"],
      wipLimits: {},
      types: ["task", "issue", "chore"],
      background: null,
    };
    const result = parseCard("x.md", raw, config);

    expect(result.ok).toBe(true);
  });

  it("board.yaml types key parses, defaulting to [task, issue]", () => {
    expect(parseBoardConfig("types: [task, issue, chore]\n").config.types).toEqual([
      "task",
      "issue",
      "chore",
    ]);
    expect(parseBoardConfig("columns: [a]\n").config.types).toEqual(["task", "issue"]);
    expect(DEFAULT_BOARD_CONFIG.types).toEqual(["task", "issue"]);
  });

  it("newCardRaw can create a typed, referenced, milestoned card", () => {
    const raw = newCardRaw("c040", "Broken thing", "It broke.", "2026-07-16", {
      type: "issue",
      ref: "c007",
      epic: "m02",
    });
    const result = parseCard("milestones/m02-x/c040-broken-thing.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.type).toBe("issue");
    expect(result.card.ref).toBe("c007");
    expect(result.card.epic).toBe("m02");
    expect(result.card.status).toBe("backlog");
  });
});

// A card authored on macOS/Linux (LF) is turned into CRLF by git's
// core.autocrlf=true on Windows checkout. The bytes on disk are the source of
// truth and must not be rewritten, so parsing/editing has to be line-ending
// agnostic.
describe("line-ending tolerance (CRLF / BOM)", () => {
  const crlf = (s: string) => s.replace(/\n/g, "\r\n");

  it("parses a CRLF card the same as its LF twin", () => {
    const result = parseCard("x.md", crlf(FULL_CARD));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.id).toBe("c003");
    expect(result.card.title).toBe("Kanban view with drag & drop");
    expect(result.card.status).toBe("ready");
    expect(result.card.depends).toEqual(["c001"]);
    expect(result.card.tags).toEqual(["ui", "core"]);
    expect(result.card.body).toContain("## What");
    expect(result.card.body).toContain("- [ ] Columns render");
    // bytes preserved verbatim, CRLF and all
    expect(result.card.raw).toBe(crlf(FULL_CARD));
  });

  it("parses a CRLF epic", () => {
    const raw = crlf(`---\nid: m02\ntitle: Board core\n---\nGoal.\n`);
    const result = parseEpic("epics/e02/epic.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.epic.id).toBe("m02");
    expect(result.epic.title).toBe("Board core");
  });

  it("tolerates a UTF-8 BOM before the frontmatter", () => {
    const result = parseCard("x.md", `﻿${MINIMAL_CARD}`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.id).toBe("c042");
  });

  it("edits a CRLF card without corrupting line endings or the body", () => {
    const source = crlf(FULL_CARD);
    const parsed = parseCard("x.md", source);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { card, raw } = updateCardFields(
      parsed.card,
      { status: "in-progress" },
      "2026-07-17",
    );

    expect(card.status).toBe("in-progress");
    expect(raw).toBe(
      source
        .replace("status: ready", "status: in-progress")
        .replace("updated: 2026-07-16", "updated: 2026-07-17"),
    );
    // no lone CR left dangling and no LF-only line sneaked in
    expect(raw).not.toMatch(/\r\r/);
    expect(raw).not.toMatch(/[^\r]\n/);
  });

  it("appends a new frontmatter field using the file's own CRLF ending", () => {
    const source = crlf(MINIMAL_CARD);
    const parsed = parseCard("inbox/c042.md", source);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { raw } = updateCardFields(parsed.card, { epic: "m03" }, "2026-07-17");

    expect(raw).toContain("epic: m03\r\n");
    expect(raw).toContain("updated: 2026-07-17\r\n");
    expect(raw).not.toMatch(/[^\r]\n/);
    const reparsed = parseCard("inbox/c042.md", raw);
    expect(reparsed.ok).toBe(true);
  });

  it("removes a frontmatter field from a CRLF card cleanly", () => {
    const source = crlf(FULL_CARD).replace(
      "priority: high\r\n",
      "priority: high\r\norder: 5\r\n",
    );
    const parsed = parseCard("x.md", source);
    if (!parsed.ok) throw new Error("fixture must parse");
    expect(parsed.card.order).toBe(5);

    const { card, raw } = updateCardFields(parsed.card, { order: null }, "2026-07-17");

    expect(card.order).toBeNull();
    expect(raw).not.toContain("order: 5");
    expect(raw).not.toMatch(/\r\r/);
    expect(raw).not.toMatch(/[^\r]\n/);
  });
});

describe("newCardRaw", () => {
  it("produces a minimal card that parses with defaults", () => {
    const raw = newCardRaw("c022", "A fresh idea", "", "2026-07-16");
    const result = parseCard("inbox/c022-a-fresh-idea.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.id).toBe("c022");
    expect(result.card.title).toBe("A fresh idea");
    expect(result.card.status).toBe("backlog");
    expect(result.card.created).toBe("2026-07-16");
    expect(result.card.updated).toBe("2026-07-16");
    expect(result.card.body.trim()).toBe("");
  });

  it("includes an optional body", () => {
    const raw = newCardRaw("c022", "Idea", "Some details.", "2026-07-16");
    const result = parseCard("x.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.body).toBe("\nSome details.\n");
  });

  it("quotes titles that YAML would misread", () => {
    const raw = newCardRaw("c022", 'Fix: the "thing" [maybe]', "", "2026-07-16");
    const result = parseCard("x.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.title).toBe('Fix: the "thing" [maybe]');
  });
});

describe("newEpicRaw (i0028)", () => {
  it("scaffolds an epic that parses, with the goal under ## Goal", () => {
    const raw = newEpicRaw("e07", "Dark mode", "Ship a full dark theme.");
    const result = parseEpic("epics/e07-dark-mode/epic.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.epic.id).toBe("e07");
    expect(result.epic.title).toBe("Dark mode");
    expect(result.epic.status).toBe("backlog");
    expect(result.epic.body).toContain("## Goal");
    expect(result.epic.body).toContain("Ship a full dark theme.");
    expect(result.epic.body).toContain("## Definition of done");
  });

  it("still parses with an empty goal", () => {
    const result = parseEpic("epics/e08-x/epic.md", newEpicRaw("e08", "X", ""));
    expect(result.ok).toBe(true);
  });

  it("quotes a title YAML would misread", () => {
    const result = parseEpic("epics/e09-x/epic.md", newEpicRaw("e09", "Fix: [it]", "g"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.epic.title).toBe("Fix: [it]");
  });
});

describe("parseEpic", () => {
  it("parses an epic file", () => {
    const raw = `---
id: m02
title: Board UI
status: in-progress
due: 2026-08-15
---

## Goal

Kanban.
`;
    const result = parseEpic("epics/e02-board-ui/epic.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.epic.id).toBe("m02");
    expect(result.epic.title).toBe("Board UI");
    expect(result.epic.status).toBe("in-progress");
    expect(result.epic.body).toContain("## Goal");
  });

  it("defaults status to backlog and due to null", () => {
    const raw = `---\nid: m09\ntitle: Later\n---\nbody\n`;
    const result = parseEpic("x/epic.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.epic.status).toBe("backlog");
  });

  it("rejects an epic missing id or title", () => {
    const result = parseEpic("x/epic.md", `---\nid: m09\n---\nbody\n`);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalid.reason).toContain("title");
  });
});

describe("collapseDuplicateFrontmatterKeys (i0034)", () => {
  it("collapses a duplicate status-changed to the last value, and the card then parses", () => {
    const dup =
      "---\nid: c001\ntitle: X\nstatus: backlog\n" +
      "status-changed: 2026-07-10T09:00:00\n" +
      "status-changed: 2026-07-11T10:00:00\n" +
      "updated: 2026-07-10\n---\nbody\n";
    // it doesn't parse before the repair
    expect(parseCard("cards/c001.md", dup).ok).toBe(false);

    const fixed = collapseDuplicateFrontmatterKeys(dup);
    expect(fixed).not.toBeNull();
    expect((fixed!.match(/^status-changed:/gm) ?? []).length).toBe(1);
    expect(fixed).toContain("status-changed: 2026-07-11T10:00:00"); // last wins
    expect(fixed).not.toContain("2026-07-10T09:00:00");

    const parsed = parseCard("cards/c001.md", fixed!);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.card.statusChanged).toBe("2026-07-11T10:00:00");
    // the body is untouched
    expect(fixed!.endsWith("---\nbody\n")).toBe(true);
  });

  it("returns null when there are no duplicate keys", () => {
    const clean = "---\nid: c001\ntitle: X\nstatus: backlog\n---\nbody\n";
    expect(collapseDuplicateFrontmatterKeys(clean)).toBeNull();
  });

  it("returns null when there is no frontmatter", () => {
    expect(collapseDuplicateFrontmatterKeys("just a body, no frontmatter")).toBeNull();
  });

  it("preserves CRLF line endings", () => {
    const dup =
      "---\r\nid: c001\r\ntitle: X\r\nstatus: backlog\r\n" +
      "status-changed: a\r\nstatus-changed: b\r\n---\r\nbody\r\n";
    const fixed = collapseDuplicateFrontmatterKeys(dup)!;
    expect(fixed).toContain("\r\n");
    expect((fixed.match(/^status-changed:/gm) ?? []).length).toBe(1);
  });
});

describe("parseBoardConfig", () => {
  it("i0033: the default lineup includes inbox and discuss in order", () => {
    expect(DEFAULT_BOARD_CONFIG.columns).toEqual([
      "inbox", "discuss", "backlog", "ready", "in-progress", "review", "done",
    ]);
    // discuss parses as a valid status on a board with no board.yaml
    const parsed = parseCard(
      "cards/c001-x.md",
      "---\nid: c001\ntitle: X\nstatus: discuss\n---\n",
    );
    expect(parsed.ok).toBe(true);
  });

  it("parses columns and wip limits", () => {
    const { config, error } = parseBoardConfig(
      `columns: [todo, doing, done]\nwip_limits:\n  doing: 2\n`,
    );

    expect(error).toBeNull();
    expect(config.columns).toEqual(["todo", "doing", "done"]);
    expect(config.wipLimits).toEqual({ doing: 2 });
  });

  it("falls back to defaults for missing keys", () => {
    const { config, error } = parseBoardConfig(`wip_limits:\n  ready: 5\n`);

    expect(error).toBeNull();
    expect(config.columns).toEqual(DEFAULT_BOARD_CONFIG.columns);
    expect(config.wipLimits).toEqual({ ready: 5 });
  });

  it("returns full defaults plus an error for malformed yaml", () => {
    const { config, error } = parseBoardConfig(`columns: [broken\n  nope`);

    expect(config).toEqual(DEFAULT_BOARD_CONFIG);
    expect(error).toMatch(/yaml/i);
  });

  it("returns defaults for an empty file", () => {
    const { config, error } = parseBoardConfig("");

    expect(error).toBeNull();
    expect(config).toEqual(DEFAULT_BOARD_CONFIG);
  });

  it("parses an optional background image path (c047)", () => {
    expect(
      parseBoardConfig("background: assets/board/bg.jpg\n").config.background,
    ).toBe("assets/board/bg.jpg");
    expect(parseBoardConfig("columns: [a]\n").config.background).toBeNull();
  });
});

describe("sorting fields (c056)", () => {
  const ORDERED_CARD = `---
id: c010
title: Ranked card
status: backlog
order: 12.5
status-changed: 2026-07-17T08:12:33
created: 2026-07-17T07:00:00
updated: 2026-07-17
---

Body.
`;

  it("parses order, status-changed, and datetime created", () => {
    const result = parseCard("milestones/m02/c010-ranked.md", ORDERED_CARD);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.order).toBe(12.5);
    expect(result.card.statusChanged).toBe("2026-07-17T08:12:33");
    expect(result.card.created).toBe("2026-07-17T07:00:00");
  });

  it("defaults order and statusChanged to null", () => {
    const result = parseCard("inbox/c042-idea.md", MINIMAL_CARD);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.order).toBeNull();
    expect(result.card.statusChanged).toBeNull();
  });

  it("rejects a non-numeric order", () => {
    const raw = MINIMAL_CARD.replace("status: backlog", "status: backlog\norder: first");
    const result = parseCard("inbox/c042-idea.md", raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalid.reason).toContain("order");
  });

  it("updateCardFields writes status-changed as a surgical line edit", () => {
    const parsed = parseCard("inbox/c042-idea.md", MINIMAL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { card, raw } = updateCardFields(
      parsed.card,
      { status: "ready", statusChanged: "2026-07-17T09:30:00" },
      "2026-07-17",
      { ...DEFAULT_BOARD_CONFIG, columns: ["backlog", "ready"] },
    );

    expect(raw).toContain("status: ready");
    expect(raw).toContain("status-changed: 2026-07-17T09:30:00");
    expect(card.statusChanged).toBe("2026-07-17T09:30:00");
    // body untouched
    expect(raw).toContain("A quick inbox note.");
  });

  it("updateCardFields sets a numeric order without quotes", () => {
    const parsed = parseCard("inbox/c042-idea.md", MINIMAL_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { card, raw } = updateCardFields(parsed.card, { order: 7.25 }, "2026-07-17");

    expect(raw).toContain("order: 7.25");
    expect(card.order).toBe(7.25);
  });

  it("updateCardFields removes the order line when order is null", () => {
    const parsed = parseCard("milestones/m02/c010-ranked.md", ORDERED_CARD);
    if (!parsed.ok) throw new Error("fixture must parse");

    const { card, raw } = updateCardFields(parsed.card, { order: null }, "2026-07-17");

    expect(raw).not.toContain("order:");
    expect(card.order).toBeNull();
    // neighboring lines survive byte-for-byte
    expect(raw).toContain("status-changed: 2026-07-17T08:12:33");
    expect(raw).toContain("created: 2026-07-17T07:00:00");
    expect(raw).toContain("Body.");
  });

  it("newCardRaw stamps a datetime created", () => {
    const raw = newCardRaw("c060", "Timed card", "", "2026-07-17T10:15:00");

    expect(raw).toContain("created: 2026-07-17T10:15:00");
    const parsed = parseCard("inbox/c060-timed-card.md", raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.card.created).toBe("2026-07-17T10:15:00");
  });
});
