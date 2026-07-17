import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileAtomic } from "./fs";
import { removeDir, removeFile } from "./board-io";
import { loadBoard } from "./board";
import { parseCard, DEFAULT_BOARD_CONFIG } from "./cards";
import {
  createIssueFor,
  createCard,
  deleteCard,
  moveCard,
  renumberCards,
  reorderCard,
  saveCardBody,
  saveCardEdit,
  saveCardFields,
  triageCard,
} from "./board-actions";

vi.mock("./fs", () => ({ writeFileAtomic: vi.fn() }));
vi.mock("./board-io", () => ({ removeFile: vi.fn(), removeDir: vi.fn() }));
const writeMock = vi.mocked(writeFileAtomic);
const removeMock = vi.mocked(removeFile);
const removeDirMock = vi.mocked(removeDir);

const RAW = `---
id: c001
title: First
status: ready
priority: high
created: 2026-07-10
updated: 2026-07-10
---

body text
`;

function fixtureCard() {
  const parsed = parseCard("milestones/m01-x/c001-first.md", RAW);
  if (!parsed.ok) throw new Error("fixture must parse");
  return parsed.card;
}

describe("moveCard", () => {
  beforeEach(() => {
    writeMock.mockReset();
    writeMock.mockResolvedValue(undefined);
  });

  it("optimistically returns the updated card, then persists to the absolute path", async () => {
    const { card, persisted } = moveCard(
      "/repo/.gello",
      fixtureCard(),
      "in-progress",
      DEFAULT_BOARD_CONFIG,
      "2026-07-16T09:00:00",
    );

    expect(card.status).toBe("in-progress");
    expect(card.updated).toBe("2026-07-16");
    expect(card.statusChanged).toBe("2026-07-16T09:00:00");
    await persisted;

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m01-x/c001-first.md",
      RAW.replace("status: ready", "status: in-progress").replace(
        "updated: 2026-07-10",
        // c056: a status move stamps when the status was assigned
        "updated: 2026-07-16\nstatus-changed: 2026-07-16T09:00:00",
      ) + "\n## Log\n\n- 2026-07-16 status → in-progress (app)\n",
    );
  });

  it("changes only status + updated, and journals the move into the Log (c042)", async () => {
    const { card, persisted } = moveCard(
      "/repo/.gello",
      fixtureCard(),
      "done",
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );
    await persisted;

    const written = writeMock.mock.calls[0][1];
    expect(written).toContain("status: done\n");
    expect(written).toContain("updated: 2026-07-16\n");
    // body untouched except the appended Log section
    expect(written).toContain("body text");
    expect(written).toContain("## Log\n\n- 2026-07-16 status → done (app)\n");
    expect(card.body).toContain("- 2026-07-16 status → done (app)");
  });

  it("does not journal non-status field edits", async () => {
    const { persisted } = saveCardFields(
      "/repo/.gello",
      fixtureCard(),
      { priority: "low" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );
    await persisted;

    expect(writeMock.mock.calls[0][1]).not.toContain("## Log");
  });

  it("does not journal a no-op status 'change'", async () => {
    const { persisted } = saveCardFields(
      "/repo/.gello",
      fixtureCard(),
      { status: "ready" }, // already ready
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );
    await persisted;

    expect(writeMock.mock.calls[0][1]).not.toContain("## Log");
  });

  it("propagates write failures through the persisted promise", async () => {
    writeMock.mockRejectedValueOnce(new Error("disk full"));

    const { persisted } = moveCard(
      "/repo/.gello",
      fixtureCard(),
      "done",
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );

    await expect(persisted).rejects.toThrow("disk full");
  });

  it("persists combined field edits (priority + tags)", async () => {
    const { card, persisted } = saveCardFields(
      "/repo/.gello",
      fixtureCard(),
      { priority: "low", tags: ["ui", "core"] },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );

    expect(card.priority).toBe("low");
    expect(card.tags).toEqual(["ui", "core"]);
    await persisted;
    const written = writeMock.mock.calls[0][1];
    expect(written).toContain("priority: low\n");
    expect(written).toContain("tags: [ui, core]\n");
  });

  it("persists a body replacement, frontmatter intact", async () => {
    const { card, persisted } = saveCardBody(
      "/repo/.gello",
      fixtureCard(),
      "\nnew body\n",
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );

    expect(card.body).toBe("\nnew body\n");
    await persisted;
    const written = writeMock.mock.calls[0][1];
    expect(written).toContain("status: ready\n");
    expect(written.endsWith("\nnew body\n")).toBe(true);
    expect(written).toContain("updated: 2026-07-16");
  });

  it("rejects an illegal target status without writing", () => {
    expect(() =>
      moveCard(
        "/repo/.gello",
        fixtureCard(),
        "not-a-column",
        DEFAULT_BOARD_CONFIG,
        "2026-07-16",
      ),
    ).toThrow(/status/i);
    expect(writeMock).not.toHaveBeenCalled();
  });
});

describe("custom-column statuses (c033)", () => {
  beforeEach(() => {
    writeMock.mockReset();
    writeMock.mockResolvedValue(undefined);
  });

  const DISCUSS_CONFIG = {
    columns: ["discuss", "backlog", "ready", "in-progress", "review", "done"],
    wipLimits: {},
    types: ["task", "issue"],
    background: null,
  };

  function discussCard() {
    const parsed = parseCard(
      "inbox/c033-idea.md",
      "---\nid: c033\ntitle: Idea\nstatus: discuss\n---\n\n- [ ] a task\n",
      DISCUSS_CONFIG,
    );
    if (!parsed.ok) throw new Error("fixture must parse");
    return parsed.card;
  }

  it("saves a body edit on a discuss-status card", async () => {
    const { card, persisted } = saveCardBody(
      "/repo/.gello",
      discussCard(),
      "\nnew body\n",
      DISCUSS_CONFIG,
      "2026-07-16",
    );

    expect(card.status).toBe("discuss");
    await persisted;
    expect(writeMock.mock.calls[0][1]).toContain("status: discuss");
  });

  it("saves a title+body edit on a discuss-status card", async () => {
    const { card, persisted } = saveCardEdit(
      "/repo/.gello",
      discussCard(),
      { title: "Refined idea", body: "\nrefined\n" },
      DISCUSS_CONFIG,
      "2026-07-16",
    );

    expect(card.title).toBe("Refined idea");
    expect(card.status).toBe("discuss");
    await persisted;
    expect(writeMock).toHaveBeenCalledTimes(1);
  });
});

describe("saveCardEdit", () => {
  beforeEach(() => {
    writeMock.mockReset();
    writeMock.mockResolvedValue(undefined);
  });

  it("persists a title and body change in one atomic write", async () => {
    const { card, persisted } = saveCardEdit(
      "/repo/.gello",
      fixtureCard(),
      { title: "Renamed card", body: "\nnew body\n" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );

    expect(card.title).toBe("Renamed card");
    expect(card.body).toBe("\nnew body\n");
    await persisted;
    expect(writeMock).toHaveBeenCalledTimes(1);
    const written = writeMock.mock.calls[0][1];
    expect(written).toContain("title: Renamed card\n");
    expect(written.endsWith("\nnew body\n")).toBe(true);
    expect(written).toContain("status: ready\n");
  });

  it("leaves the title line untouched when unchanged", async () => {
    const original = fixtureCard();
    const { persisted } = saveCardEdit(
      "/repo/.gello",
      original,
      { title: original.title, body: "\nonly body changed\n" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );

    await persisted;
    expect(writeMock.mock.calls[0][1]).toContain("title: First\n");
  });

  it("quotes titles that YAML would misread", async () => {
    const { card, persisted } = saveCardEdit(
      "/repo/.gello",
      fixtureCard(),
      { title: "fix: [everything]", body: "x" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );

    await persisted;
    expect(card.title).toBe("fix: [everything]");
  });
});

const CAPTURE_MODEL = loadBoard([
  {
    path: "inbox/c007-existing.md",
    content: "---\nid: c007\ntitle: Existing\nstatus: backlog\n---\nx\n",
  },
  {
    path: "milestones/m02-board-ui/milestone.md",
    content: "---\nid: m02\ntitle: Board UI\n---\ngoal\n",
  },
]);

describe("createCard", () => {
  beforeEach(() => {
    writeMock.mockReset();
    writeMock.mockResolvedValue(undefined);
  });

  it("creates an inbox card with the next free ID and a slugged filename", async () => {
    const { card, persisted } = createCard(
      "/repo/.gello",
      CAPTURE_MODEL,
      { title: "Fix the Flaky Sync!!", body: "" },
      "2026-07-16",
    );

    expect(card.id).toBe("c0008");
    expect(card.path).toBe("inbox/c0008-fix-the-flaky-sync.md");
    expect(card.status).toBe("backlog");
    await persisted;
    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/inbox/c0008-fix-the-flaky-sync.md",
      expect.stringContaining("title: Fix the Flaky Sync!!"),
    );
  });

  it("falls back to a generic slug for symbol-only titles", () => {
    const { card } = createCard(
      "/repo/.gello",
      CAPTURE_MODEL,
      { title: "???", body: "" },
      "2026-07-16",
    );

    expect(card.path).toBe("inbox/c0008-idea.md");
  });

  it("includes the optional body", async () => {
    const { persisted } = createCard(
      "/repo/.gello",
      CAPTURE_MODEL,
      { title: "With body", body: "Details here." },
      "2026-07-16",
    );

    await persisted;
    expect(writeMock.mock.calls[0][1]).toContain("Details here.");
  });

  it("i0013: honors an explicit pre-reserved id (image paste before create)", async () => {
    const { card } = createCard(
      "/repo/.gello",
      CAPTURE_MODEL,
      { title: "Has a screenshot", body: "![x](../assets/c0008/x.png)", id: "c0008" },
      "2026-07-16",
    );

    expect(card.id).toBe("c0008");
    expect(card.path).toBe("inbox/c0008-has-a-screenshot.md");
  });
});

describe("issue creation (c024)", () => {
  beforeEach(() => {
    writeMock.mockReset();
    writeMock.mockResolvedValue(undefined);
  });

  it("creates a standalone issue in the inbox via createCard, in the i-namespace (c043)", async () => {
    const { card, persisted } = createCard(
      "/repo/.gello",
      CAPTURE_MODEL,
      { title: "Something broke", body: "", type: "issue" },
      "2026-07-16",
    );

    expect(card.type).toBe("issue");
    expect(card.ref).toBeNull();
    expect(card.id).toBe("i0001");
    expect(card.path).toBe("inbox/i0001-something-broke.md");
    await persisted;
    expect(writeMock.mock.calls[0][1]).toContain("type: issue\n");
  });

  it("creates a referenced issue next to the source card via createIssueFor", async () => {
    const source = parseCard(
      "milestones/m02-board-ui/c005-view.md",
      "---\nid: c005\ntitle: The view\nstatus: review\nmilestone: m02\n---\nx\n",
    );
    if (!source.ok) throw new Error("fixture must parse");

    const { card, persisted } = createIssueFor(
      "/repo/.gello",
      CAPTURE_MODEL,
      source.card,
      { title: "It broke badly", body: "Repro: click it." },
      "2026-07-16",
    );

    expect(card.type).toBe("issue");
    expect(card.ref).toBe("c005");
    expect(card.status).toBe("backlog");
    expect(card.milestone).toBe("m02");
    expect(card.title).toBe("It broke badly");
    expect(card.path).toBe("milestones/m02-board-ui/i0001-it-broke-badly.md");
    await persisted;
    const written = writeMock.mock.calls[0][1];
    expect(written).toContain("ref: c005\n");
    expect(written).toContain("milestone: m02\n");
    expect(written).toContain("Repro: click it.");
  });

  it("creates a issue for an inbox source card in the inbox", async () => {
    const source = parseCard(
      "inbox/c007-existing.md",
      "---\nid: c007\ntitle: Existing\nstatus: review\n---\nx\n",
    );
    if (!source.ok) throw new Error("fixture must parse");

    const { card } = createIssueFor(
      "/repo/.gello",
      CAPTURE_MODEL,
      source.card,
      { title: "Inbox trouble", body: "" },
      "2026-07-16",
    );

    expect(card.path).toBe("inbox/i0001-inbox-trouble.md");
    expect(card.milestone).toBeNull();
  });
});

describe("triageCard", () => {
  beforeEach(() => {
    writeMock.mockReset();
    writeMock.mockResolvedValue(undefined);
    removeMock.mockReset();
    removeMock.mockResolvedValue(undefined);
  });

  const INBOX_RAW = `---
id: c007
title: Existing
status: backlog
updated: 2026-07-10
---

![shot](../assets/c007/shot.png)
`;

  function inboxCard() {
    const parsed = parseCard("inbox/c007-existing.md", INBOX_RAW);
    if (!parsed.ok) throw new Error("fixture must parse");
    return parsed.card;
  }

  it("writes the card to the milestone folder with milestone field and rewritten links, then deletes the old file", async () => {
    const { card, persisted } = triageCard(
      "/repo/.gello",
      inboxCard(),
      { folder: "m02-board-ui", milestoneId: "m02" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );

    expect(card.path).toBe("milestones/m02-board-ui/c007-existing.md");
    expect(card.milestone).toBe("m02");
    await persisted;

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m02-board-ui/c007-existing.md",
      expect.stringContaining("![shot](../../assets/c007/shot.png)"),
    );
    expect(writeMock.mock.calls[0][1]).toContain("milestone: m02");
    expect(removeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/inbox/c007-existing.md",
    );
    // write-new strictly before delete-old
    expect(writeMock.mock.invocationCallOrder[0]).toBeLessThan(
      removeMock.mock.invocationCallOrder[0],
    );
  });

  it("resolves the rewritten link against a real attachment on disk", async () => {
    // real .gello tree with an actual asset file
    const root = join(tmpdir(), `gello-triage-${process.pid}-${Math.random().toString(36).slice(2)}`);
    const assetAbs = join(root, "assets/c007/shot.png");
    mkdirSync(dirname(assetAbs), { recursive: true });
    writeFileSync(assetAbs, "png-bytes");

    const { card, persisted } = triageCard(
      root,
      inboxCard(),
      { folder: "m02-board-ui", milestoneId: "m02" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );
    await persisted;

    const written = writeMock.mock.calls[0][1];
    const linkTarget = written.match(/!\[shot\]\(([^)]+)\)/)![1];
    const resolved = resolve(root, dirname(card.path), linkTarget);
    expect(existsSync(resolved)).toBe(true);
    expect(resolved).toBe(resolve(assetAbs));
  });

  it("does not delete the old file when the new write fails", async () => {
    writeMock.mockRejectedValueOnce(new Error("disk full"));

    const { persisted } = triageCard(
      "/repo/.gello",
      inboxCard(),
      { folder: "m02-board-ui", milestoneId: "m02" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );

    await expect(persisted).rejects.toThrow("disk full");
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("i0005: sets the dropped-on status, stamps status-changed, and logs it (ready)", async () => {
    const { card, persisted } = triageCard(
      "/repo/.gello",
      inboxCard(),
      { folder: "m02-board-ui", milestoneId: "m02" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16T09:15:00",
      "ready",
    );

    expect(card.milestone).toBe("m02");
    expect(card.status).toBe("ready");
    expect(card.statusChanged).toBe("2026-07-16T09:15:00");
    await persisted;

    const written = writeMock.mock.calls[0][1];
    expect(written).toContain("status: ready");
    expect(written).toContain("status-changed: 2026-07-16T09:15:00");
    expect(written).toContain("2026-07-16 status → ready (app)");
  });

  it("i0015: a positioned triage keeps the dropped slot (order), status unchanged", async () => {
    const { card, persisted } = triageCard(
      "/repo/.gello",
      inboxCard(), // status backlog
      { folder: "m02-board-ui", milestoneId: "m02" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16T09:15:00",
      "backlog", // same status → no status change
      25, // the chosen slot
    );

    expect(card.milestone).toBe("m02");
    expect(card.order).toBe(25);
    await persisted;
    const written = writeMock.mock.calls[0][1];
    expect(written).toContain("order: 25");
    expect(written).not.toContain("status-changed:"); // status didn't change
  });

  it("i0005: leaves status untouched when the dropped-on status equals the current one", async () => {
    const { card, persisted } = triageCard(
      "/repo/.gello",
      inboxCard(),
      { folder: "m02-board-ui", milestoneId: "m02" },
      DEFAULT_BOARD_CONFIG,
      "2026-07-16T09:15:00",
      "backlog",
    );

    expect(card.status).toBe("backlog");
    await persisted;
    const written = writeMock.mock.calls[0][1];
    expect(written).not.toContain("status-changed:");
    expect(written).not.toContain("status → backlog");
  });
});

describe("deleteCard (c0062)", () => {
  beforeEach(() => {
    removeMock.mockReset();
    removeMock.mockResolvedValue(undefined);
    removeDirMock.mockReset();
    removeDirMock.mockResolvedValue(undefined);
  });

  it("removes the card file, then its asset folder (keyed by id)", async () => {
    const { persisted } = deleteCard("/repo/.gello", fixtureCard());
    await persisted;

    expect(removeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m01-x/c001-first.md",
    );
    expect(removeDirMock).toHaveBeenCalledExactlyOnceWith("/repo/.gello/assets/c001");
    // file removed strictly before the asset folder
    expect(removeMock.mock.invocationCallOrder[0]).toBeLessThan(
      removeDirMock.mock.invocationCallOrder[0],
    );
  });

  it("does not touch the asset folder if the card file removal fails", async () => {
    removeMock.mockRejectedValueOnce(new Error("locked"));

    const { persisted } = deleteCard("/repo/.gello", fixtureCard());

    await expect(persisted).rejects.toThrow("locked");
    expect(removeDirMock).not.toHaveBeenCalled();
  });
});

describe("manual order and status-changed (c056)", () => {
  beforeEach(() => {
    writeMock.mockReset();
    writeMock.mockResolvedValue(undefined);
  });

  const RANKED_RAW = `---
id: c002
title: Ranked
status: ready
order: 30
created: 2026-07-10
updated: 2026-07-10
---

body
`;

  function rankedCard() {
    const parsed = parseCard("milestones/m01-x/c002-ranked.md", RANKED_RAW);
    if (!parsed.ok) throw new Error("fixture must parse");
    return parsed.card;
  }

  it("moveCard clears a stale manual order when the status changes", async () => {
    const { card, persisted } = moveCard(
      "/repo/.gello",
      rankedCard(),
      "in-progress",
      DEFAULT_BOARD_CONFIG,
      "2026-07-16T09:00:00",
    );

    expect(card.order).toBeNull();
    await persisted;
    const written = writeMock.mock.calls[0][1];
    expect(written).not.toContain("order:");
    expect(written).toContain("status-changed: 2026-07-16T09:00:00");
  });

  it("moveCard with an explicit order keeps it (positioned drop)", async () => {
    const { card, persisted } = moveCard(
      "/repo/.gello",
      fixtureCard(),
      "backlog",
      DEFAULT_BOARD_CONFIG,
      "2026-07-16T09:00:00",
      15,
    );

    expect(card.order).toBe(15);
    expect(card.status).toBe("backlog");
    await persisted;
    expect(writeMock.mock.calls[0][1]).toContain("order: 15");
  });

  it("reorderCard writes the rank only — no journal, no status-changed", async () => {
    const { card, persisted } = reorderCard(
      "/repo/.gello",
      rankedCard(),
      12.5,
      DEFAULT_BOARD_CONFIG,
      "2026-07-16T09:00:00",
    );

    expect(card.order).toBe(12.5);
    expect(card.status).toBe("ready");
    await persisted;
    const written = writeMock.mock.calls[0][1];
    expect(written).toContain("order: 12.5");
    expect(written).not.toContain("## Log");
    expect(written).not.toContain("status-changed:");
    expect(written).toContain("updated: 2026-07-16");
  });

  it("renumberCards writes one rank per card", async () => {
    const results = renumberCards(
      "/repo/.gello",
      [
        { card: rankedCard(), order: 10 },
        { card: fixtureCard(), order: 20 },
      ],
      DEFAULT_BOARD_CONFIG,
      "2026-07-16T09:00:00",
    );

    expect(results.map((r) => r.card.order)).toEqual([10, 20]);
    await Promise.all(results.map((r) => r.persisted));
    expect(writeMock).toHaveBeenCalledTimes(2);
    expect(writeMock.mock.calls[0][1]).toContain("order: 10");
    expect(writeMock.mock.calls[1][1]).toContain("order: 20");
  });

  it("createCard stamps a datetime created and a date updated", async () => {
    const { card: created, persisted } = createCard(
      "/repo/.gello",
      CAPTURE_MODEL,
      { title: "Timed", body: "" },
      "2026-07-16T09:00:00",
    );

    expect(created.created).toBe("2026-07-16T09:00:00");
    expect(created.updated).toBe("2026-07-16");
    await persisted;
  });
});
