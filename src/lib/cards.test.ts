import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOARD_CONFIG,
  parseBoardConfig,
  parseCard,
  parseMilestone,
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
    expect(card.milestone).toBe("m02");
    expect(card.priority).toBe("high");
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
    expect(result.card.milestone).toBeNull();
    expect(result.card.priority).toBe("normal");
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
    const config = { columns: ["todo", "doing"], wipLimits: {} };
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

  it("rejects an invalid priority", () => {
    const raw = MINIMAL_CARD.replace(
      "status: backlog",
      "status: backlog\npriority: urgent",
    );
    const result = parseCard("x.md", raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalid.reason).toMatch(/priority/i);
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
      { status: "done", priority: "low" },
      "2026-07-17",
    );

    expect(card.status).toBe("done");
    expect(card.priority).toBe("low");
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
      { milestone: "m03" },
      "2026-07-17",
    );

    expect(card.milestone).toBe("m03");
    expect(card.updated).toBe("2026-07-17");
    // appended inside the frontmatter block, body untouched
    expect(raw).toContain("milestone: m03\n");
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

describe("parseMilestone", () => {
  it("parses a milestone file", () => {
    const raw = `---
id: m02
title: Board UI
status: in-progress
due: 2026-08-15
---

## Goal

Kanban.
`;
    const result = parseMilestone("milestones/m02-board-ui/milestone.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.milestone.id).toBe("m02");
    expect(result.milestone.title).toBe("Board UI");
    expect(result.milestone.status).toBe("in-progress");
    expect(result.milestone.due).toBe("2026-08-15");
    expect(result.milestone.body).toContain("## Goal");
  });

  it("defaults status to backlog and due to null", () => {
    const raw = `---\nid: m09\ntitle: Later\n---\nbody\n`;
    const result = parseMilestone("x/milestone.md", raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.milestone.status).toBe("backlog");
    expect(result.milestone.due).toBeNull();
  });

  it("rejects a milestone missing id or title", () => {
    const result = parseMilestone("x/milestone.md", `---\nid: m09\n---\nbody\n`);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalid.reason).toContain("title");
  });
});

describe("parseBoardConfig", () => {
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
});
