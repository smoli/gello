import { describe, expect, it } from "vitest";
import { buildCommitMessage } from "./commit-message";
import { parseCard, DEFAULT_BOARD_CONFIG, type Card } from "./cards";

const CONFIG = {
  ...DEFAULT_BOARD_CONFIG,
  columns: ["discuss", "backlog", "ready", "in-progress", "review", "done"],
};

function card(overrides: {
  id?: string;
  title?: string;
  status?: string;
  epic?: string | null;
  tags?: string[];
  body?: string;
}): Card {
  const {
    id = "c001",
    title = "A card",
    status = "backlog",
    epic = null,
    tags = [],
    body = "## What\n\ndetails\n",
  } = overrides;
  const fm = [
    "---",
    `id: ${id}`,
    `title: ${title}`,
    `status: ${status}`,
    ...(epic ? [`epic: ${epic}`] : []),
    ...(tags.length ? [`tags: [${tags.join(", ")}]`] : []),
    "---",
    "",
  ].join("\n");
  const parsed = parseCard(`cards/${id}.md`, `${fm}${body}`, CONFIG);
  if (!parsed.ok) throw new Error("fixture must parse");
  return parsed.card;
}

describe("buildCommitMessage (c0083)", () => {
  it("returns null when nothing changed", () => {
    const c = card({});
    expect(buildCommitMessage([{ id: "c001", title: "A", before: c, after: c }])).toBeNull();
  });

  it("reports a lone status transition, singular subject", () => {
    const before = card({ id: "c0083", title: "Commit card updates", status: "discuss" });
    const after = card({ id: "c0083", title: "Commit card updates", status: "ready" });
    expect(buildCommitMessage([{ id: "c0083", title: "x", before, after }])).toBe(
      "board: 1 card updated\n\n" +
        "c0083: Commit card updates\n" +
        "- status discuss → ready\n",
    );
  });

  it("lists content, status and epic transitions together", () => {
    const before = card({
      id: "c0042",
      title: "Auto Commit Board Changes",
      status: "backlog",
      epic: null,
      body: "## What\n\noriginal\n",
    });
    const after = card({
      id: "c0042",
      title: "Auto Commit Board Changes",
      status: "review",
      epic: "data-consistency",
      body: "## What\n\nrewritten\n",
    });
    const msg = buildCommitMessage([{ id: "c0042", title: "x", before, after }]);
    expect(msg).toContain("c0042: Auto Commit Board Changes");
    expect(msg).toContain("- content update");
    expect(msg).toContain("- status backlog → review");
    expect(msg).toContain("- epic none → data-consistency");
  });

  it("does not flag content update for a status change's machine Log churn", () => {
    const body = "## What\n\nsame body\n";
    const before = card({ status: "ready", body: `${body}\n## Log\n\n- 2026-07-18 created\n` });
    const after = card({
      status: "in-progress",
      body: `${body}\n## Log\n\n- 2026-07-18 created\n- 2026-07-18 status → in-progress (app)\n`,
    });
    const msg = buildCommitMessage([{ id: "c001", title: "x", before, after }])!;
    expect(msg).toContain("- status ready → in-progress");
    expect(msg).not.toContain("content update");
  });

  it("summarises tag add/remove", () => {
    const before = card({ tags: ["ui", "perf"] });
    const after = card({ tags: ["ui", "core"] });
    const msg = buildCommitMessage([{ id: "c001", title: "x", before, after }])!;
    expect(msg).toContain("- tags +core -perf");
  });

  it("labels new and deleted cards", () => {
    const created = card({ id: "c009", title: "Fresh" });
    const removed = card({ id: "c010", title: "Gone" });
    const msg = buildCommitMessage([
      { id: "c009", title: "Fresh", before: null, after: created },
      { id: "c010", title: "Gone", before: removed, after: null },
    ])!;
    expect(msg.startsWith("board: 2 cards updated")).toBe(true);
    expect(msg).toContain("c009: Fresh\n- new card");
    expect(msg).toContain("c010: Gone\n- deleted");
  });

  it("falls back to 'updated' for a genuinely-changed card with no tracked transition (e.g. reorder)", () => {
    // same status/epic/tags/body, but the raw differs (a reorder bumps order +
    // updated) → one block with the catch-all line, so the change is committed
    const base = "---\nid: c001\ntitle: A\nstatus: ready\norder: 10\n---\n\nbody\n";
    const reordered = "---\nid: c001\ntitle: A\nstatus: ready\norder: 20\n---\n\nbody\n";
    const before = parseCard("cards/c001.md", base, CONFIG);
    const after = parseCard("cards/c001.md", reordered, CONFIG);
    if (!before.ok || !after.ok) throw new Error("fixtures must parse");
    const msg = buildCommitMessage([
      { id: "c001", title: "A", before: before.card, after: after.card },
    ]);
    expect(msg).toBe("board: 1 card updated\n\nc001: A\n- updated\n");
  });
});
