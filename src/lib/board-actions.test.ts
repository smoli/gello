import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileAtomic } from "./fs";
import { parseCard, DEFAULT_BOARD_CONFIG } from "./cards";
import { moveCard, saveCardBody, saveCardFields } from "./board-actions";

vi.mock("./fs", () => ({ writeFileAtomic: vi.fn() }));
const writeMock = vi.mocked(writeFileAtomic);

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
      "2026-07-16",
    );

    expect(card.status).toBe("in-progress");
    expect(card.updated).toBe("2026-07-16");
    await persisted;

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m01-x/c001-first.md",
      RAW.replace("status: ready", "status: in-progress").replace(
        "updated: 2026-07-10",
        "updated: 2026-07-16",
      ),
    );
  });

  it("changes nothing but the status and updated lines", async () => {
    const { persisted } = moveCard(
      "/repo/.gello",
      fixtureCard(),
      "done",
      DEFAULT_BOARD_CONFIG,
      "2026-07-16",
    );
    await persisted;

    const written = writeMock.mock.calls[0][1];
    const changedLines = written
      .split("\n")
      .filter((line, i) => line !== RAW.split("\n")[i]);
    expect(changedLines).toEqual(["status: done", "updated: 2026-07-16"]);
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
