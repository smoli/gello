import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { loadBoard, type BoardFile } from "../lib/board";
import { Board } from "./Board";

function file(path: string, content: string): BoardFile {
  return { path, content };
}

function card(
  id: string,
  title: string,
  status: string,
  priority = "normal",
): string {
  return `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\npriority: ${priority}\n---\nbody\n`;
}

const MODEL = loadBoard([
  file("board.yaml", "columns: [backlog, ready, in-progress, review, done]\n"),
  file("inbox/c010-idea.md", card("c010", "Inbox idea", "backlog")),
  file("milestones/m01-alpha/milestone.md", "---\nid: m01\ntitle: Alpha\n---\ngoal\n"),
  file("milestones/m01-alpha/c001-first.md", card("c001", "First card", "ready", "high")),
  file("milestones/m01-alpha/c002-second.md", card("c002", "Second card", "done")),
  file("milestones/m01-alpha/c004-fourth.md", card("c004", "Fourth card", "backlog")),
  file("milestones/m02-beta/milestone.md", "---\nid: m02\ntitle: Beta\n---\ngoal\n"),
  file("milestones/m02-beta/c003-third.md", card("c003", "Third card", "ready")),
]);

function column(name: string) {
  return screen.getByRole("region", { name });
}

describe("Board", () => {
  it("renders the configured columns in order", () => {
    const custom = loadBoard([file("board.yaml", "columns: [todo, doing, shipped]\n")]);
    render(<Board model={custom} />);

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["todo", "doing", "shipped"]);
  });

  it("places milestone cards in the column matching their status", () => {
    render(<Board model={MODEL} />);

    expect(within(column("ready")).getByText("First card")).toBeInTheDocument();
    expect(within(column("ready")).getByText("Third card")).toBeInTheDocument();
    expect(within(column("done")).getByText("Second card")).toBeInTheDocument();
    expect(within(column("backlog")).getByText("Fourth card")).toBeInTheDocument();
  });

  it("renders unprocessed (backlog) inbox cards in the inbox column only", () => {
    render(<Board model={MODEL} />);

    expect(within(column("inbox")).getByText("Inbox idea")).toBeInTheDocument();
    expect(within(column("backlog")).queryByText("Inbox idea")).not.toBeInTheDocument();
  });

  it("renders inbox cards with a non-backlog status in that status column, inbox-badged (c030)", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [discuss, backlog, done]\n"),
      file("inbox/c010-raw.md", card("c010", "Raw idea", "backlog")),
      file("inbox/c011-flagged.md", card("c011", "Flagged idea", "discuss")),
    ]);
    render(<Board model={model} />);

    const discuss = column("discuss");
    expect(within(discuss).getByText("Flagged idea")).toBeInTheDocument();
    expect(within(discuss).getByText("inbox")).toBeInTheDocument();
    expect(within(column("inbox")).queryByText("Flagged idea")).not.toBeInTheDocument();
    expect(within(column("inbox")).getByText("Raw idea")).toBeInTheDocument();
  });

  it("hides the inbox column when every inbox card is flagged elsewhere", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [discuss, backlog]\n"),
      file("inbox/c011-flagged.md", card("c011", "Flagged idea", "discuss")),
    ]);
    render(<Board model={model} />);

    expect(screen.queryByRole("region", { name: "inbox" })).not.toBeInTheDocument();
  });

  it("hides the inbox column when the inbox is empty", () => {
    const noInbox = loadBoard([
      file("board.yaml", "columns: [backlog, done]\n"),
      file("milestones/m01-x/c001-a.md", card("c001", "A", "backlog")),
    ]);
    render(<Board model={noInbox} />);

    expect(screen.queryByRole("region", { name: "inbox" })).not.toBeInTheDocument();
  });

  it("shows id, title, milestone, and priority on the card front", () => {
    render(<Board model={MODEL} />);

    const front = screen.getByText("First card").closest("article");
    expect(front).not.toBeNull();
    expect(within(front!).getByText("c001")).toBeInTheDocument();
    expect(within(front!).getByText("Alpha")).toBeInTheDocument();
    expect(within(front!).getByText("high")).toBeInTheDocument();
  });

  it("labels inbox cards as inbox", () => {
    render(<Board model={MODEL} />);

    const front = screen.getByText("Inbox idea").closest("article");
    expect(within(front!).getByText("inbox")).toBeInTheDocument();
  });

  it("narrows to one milestone via the filter and back to all, inbox unaffected", () => {
    render(<Board model={MODEL} />);
    const filter = screen.getByLabelText("Milestone filter");

    fireEvent.change(filter, { target: { value: "m01-alpha" } });
    expect(screen.getByText("First card")).toBeInTheDocument();
    expect(screen.queryByText("Third card")).not.toBeInTheDocument();
    expect(screen.getByText("Inbox idea")).toBeInTheDocument();

    fireEvent.change(filter, { target: { value: "all" } });
    expect(screen.getByText("Third card")).toBeInTheDocument();
    expect(screen.getByText("Inbox idea")).toBeInTheDocument();
  });

  it("renders empty columns with a zero count instead of hiding them", () => {
    render(<Board model={MODEL} />);

    const inProgress = column("in-progress");
    expect(within(inProgress).getByText("0")).toBeInTheDocument();
    expect(within(inProgress).queryByRole("article")).not.toBeInTheDocument();
  });

  it("renders an entirely empty board without crashing", () => {
    render(<Board model={loadBoard([])} />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
  });
});

describe("needs-attention lane", () => {
  const MODEL_WITH_INVALID = loadBoard([
    file("board.yaml", "columns: [backlog, done]\n"),
    file("inbox/c001-fine.md", card("c001", "Fine card", "backlog")),
    file("inbox/c002-broken.md", "---\nid: [unclosed\n---\nbody\n"),
    file(
      "milestones/m01-x/c003-bad-status.md",
      "---\nid: c003\ntitle: Bad status\nstatus: wip\n---\nraw card text here\n",
    ),
  ]);

  it("lists invalid files with path and reason", () => {
    render(<Board model={MODEL_WITH_INVALID} />);

    const lane = screen.getByRole("region", { name: "needs attention" });
    expect(within(lane).getByText("inbox/c002-broken.md")).toBeInTheDocument();
    expect(within(lane).getByText(/yaml/i)).toBeInTheDocument();
    expect(
      within(lane).getByText("milestones/m01-x/c003-bad-status.md"),
    ).toBeInTheDocument();
    expect(within(lane).getByText(/unknown status "wip"/)).toBeInTheDocument();
  });

  it("is absent when every file parses", () => {
    render(<Board model={MODEL} />);

    expect(
      screen.queryByRole("region", { name: "needs attention" }),
    ).not.toBeInTheDocument();
  });

  it("reveals the raw file content on demand", () => {
    render(<Board model={MODEL_WITH_INVALID} />);
    const lane = screen.getByRole("region", { name: "needs attention" });

    expect(within(lane).queryByText(/raw card text here/)).not.toBeInTheDocument();
    const toggles = within(lane).getAllByRole("button", { name: /show file/i });
    fireEvent.click(toggles[1]);

    expect(within(lane).getByText(/raw card text here/)).toBeInTheDocument();
  });
});

function fakeDataTransfer() {
  const data: Record<string, string> = {};
  return {
    setData: (type: string, value: string) => {
      data[type] = value;
    },
    getData: (type: string) => data[type] ?? "",
    dropEffect: "",
    effectAllowed: "",
  };
}

describe("Board card moves", () => {
  it("fires onMoveCard when a card is dropped on another column", () => {
    const onMove = vi.fn();
    render(<Board model={MODEL} onMoveCard={onMove} />);
    const card = screen.getByText("First card").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(column("done"), { dataTransfer });
    fireEvent.drop(column("done"), { dataTransfer });

    expect(onMove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c001", status: "ready" }),
      "done",
    );
  });

  it("ignores a drop on the card's own column", () => {
    const onMove = vi.fn();
    render(<Board model={MODEL} onMoveCard={onMove} />);
    const card = screen.getByText("First card").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(column("ready"), { dataTransfer });

    expect(onMove).not.toHaveBeenCalled();
  });

  it("moves a focused card with arrow keys", () => {
    const onMove = vi.fn();
    render(<Board model={MODEL} onMoveCard={onMove} />);
    const card = screen.getByText("First card").closest("article")!;

    fireEvent.keyDown(card, { key: "ArrowRight" });
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "c001" }),
      "in-progress",
    );

    fireEvent.keyDown(card, { key: "ArrowLeft" });
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "c001" }),
      "backlog",
    );
  });

  it("does not move past the first or last column", () => {
    const onMove = vi.fn();
    render(<Board model={MODEL} onMoveCard={onMove} />);

    const backlogCard = screen.getByText("Fourth card").closest("article")!;
    fireEvent.keyDown(backlogCard, { key: "ArrowLeft" });

    const doneCard = screen.getByText("Second card").closest("article")!;
    fireEvent.keyDown(doneCard, { key: "ArrowRight" });

    expect(onMove).not.toHaveBeenCalled();
  });

  it("moves an inbox card to a status column by drag — no milestone needed (c030)", () => {
    const onMove = vi.fn();
    render(<Board model={MODEL} onMoveCard={onMove} />);
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    expect(inboxCard).toHaveAttribute("draggable", "true");
    fireEvent.dragStart(inboxCard, { dataTransfer });
    fireEvent.drop(column("in-progress"), { dataTransfer });

    expect(onMove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c010", milestone: null }),
      "in-progress",
    );
  });

  it("moves an inbox card by keyboard from its status position", () => {
    const onMove = vi.fn();
    render(<Board model={MODEL} onMoveCard={onMove} />);
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;

    // status backlog (leftmost in this fixture); ArrowRight = next column
    fireEvent.keyDown(inboxCard, { key: "ArrowRight" });

    expect(onMove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c010" }),
      "ready",
    );
  });

  it("shows milestone drop zones while dragging an unprocessed inbox card (c028)", () => {
    render(<Board model={MODEL} onTriageCard={vi.fn()} />);
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    expect(
      screen.queryByRole("region", { name: "assign to milestone" }),
    ).not.toBeInTheDocument();

    fireEvent.dragStart(inboxCard, { dataTransfer });
    const strip = screen.getByRole("region", { name: "assign to milestone" });
    expect(within(strip).getByText("Alpha")).toBeInTheDocument();
    expect(within(strip).getByText("Beta")).toBeInTheDocument();

    fireEvent.dragEnd(inboxCard);
    expect(
      screen.queryByRole("region", { name: "assign to milestone" }),
    ).not.toBeInTheDocument();
  });

  it("shows the strip for discuss-status inbox cards, but not ready-status or milestone cards", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [discuss, backlog, ready, done]\n"),
      file("inbox/c011-flagged.md", card("c011", "Discussing idea", "discuss")),
      file("inbox/c012-queued.md", card("c012", "Queued idea", "ready")),
      file("milestones/m01-alpha/milestone.md", "---\nid: m01\ntitle: Alpha\n---\ngoal\n"),
      file("milestones/m01-alpha/c001-first.md", card("c001", "Milestone card", "ready")),
    ]);
    render(<Board model={model} onTriageCard={vi.fn()} />);
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(screen.getByText("Discussing idea").closest("article")!, { dataTransfer });
    expect(screen.getByRole("region", { name: "assign to milestone" })).toBeInTheDocument();
    fireEvent.dragEnd(screen.getByText("Discussing idea").closest("article")!);

    fireEvent.dragStart(screen.getByText("Queued idea").closest("article")!, { dataTransfer });
    expect(
      screen.queryByRole("region", { name: "assign to milestone" }),
    ).not.toBeInTheDocument();
    fireEvent.dragEnd(screen.getByText("Queued idea").closest("article")!);

    fireEvent.dragStart(screen.getByText("Milestone card").closest("article")!, { dataTransfer });
    expect(
      screen.queryByRole("region", { name: "assign to milestone" }),
    ).not.toBeInTheDocument();
  });

  it("shows no strip when the board has no milestones", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, done]\n"),
      file("inbox/c010-idea.md", card("c010", "Lonely idea", "backlog")),
    ]);
    render(<Board model={model} onTriageCard={vi.fn()} />);

    fireEvent.dragStart(screen.getByText("Lonely idea").closest("article")!, {
      dataTransfer: fakeDataTransfer(),
    });

    expect(
      screen.queryByRole("region", { name: "assign to milestone" }),
    ).not.toBeInTheDocument();
  });

  it("dropping on a milestone zone triages the card, keeping its status", () => {
    const onTriage = vi.fn();
    render(<Board model={MODEL} onTriageCard={onTriage} />);
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(inboxCard, { dataTransfer });
    const strip = screen.getByRole("region", { name: "assign to milestone" });
    const zone = within(strip).getByText("Beta").closest("div")!;
    fireEvent.dragOver(zone, { dataTransfer });
    fireEvent.drop(zone, { dataTransfer });

    expect(onTriage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c010", status: "backlog" }),
      "m02-beta",
      "m02",
    );
  });

  it("status columns remain drop targets during an inbox drag", () => {
    const onMove = vi.fn();
    render(<Board model={MODEL} onMoveCard={onMove} onTriageCard={vi.fn()} />);
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(inboxCard, { dataTransfer });
    expect(screen.getByRole("region", { name: "assign to milestone" })).toBeInTheDocument();
    fireEvent.drop(column("in-progress"), { dataTransfer });

    expect(onMove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c010" }),
      "in-progress",
    );
  });

  it("inbox cards stay selectable", () => {
    const onSelect = vi.fn();
    render(<Board model={MODEL} onSelectCard={onSelect} />);

    fireEvent.click(screen.getByText("Inbox idea").closest("article")!);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c010" }),
    );
  });

  it("selects a card on click or Enter", () => {
    const onSelect = vi.fn();
    render(<Board model={MODEL} onSelectCard={onSelect} />);
    const card = screen.getByText("First card").closest("article")!;

    fireEvent.click(card);
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "c001" }),
    );

    fireEvent.keyDown(card, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("marks cards as draggable and focusable", () => {
    render(<Board model={MODEL} onMoveCard={vi.fn()} />);
    const card = screen.getByText("First card").closest("article")!;

    expect(card).toHaveAttribute("draggable", "true");
    expect(card).toHaveAttribute("tabindex", "0");
  });
});
