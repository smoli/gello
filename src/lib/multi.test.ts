import { describe, expect, it } from "vitest";
import { loadBoard } from "./board";
import {
  MULTI_COLUMNS,
  autoProjectColor,
  cardKey,
  columnCards,
  findProjectCard,
  parseProjectList,
  projectColor,
  projectName,
  serializeProjectList,
  type ProjectBoard,
} from "./multi";

function card(
  id: string,
  status: string,
  extra = "",
): { path: string; content: string } {
  return {
    path: `cards/${id}-x.md`,
    content: `---\nid: ${id}\ntitle: ${id} title\nstatus: ${status}\n${extra}---\nbody\n`,
  };
}

function board(
  path: string,
  files: Array<{ path: string; content: string }>,
): ProjectBoard {
  return { path, root: `${path}/.gello`, model: loadBoard(files) };
}

describe("MULTI_COLUMNS", () => {
  it("is the flow that needs watching, in board order", () => {
    expect(MULTI_COLUMNS).toEqual(["ready", "in-progress", "review"]);
  });
});

describe("cardKey", () => {
  it("keys a card by project and id, so same-id cards never collide", () => {
    expect(cardKey("/repo/gello", "c001")).not.toBe(cardKey("/repo/popexel", "c001"));
  });

  it("is stable for the same project and id", () => {
    expect(cardKey("/repo/gello", "c001")).toBe(cardKey("/repo/gello", "c001"));
  });
});

describe("projectName", () => {
  it("is the folder name, whichever separator the platform uses", () => {
    expect(projectName("/Users/x/code/gello")).toBe("gello");
    expect(projectName("C:\\code\\popexel")).toBe("popexel");
    expect(projectName("/Users/x/code/gello/")).toBe("gello");
  });
});

describe("project colour", () => {
  it("takes the colour board.yaml sets", () => {
    const withColour = board("/repo/gello", [
      { path: "board.yaml", content: 'project_color: "#123456"\n' },
    ]);
    expect(projectColor(withColour)).toBe("#123456");
  });

  it("falls back to a stable colour derived from the project path", () => {
    const plain = board("/repo/gello", []);
    expect(projectColor(plain)).toBe(autoProjectColor("/repo/gello"));
    expect(autoProjectColor("/repo/gello")).toBe(autoProjectColor("/repo/gello"));
    expect(autoProjectColor("/repo/gello")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("gives two projects with the same name different colours", () => {
    // the whole path feeds the hash — two checkouts of the same repo are two
    // projects in the view and must stay apart
    expect(autoProjectColor("/one/gello")).not.toBe(autoProjectColor("/two/gello"));
  });
});

describe("columnCards", () => {
  const gello = board("/repo/gello", [
    card("c001", "ready", "order: 20\n"),
    card("c002", "in-progress", "status-changed: 2026-08-01T09:00:00\n"),
    card("c003", "done"),
  ]);
  const popexel = board("/repo/popexel", [
    card("c001", "ready", "order: 10\n"),
    card("c002", "review", "status-changed: 2026-08-02T09:00:00\n"),
  ]);

  it("aggregates one column across every board", () => {
    const ready = columnCards([gello, popexel], "ready");
    expect(ready.map((entry) => entry.board.path)).toEqual([
      "/repo/popexel",
      "/repo/gello",
    ]);
    // the manual ready order decides, so whoever is next up floats to the top
    expect(ready.map((entry) => entry.card.id)).toEqual(["c001", "c001"]);
  });

  it("keys every entry by project + id", () => {
    const ready = columnCards([gello, popexel], "ready");
    expect(new Set(ready.map((entry) => entry.key)).size).toBe(2);
    expect(ready[0].key).toBe(cardKey("/repo/popexel", "c001"));
  });

  it("leaves out the columns the view does not show", () => {
    expect(columnCards([gello, popexel], "done")).toEqual([]);
    expect(columnCards([gello, popexel], "backlog")).toEqual([]);
  });

  it("orders a workflow column by how long the card has been waiting", () => {
    const older = board("/repo/one", [
      card("c009", "review", "status-changed: 2026-07-30T09:00:00\n"),
    ]);
    const review = columnCards([older, popexel], "review");
    expect(review.map((entry) => entry.board.path)).toEqual([
      "/repo/one",
      "/repo/popexel",
    ]);
  });

  it("skips archived cards — they are off their own board too", () => {
    const withArchive = board("/repo/one", [
      {
        path: "cards/archive/c010-x.md",
        content: "---\nid: c010\ntitle: Old\nstatus: review\n---\nbody\n",
      },
      card("c011", "review"),
    ]);
    expect(columnCards([withArchive], "review").map((e) => e.card.id)).toEqual(["c011"]);
  });

  it("includes epic-grouped cards, not just standalone ones", () => {
    const withEpic = board("/repo/one", [
      { path: "epics/e01-x/epic.md", content: "---\nid: e01\ntitle: X\n---\ngoal\n" },
      {
        path: "epics/e01-x/c020-y.md",
        content: "---\nid: c020\ntitle: In an epic\nstatus: ready\nepic: e01\n---\nb\n",
      },
    ]);
    expect(columnCards([withEpic], "ready").map((e) => e.card.id)).toEqual(["c020"]);
  });
});

describe("findProjectCard", () => {
  const gello = board("/repo/gello", [card("c001", "review")]);
  const popexel = board("/repo/popexel", [card("c001", "review")]);

  it("resolves a key back to the card in its own project", () => {
    const found = findProjectCard([gello, popexel], cardKey("/repo/popexel", "c001"));
    expect(found?.board.path).toBe("/repo/popexel");
    expect(found?.board.root).toBe("/repo/popexel/.gello");
  });

  it("is null for a card that has since gone", () => {
    expect(findProjectCard([gello], cardKey("/repo/gello", "c404"))).toBeNull();
    expect(findProjectCard([gello], cardKey("/gone", "c001"))).toBeNull();
  });
});

describe("the selected-project list", () => {
  it("round-trips through the app-flag store", () => {
    const list = ["/repo/gello", "/repo/popexel"];
    expect(parseProjectList(serializeProjectList(list))).toEqual(list);
  });

  it("is empty for an unset, malformed, or wrongly-typed flag", () => {
    expect(parseProjectList(null)).toEqual([]);
    expect(parseProjectList("not json")).toEqual([]);
    expect(parseProjectList('{"a":1}')).toEqual([]);
    expect(parseProjectList('["/repo/gello", 7]')).toEqual(["/repo/gello"]);
  });
});
