import { describe, expect, it } from "vitest";
import { loadBoard } from "../src/lib/board.ts";
import {
  parseOpenTurn,
  isOpenTurnAnswered,
  cardsAnswered,
  cardsAwaitingInput,
} from "./qa.ts";

const OPEN = (blocks: string) => `## What\n\ntask\n\n## Open question\n\n${blocks}`;

describe("parseOpenTurn", () => {
  it("returns not-present when there is no Open question section", () => {
    expect(parseOpenTurn("## What\n\njust a task\n").present).toBe(false);
  });

  it("a choice question is answered when a box is checked", () => {
    const unanswered = parseOpenTurn(
      OPEN("### Which db?\n\n- [ ] Postgres\n- [ ] SQLite\n"),
    );
    expect(unanswered.questions).toHaveLength(1);
    expect(unanswered.questions[0].answered).toBe(false);

    const answered = parseOpenTurn(OPEN("### Which db?\n\n- [x] Postgres\n- [ ] SQLite\n"));
    expect(answered.questions[0].answered).toBe(true);
  });

  it("an open question is answered when its blockquote has text", () => {
    const empty = parseOpenTurn(OPEN("### Any constraints?\n\n> \n"));
    expect(empty.questions[0].answered).toBe(false);

    const filled = parseOpenTurn(OPEN("### Any constraints?\n\n> keep it offline\n"));
    expect(filled.questions[0].answered).toBe(true);
  });

  it("stops the section at the next ## heading (History below stays out)", () => {
    const body = OPEN("### Q1?\n\n- [x] yes\n\n## History\n\n### Turn 1\n\n> old answer\n");
    const turn = parseOpenTurn(body);
    expect(turn.questions).toHaveLength(1);
    expect(turn.questions[0].text).toBe("Q1?");
  });
});

describe("isOpenTurnAnswered", () => {
  it("true only when a turn is present and every question is answered", () => {
    expect(isOpenTurnAnswered("## What\n\ntask\n")).toBe(false); // no turn
    expect(isOpenTurnAnswered(OPEN("### Q?\n\n- [ ] a\n"))).toBe(false); // unanswered
    expect(
      isOpenTurnAnswered(OPEN("### Q1?\n\n- [x] a\n\n### Q2?\n\n> done\n")),
    ).toBe(true); // both answered
    expect(
      isOpenTurnAnswered(OPEN("### Q1?\n\n- [x] a\n\n### Q2?\n\n> \n")),
    ).toBe(false); // one still open
  });

  it("an empty Open question section (no questions) is not 'answered'", () => {
    expect(isOpenTurnAnswered("## Open question\n\n")).toBe(false);
  });
});

describe("cardsAnswered", () => {
  const body = (open: string) =>
    `---\nid: c001\ntitle: T\nstatus: in-progress\n---\n\n## What\n\nt\n\n## Open question\n\n${open}`;
  const board = (open: string) =>
    loadBoard([
      { path: "board.yaml", content: "columns: [inbox, in-progress, done]\n" },
      { path: "cards/c001-x.md", content: body(open) },
    ]);

  it("reports a card whose open turn just became fully answered", () => {
    const prev = board("### Q?\n\n- [ ] a\n");
    const next = board("### Q?\n\n- [x] a\n");
    expect(cardsAnswered(prev, next).map((c) => c.id)).toEqual(["c001"]);
  });

  it("does not report an already-answered turn (no spurious resume)", () => {
    const prev = board("### Q?\n\n- [x] a\n");
    const next = board("### Q?\n\n- [x] a\n");
    expect(cardsAnswered(prev, next)).toEqual([]);
  });

  it("does not report a still-unanswered turn", () => {
    const prev = board("### Q?\n\n- [ ] a\n");
    const next = board("### Q?\n\n- [ ] a\n");
    expect(cardsAnswered(prev, next)).toEqual([]);
  });
});

describe("cardsAwaitingInput", () => {
  const body = (open: string) =>
    `---\nid: c001\ntitle: T\nstatus: in-progress\n---\n\n## What\n\nt\n\n## Open question\n\n${open}`;
  const board = (open: string) =>
    loadBoard([
      { path: "board.yaml", content: "columns: [inbox, in-progress, done]\n" },
      { path: "cards/c001-x.md", content: body(open) },
    ]);

  it("reports a card parked on an unanswered open turn", () => {
    expect(cardsAwaitingInput(board("### Q?\n\n- [ ] a\n")).map((c) => c.id)).toEqual([
      "c001",
    ]);
  });

  it("does not report a card whose open turn is fully answered", () => {
    expect(cardsAwaitingInput(board("### Q?\n\n- [x] a\n"))).toEqual([]);
  });

  it("does not report a card with no open turn", () => {
    const model = loadBoard([
      { path: "board.yaml", content: "columns: [inbox, in-progress, done]\n" },
      {
        path: "cards/c001-x.md",
        content: `---\nid: c001\ntitle: T\nstatus: in-progress\n---\n\n## What\n\nt\n`,
      },
    ]);
    expect(cardsAwaitingInput(model)).toEqual([]);
  });
});
