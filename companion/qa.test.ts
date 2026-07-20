import { describe, expect, it } from "vitest";
import { cardsAnswered, cardsAwaitingInput, hasOpenQuestion } from "./qa.ts";
import { loadBoard, type BoardFile } from "../src/lib/board.ts";

const PARKED =
  "---\nid: c001\ntitle: Parked\nstatus: in-progress\nawaiting: input\n---\n" +
  "\n```gelloquestion\nWhich database?\n\n- [ ] Postgres\n- [ ] SQLite\n```\n\n## What\n\nwork\n";

// what the app writes on answer: un-fenced in place, marker flipped (c0102)
const ANSWERED =
  "---\nid: c001\ntitle: Parked\nstatus: in-progress\nawaiting: answered\n---\n" +
  "\nWhich database?\n\n- [ ] Postgres\n- [x] SQLite\n\n## What\n\nwork\n";

// after the companion resumed and cleared the marker
const RESUMED =
  "---\nid: c001\ntitle: Parked\nstatus: in-progress\n---\n" +
  "\nWhich database?\n\n- [ ] Postgres\n- [x] SQLite\n\n## What\n\nwork\n";

const PLAIN = "---\nid: c002\ntitle: Plain\nstatus: in-progress\n---\n\nno question\n";

function model(...files: BoardFile[]) {
  return loadBoard([
    { path: "board.yaml", content: "columns: [in-progress]\n" },
    ...files,
  ]);
}

describe("hasOpenQuestion (c0102)", () => {
  it("is true only while the gelloquestion fence is present", () => {
    expect(hasOpenQuestion(PARKED)).toBe(true);
    expect(hasOpenQuestion(ANSWERED)).toBe(false);
    expect(hasOpenQuestion(PLAIN)).toBe(false);
  });

  it("ignores an ordinary code fence", () => {
    expect(hasOpenQuestion("```ts\nconst x = 1;\n```\n")).toBe(false);
  });
});

describe("cardsAwaitingInput (c0102)", () => {
  it("lists cards parked on a question", () => {
    const m = model(
      { path: "cards/c001-parked.md", content: PARKED },
      { path: "cards/c002-plain.md", content: PLAIN },
    );
    expect(cardsAwaitingInput(m).map((c) => c.id)).toEqual(["c001"]);
  });

  it("drops a card once its question is answered", () => {
    const m = model({ path: "cards/c001-parked.md", content: ANSWERED });
    expect(cardsAwaitingInput(m)).toEqual([]);
  });
});

describe("cardsAnswered (c0102)", () => {
  it("lists cards the human answered (the resume trigger)", () => {
    const m = model({ path: "cards/c001-parked.md", content: ANSWERED });
    expect(cardsAnswered(m).map((c) => c.id)).toEqual(["c001"]);
  });

  it("does not fire while the question is still parked", () => {
    const m = model({ path: "cards/c001-parked.md", content: PARKED });
    expect(cardsAnswered(m)).toEqual([]);
  });

  it("does not fire for a card that never had a question", () => {
    const m = model({ path: "cards/c002-plain.md", content: PLAIN });
    expect(cardsAnswered(m)).toEqual([]);
  });

  // the point of the marker: the answer survives on disk, so a companion that
  // was down while the human answered still resumes on its next start
  it("fires on a cold start, with no previous model to diff against", () => {
    const m = model({ path: "cards/c001-parked.md", content: ANSWERED });
    expect(cardsAnswered(m).map((c) => c.id)).toEqual(["c001"]);
  });

  it("stops firing once the marker is cleared on resume", () => {
    const m = model({ path: "cards/c001-parked.md", content: RESUMED });
    expect(cardsAnswered(m)).toEqual([]);
  });
});
