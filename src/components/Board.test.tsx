import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  file("board.yaml", "columns: [inbox, backlog, ready, in-progress, review, done]\n"),
  // c0088: an unassigned card is a standalone card with status: inbox
  file("cards/c010-idea.md", card("c010", "Inbox idea", "inbox")),
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
  it("c0100: shows a needs-input badge on a card parked with awaiting: input", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, in-progress, done]\n"),
      file(
        "cards/c001-parked.md",
        "---\nid: c001\ntitle: Parked card\nstatus: in-progress\nawaiting: input\n---\nbody\n",
      ),
      file(
        "cards/c002-plain.md",
        "---\nid: c002\ntitle: Plain card\nstatus: in-progress\n---\nbody\n",
      ),
    ]);
    render(<Board model={model} />);

    const parked = screen.getByText("Parked card").closest("article")!;
    expect(within(parked).getByRole("status", { name: "Needs input" })).toBeInTheDocument();

    const plain = screen.getByText("Plain card").closest("article")!;
    expect(within(plain).queryByRole("status", { name: "Needs input" })).not.toBeInTheDocument();
  });

  it("renders the configured columns in order", () => {
    const custom = loadBoard([file("board.yaml", "columns: [todo, doing, shipped]\n")]);
    render(<Board model={custom} />);

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["todo", "doing", "shipped"]);
  });

  it("c012: shows a thumbnail of the first body image on the card front", async () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, done]\n"),
      file("milestones/m01-a/milestone.md", "---\nid: m01\ntitle: A\n---\ng\n"),
      file(
        "milestones/m01-a/c001-shot.md",
        "---\nid: c001\ntitle: Has image\nstatus: backlog\nmilestone: m01\n---\n\n![p](../../assets/c001/p.png)\n",
      ),
    ]);
    const loadImage = vi.fn().mockResolvedValue("data:image/png;base64,QUJD");
    render(<Board model={model} loadImage={loadImage} />);

    await waitFor(() => {
      const card = screen.getByText("Has image").closest("article")!;
      const img = card.querySelector("img.card-thumb") as HTMLImageElement | null;
      expect(img?.src).toBe("data:image/png;base64,QUJD");
    });
    expect(loadImage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c001" }),
      "../../assets/c001/p.png",
    );
  });

  it("c012: no thumbnail for a card without images", () => {
    render(<Board model={MODEL} loadImage={vi.fn()} />);
    const card = screen.getByText("First card").closest("article")!;
    expect(card.querySelector("img.card-thumb")).toBeNull();
  });

  it("places milestone cards in the column matching their status", () => {
    render(<Board model={MODEL} />);

    expect(within(column("ready")).getByText("First card")).toBeInTheDocument();
    expect(within(column("ready")).getByText("Third card")).toBeInTheDocument();
    expect(within(column("done")).getByText("Second card")).toBeInTheDocument();
    expect(within(column("backlog")).getByText("Fourth card")).toBeInTheDocument();
  });

  it("c0088: renders inbox-status cards in the inbox column", () => {
    render(<Board model={MODEL} />);

    expect(within(column("inbox")).getByText("Inbox idea")).toBeInTheDocument();
    expect(within(column("backlog")).queryByText("Inbox idea")).not.toBeInTheDocument();
  });

  it("c0088: the inbox column is a normal column — always present, even when empty", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [inbox, backlog, done]\n"),
      file("cards/c001-a.md", card("c001", "A", "backlog")),
    ]);
    render(<Board model={model} />);

    // inbox renders as a configured column with no cards
    expect(screen.getByRole("region", { name: "inbox" })).toBeInTheDocument();
    expect(within(column("backlog")).getByText("A")).toBeInTheDocument();
  });

  it("shows id, title, and milestone on the card front", () => {
    render(<Board model={MODEL} />);

    const front = screen.getByText("First card").closest("article");
    expect(front).not.toBeNull();
    expect(within(front!).getByText("c001")).toBeInTheDocument();
    expect(within(front!).getByText("Alpha")).toBeInTheDocument();
  });

  it("c0086: an inbox-status standalone card has no epic/inbox label", () => {
    render(<Board model={MODEL} />);

    const front = screen.getByText("Inbox idea").closest("article");
    expect(within(front!).queryByText("inbox")).not.toBeInTheDocument();
  });

  it("c0088: narrows to one epic via the filter and back to all", () => {
    render(<Board model={MODEL} />);
    const filter = screen.getByLabelText("Epic filter");

    fireEvent.change(filter, { target: { value: "m01-alpha" } });
    expect(screen.getByText("First card")).toBeInTheDocument();
    expect(screen.queryByText("Third card")).not.toBeInTheDocument();
    // a standalone inbox card is filtered out with everything non-matching
    expect(screen.queryByText("Inbox idea")).not.toBeInTheDocument();

    fireEvent.change(filter, { target: { value: "all" } });
    expect(screen.getByText("Third card")).toBeInTheDocument();
    expect(screen.getByText("Inbox idea")).toBeInTheDocument();
  });

  it("c0077: renders standalone cards (no epic label) and the No-epic filter isolates them", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, done]\n"),
      file("epics/e01-x/epic.md", "---\nid: e01\ntitle: Alpha\n---\ng\n"),
      file("epics/e01-x/c001-a.md", card("c001", "Epic card", "backlog")),
      file("cards/c002-b.md", card("c002", "Loose card", "backlog")),
    ]);
    render(<Board model={model} />);

    // standalone card renders in its status column, with no epic/inbox label
    const loose = screen.getByText("Loose card").closest("article")!;
    expect(within(column("backlog")).getByText("Loose card")).toBeInTheDocument();
    expect(within(loose).queryByText("inbox")).not.toBeInTheDocument();
    expect(within(loose).queryByText("Alpha")).not.toBeInTheDocument();

    // "No epic" filter shows only the standalone card
    fireEvent.change(screen.getByLabelText("Epic filter"), {
      target: { value: "no-epic" },
    });
    expect(screen.getByText("Loose card")).toBeInTheDocument();
    expect(screen.queryByText("Epic card")).not.toBeInTheDocument();
  });

  it("c0077: no No-epic option when there are no standalone cards", () => {
    // a board whose only cards are epic-assigned (no standalone cards/)
    const model = loadBoard([
      file("board.yaml", "columns: [inbox, backlog, done]\n"),
      file("epics/e01-x/epic.md", "---\nid: e01\ntitle: Alpha\n---\ng\n"),
      file("epics/e01-x/c001-a.md", card("c001", "Epic card", "backlog")),
    ]);
    render(<Board model={model} />);
    expect(
      within(screen.getByLabelText("Epic filter")).queryByText("No epic"),
    ).not.toBeInTheDocument();
  });

  it("renders empty columns with a zero count instead of hiding them", () => {
    render(<Board model={MODEL} />);

    const inProgress = column("in-progress");
    expect(within(inProgress).getByText("0")).toBeInTheDocument();
    expect(within(inProgress).queryByRole("article")).not.toBeInTheDocument();
  });

  it("renders an entirely empty board without crashing", () => {
    render(<Board model={loadBoard([])} />);

    // c0088: lead with inbox; i0033: discuss ships by default (7 columns)
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(7);
  });

  it("applies a background with readable translucent columns (c047/c0060)", () => {
    const { container } = render(
      <Board model={MODEL} background="url(data:image/png;base64,xyz)" />,
    );

    const board = container.querySelector(".board")!;
    expect(board).toHaveClass("board-with-bg");
    // longhand so .board-with-bg's cover/center/no-repeat survives (c0060)
    expect((board as HTMLElement).style.backgroundImage).toContain(
      "data:image/png;base64,xyz",
    );
  });

  it("fires the background context menu from a column track, not from a card (c0060)", () => {
    const onBg = vi.fn();
    const { container } = render(
      <Board model={MODEL} onBackgroundContextMenu={onBg} />,
    );

    // right-click the empty track area → menu; a card → no menu
    fireEvent.contextMenu(container.querySelector(".column-track")!);
    expect(onBg).toHaveBeenCalledTimes(1);

    fireEvent.contextMenu(screen.getByText("First card").closest("article")!);
    expect(onBg).toHaveBeenCalledTimes(1); // unchanged — card falls through
  });

  it("turns on the translucent-column treatment for a color/gradient too (c0060)", () => {
    // (jsdom CSSOM drops gradient shorthands; the image case above covers the
    // style path — here we assert the readable-columns class triggers.)
    const { container } = render(
      <Board model={MODEL} background="linear-gradient(90deg, #aa0000, #0000bb)" />,
    );
    expect(container.querySelector(".board")).toHaveClass("board-with-bg");
  });

  it("renders without background styling when none is set", () => {
    const { container } = render(<Board model={MODEL} />);

    expect(container.querySelector(".board")).not.toHaveClass("board-with-bg");
  });

  // c046's point — global column order, never milestone-grouped — survives
  // c056, which swapped the rule from priority/id to per-column sorting.
  it("orders a column globally across milestones (c046/c056)", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, done]\n"),
      file("milestones/m01-a/milestone.md", "---\nid: m01\ntitle: A\n---\ng\n"),
      file("milestones/m01-a/c001-a-normal.md", card("c001", "A normal", "backlog", "normal")),
      file("milestones/m01-a/c004-a-low.md", card("c004", "A low", "backlog", "low")),
      file("milestones/m02-b/milestone.md", "---\nid: m02\ntitle: B\n---\ng\n"),
      file("milestones/m02-b/c002-b-high.md", card("c002", "B high", "backlog", "high")),
      file("milestones/m02-b/c003-b-normal.md", card("c003", "B normal", "backlog", "normal")),
    ]);
    render(<Board model={model} />);

    const ids = within(column("backlog"))
      .getAllByRole("article")
      .map((el) => el.getAttribute("aria-label")!.split(":")[0]);

    // NOT milestone-grouped (c001, c004, c002, c003) — globally sorted
    // (c056 manual column, no ranks → created/id; priority is ignored):
    expect(ids).toEqual(["c001", "c002", "c003", "c004"]);
  });
});

describe("fulltext search (c022)", () => {
  const SEARCH_MODEL = loadBoard([
    file("board.yaml", "columns: [backlog, done]\n"),
    file("cards/c010-idea.md", card("c010", "Dark mode toggle", "backlog")),
    file("milestones/m01-a/milestone.md", "---\nid: m01\ntitle: Alpha\n---\ng\n"),
    file(
      "milestones/m01-a/c001-dnd.md",
      "---\nid: c001\ntitle: Drag and drop\nstatus: backlog\ntags: [ui]\n---\nkanban board\n",
    ),
    file("milestones/m01-a/c002-done.md", card("c002", "Archived thing", "done")),
  ]);

  // c0066: the search box moved to the top bar; the board filters by a `query`
  // prop. Input behaviors (Escape-clear, Cmd+F focus) live in TitleBar.test.

  it("filters cards in place by query, across columns and done", () => {
    render(<Board model={SEARCH_MODEL} query="kanban" />);
    expect(screen.getByText("Drag and drop")).toBeInTheDocument();
    expect(screen.queryByText("Dark mode toggle")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived thing")).not.toBeInTheDocument();
  });

  it("searches done cards too", () => {
    render(<Board model={SEARCH_MODEL} query="archived" />);
    expect(screen.getByText("Archived thing")).toBeInTheDocument();
    expect(screen.queryByText("Drag and drop")).not.toBeInTheDocument();
  });

  it("reflects the filtered set in column counts", () => {
    render(<Board model={SEARCH_MODEL} query="kanban" />);
    // backlog now shows only 1 of its cards
    expect(within(column("backlog")).getByText("1")).toBeInTheDocument();
  });

  it("an empty query shows the full board", () => {
    const { rerender } = render(<Board model={SEARCH_MODEL} query="kanban" />);
    expect(screen.queryByText("Dark mode toggle")).not.toBeInTheDocument();

    rerender(<Board model={SEARCH_MODEL} query="" />);
    expect(screen.getByText("Dark mode toggle")).toBeInTheDocument();
    expect(screen.getByText("Archived thing")).toBeInTheDocument();
  });

  it("composes with the milestone filter (AND)", () => {
    // "board" matches c001 (body) which is in m01-a
    render(<Board model={SEARCH_MODEL} query="board" />);
    fireEvent.change(screen.getByLabelText("Epic filter"), {
      target: { value: "inbox" },
    });
    // c001 matches the query but is filtered out by the inbox milestone filter
    expect(screen.queryByText("Drag and drop")).not.toBeInTheDocument();
  });
});

describe("card types on the board (c024)", () => {
  const TYPED_MODEL = loadBoard([
    file("board.yaml", "columns: [backlog, done]\n"),
    file("milestones/m01-x/milestone.md", "---\nid: m01\ntitle: Alpha\n---\ngoal\n"),
    file("milestones/m01-x/c001-task.md", card("c001", "Plain task", "backlog")),
    file(
      "milestones/m01-x/c002-issue.md",
      "---\nid: c002\ntitle: A issue\nstatus: backlog\ntype: issue\nref: c001\n---\nx\n",
    ),
  ]);

  it("shows a type badge on non-task cards only", () => {
    render(<Board model={TYPED_MODEL} />);

    const issueCard = screen.getByText("A issue").closest("article")!;
    expect(within(issueCard).getByText("issue")).toBeInTheDocument();
    const taskCard = screen.getByText("Plain task").closest("article")!;
    expect(within(taskCard).queryByText("task")).not.toBeInTheDocument();
  });

  it("filters by type", () => {
    render(<Board model={TYPED_MODEL} />);
    const filter = screen.getByLabelText("Type filter");

    fireEvent.change(filter, { target: { value: "issue" } });
    expect(screen.getByText("A issue")).toBeInTheDocument();
    expect(screen.queryByText("Plain task")).not.toBeInTheDocument();

    fireEvent.change(filter, { target: { value: "all" } });
    expect(screen.getByText("Plain task")).toBeInTheDocument();
  });

  it("applies the type filter to the inbox column too (c036)", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, done]\n"),
      file("cards/c010-idea.md", card("c010", "Inbox task", "backlog")),
      file(
        "cards/c011-issue.md",
        "---\nid: c011\ntitle: Inbox issue\nstatus: backlog\ntype: issue\n---\nx\n",
      ),
    ]);
    render(<Board model={model} />);

    fireEvent.change(screen.getByLabelText("Type filter"), {
      target: { value: "issue" },
    });

    expect(screen.getByText("Inbox issue")).toBeInTheDocument();
    expect(screen.queryByText("Inbox task")).not.toBeInTheDocument();
  });
});

describe("needs-attention lane", () => {
  const MODEL_WITH_INVALID = loadBoard([
    file("board.yaml", "columns: [backlog, done]\n"),
    file("cards/c001-fine.md", card("c001", "Fine card", "backlog")),
    file("cards/c002-broken.md", "---\nid: [unclosed\n---\nbody\n"),
    file(
      "milestones/m01-x/c003-bad-status.md",
      "---\nid: c003\ntitle: Bad status\nstatus: wip\n---\nraw card text here\n",
    ),
  ]);

  it("lists invalid files with path and reason", () => {
    render(<Board model={MODEL_WITH_INVALID} />);

    const lane = screen.getByRole("region", { name: "needs attention" });
    expect(within(lane).getByText("cards/c002-broken.md")).toBeInTheDocument();
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

  it("i0034: offers 'Fix duplicate keys' only for a duplicate-key card", () => {
    const onRepairDuplicates = vi.fn();
    const model = loadBoard([
      file("board.yaml", "columns: [backlog]\n"),
      file(
        "cards/c001-dup.md",
        "---\nid: c001\ntitle: Dup\nstatus: backlog\nstatus-changed: a\nstatus-changed: b\n---\nx\n",
      ),
      file("cards/c002-broken.md", "---\nid: [unclosed\n---\nbody\n"),
    ]);
    render(<Board model={model} onRepairDuplicates={onRepairDuplicates} />);
    const lane = screen.getByRole("region", { name: "needs attention" });

    // only one entry (the dup-key one) gets a repair button
    const repair = within(lane).getAllByRole("button", { name: /fix duplicate keys/i });
    expect(repair).toHaveLength(1);

    fireEvent.click(repair[0]);
    expect(onRepairDuplicates).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ path: "cards/c001-dup.md" }),
    );
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

    // inbox is the first column now
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    fireEvent.keyDown(inboxCard, { key: "ArrowLeft" });

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
      expect.objectContaining({ id: "c010", epic: null }),
      "in-progress",
    );
  });

  it("i0015: a positioned insert-zone drop of an inbox card opens the picker WITH the slot order", () => {
    const onMove = vi.fn();
    const onInboxStatusDrop = vi.fn();
    render(
      <Board
        model={MODEL}
        onMoveCard={onMove}
        onReorderCard={vi.fn()}
        onRenumber={vi.fn()}
        onInboxStatusDrop={onInboxStatusDrop}
      />,
    );
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    const dataTransfer = fakeDataTransfer();
    fireEvent.dragStart(inboxCard, { dataTransfer });

    // drop on a specific insert zone in the ready column (not the track)
    const ready = column("ready");
    const zone = within(ready)
      .getAllByLabelText(/insert at/)
      .find((z) => !z.className.includes("muted"))!;
    fireEvent.drop(zone, { dataTransfer });

    // still prompts for a milestone, but carries the chosen slot so pick/dismiss
    // can place the card there instead of at the bottom
    expect(onMove).not.toHaveBeenCalled();
    expect(onInboxStatusDrop).toHaveBeenCalledTimes(1);
    expect(onInboxStatusDrop.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: "c010" }),
    );
    expect(onInboxStatusDrop.mock.calls[0][1]).toBe("ready");
    expect(typeof onInboxStatusDrop.mock.calls[0][2]).toBe("number");
  });

  it("i0005: routes a milestone-less inbox card dropped on ready to the milestone picker", () => {
    const onMove = vi.fn();
    const onInboxStatusDrop = vi.fn();
    render(
      <Board model={MODEL} onMoveCard={onMove} onInboxStatusDrop={onInboxStatusDrop} />,
    );
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(inboxCard, { dataTransfer });
    fireEvent.drop(column("ready"), { dataTransfer });

    expect(onInboxStatusDrop).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c010", epic: null }),
      "ready",
    );
    expect(onMove).not.toHaveBeenCalled();
  });

  it("i0014: prompts for a milestone when a backlog inbox card is dropped on backlog", () => {
    // the inbox card is already `backlog` (it lives in the inbox column); the
    // meaningful gesture is still to triage it, so the picker must appear
    const onMove = vi.fn();
    const onInboxStatusDrop = vi.fn();
    render(
      <Board model={MODEL} onMoveCard={onMove} onInboxStatusDrop={onInboxStatusDrop} />,
    );
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(inboxCard, { dataTransfer });
    fireEvent.drop(column("backlog"), { dataTransfer });

    expect(onInboxStatusDrop).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c010", epic: null }),
      "backlog",
    );
    expect(onMove).not.toHaveBeenCalled();
  });

  it("c0090: prompts for an epic when a no-epic inbox card leaves inbox for ANY column", () => {
    const onMove = vi.fn();
    const onInboxStatusDrop = vi.fn();
    render(
      <Board model={MODEL} onMoveCard={onMove} onInboxStatusDrop={onInboxStatusDrop} />,
    );
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    // in-progress is not a "triage column" in the old sense, but leaving inbox
    // unassigned still prompts (the epic prompt fires on any inbox exit)
    fireEvent.dragStart(inboxCard, { dataTransfer });
    fireEvent.drop(column("in-progress"), { dataTransfer });

    expect(onInboxStatusDrop).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c010", epic: null }),
      "in-progress",
    );
    expect(onMove).not.toHaveBeenCalled();
  });

  it("i0005: does not prompt for a milestone card dropped on ready", () => {
    const onMove = vi.fn();
    const onInboxStatusDrop = vi.fn();
    render(
      <Board model={MODEL} onMoveCard={onMove} onInboxStatusDrop={onInboxStatusDrop} />,
    );
    // c004 "Fourth card" is a milestone card at backlog; drop it on ready
    const milestoneCard = screen.getByText("Fourth card").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(milestoneCard, { dataTransfer });
    fireEvent.drop(column("ready"), { dataTransfer });

    expect(onInboxStatusDrop).not.toHaveBeenCalled();
    expect(onMove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c004" }),
      "ready",
    );
  });

  it("moves an inbox card by keyboard from its status position", () => {
    const onMove = vi.fn();
    render(<Board model={MODEL} onMoveCard={onMove} />);
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;

    // status inbox (leftmost column); ArrowRight = next column (backlog)
    fireEvent.keyDown(inboxCard, { key: "ArrowRight" });

    expect(onMove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c010" }),
      "backlog",
    );
  });

  it("marks the dragged card's origin while dragging (i0004)", () => {
    render(<Board model={MODEL} onMoveCard={vi.fn()} />);
    const card = screen.getByText("First card").closest("article")!;

    expect(card).not.toHaveClass("card-origin");
    fireEvent.dragStart(card, { dataTransfer: fakeDataTransfer() });
    expect(card).toHaveClass("card-origin");
    fireEvent.dragEnd(card);
    expect(card).not.toHaveClass("card-origin");
  });

  it("marks the board while dragging so drop lanes can render feedback (c054)", () => {
    const { container } = render(<Board model={MODEL} onMoveCard={vi.fn()} />);
    const card = screen.getByText("First card").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    expect(container.querySelector(".board")).not.toHaveClass("board-dragging");
    fireEvent.dragStart(card, { dataTransfer });
    expect(container.querySelector(".board")).toHaveClass("board-dragging");
    fireEvent.dragEnd(card);
    expect(container.querySelector(".board")).not.toHaveClass("board-dragging");
  });

  it("c0108: highlights the column the pointer is over during a drag", () => {
    const { container } = render(<Board model={MODEL} onMoveCard={vi.fn()} />);
    const card = screen.getByText("First card").closest("article")!;
    const dataTransfer = fakeDataTransfer();
    const track = (name: string) => column(name).closest(".column-track")!;

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(track("done"), { dataTransfer });
    expect(track("done")).toHaveClass("column-track-over");
    expect(track("ready")).not.toHaveClass("column-track-over");

    // moving to another column moves the highlight with the pointer
    fireEvent.dragOver(track("in-progress"), { dataTransfer });
    expect(track("in-progress")).toHaveClass("column-track-over");
    expect(track("done")).not.toHaveClass("column-track-over");

    // the highlight clears when the drag ends
    fireEvent.dragEnd(card);
    expect(container.querySelector(".column-track-over")).toBeNull();
  });

  it("c0108: clears the over-column highlight after a drop", () => {
    const { container } = render(<Board model={MODEL} onMoveCard={vi.fn()} />);
    const card = screen.getByText("First card").closest("article")!;
    const dataTransfer = fakeDataTransfer();
    const track = column("done").closest(".column-track")!;

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(track, { dataTransfer });
    expect(track).toHaveClass("column-track-over");
    fireEvent.drop(track, { dataTransfer });
    expect(container.querySelector(".column-track-over")).toBeNull();
  });

  it("accepts drops on the full-height track below a short column (c052)", () => {
    const onMove = vi.fn();
    const { container } = render(<Board model={MODEL} onMoveCard={onMove} />);
    const card = screen.getByText("First card").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    // the done column's track (the area below the visible column)
    const track = column("done").closest(".column-track")!;
    fireEvent.dragOver(track, { dataTransfer });
    fireEvent.drop(track, { dataTransfer });

    expect(onMove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "c001" }),
      "done",
    );
    expect(container.querySelectorAll(".column-track").length).toBeGreaterThan(0);
  });

  it("status columns remain drop targets during an inbox drag", () => {
    const onMove = vi.fn();
    render(<Board model={MODEL} onMoveCard={onMove} />);
    const inboxCard = screen.getByText("Inbox idea").closest("article")!;
    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(inboxCard, { dataTransfer });
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

describe("manual column insertion (c056)", () => {
  function rankedCard(id: string, title: string, status: string, order?: number): string {
    const orderLine = order === undefined ? "" : `order: ${order}\n`;
    return `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\n${orderLine}---\nbody\n`;
  }

  const RANKED_MODEL = loadBoard([
    file("board.yaml", "columns: [backlog, ready, in-progress, review, done]\n"),
    file("milestones/m01-a/milestone.md", "---\nid: m01\ntitle: A\n---\ng\n"),
    file("milestones/m01-a/c001-b1.md", rankedCard("c001", "Backlog one", "backlog", 10)),
    file("milestones/m01-a/c002-b2.md", rankedCard("c002", "Backlog two", "backlog", 20)),
    file("milestones/m01-a/c003-r1.md", rankedCard("c003", "Ready one", "ready", 10)),
    file("milestones/m01-a/c004-r2.md", rankedCard("c004", "Ready two", "ready", 20)),
    file("milestones/m01-a/c005-r3.md", rankedCard("c005", "Ready three", "ready", 30)),
    file("milestones/m01-a/c006-ip.md", rankedCard("c006", "Working", "in-progress")),
  ]);

  it("mounts insert zones in manual columns always, none elsewhere (i0003)", () => {
    // i0003: zones are always in the DOM so dragstart never mutates the tree
    // next to the drag source (which aborts the native drag in WKWebView).
    // Their appearance/interactivity is driven by the board-dragging class.
    render(<Board model={RANKED_MODEL} />);

    // present before any drag — zones = card count + 1 per manual column
    expect(within(column("ready")).getAllByLabelText(/insert at/)).toHaveLength(4);
    expect(within(column("backlog")).getAllByLabelText(/insert at/)).toHaveLength(3);
    expect(within(column("in-progress")).queryAllByLabelText(/insert at/)).toHaveLength(0);

    // still present after a drag ends — never mounted/unmounted by the drag
    const cardEl = screen.getByText("Ready three").closest("article")!;
    fireEvent.dragStart(cardEl, { dataTransfer: fakeDataTransfer() });
    fireEvent.dragEnd(cardEl);
    expect(within(column("ready")).getAllByLabelText(/insert at/)).toHaveLength(4);
  });

  it("reorders within a column: midpoint rank, single card write", () => {
    const onReorder = vi.fn();
    render(<Board model={RANKED_MODEL} onReorderCard={onReorder} />);
    const dataTransfer = fakeDataTransfer();
    fireEvent.dragStart(screen.getByText("Ready three").closest("article")!, {
      dataTransfer,
    });
    // zone 1 = between Ready one (10) and Ready two (20)
    const zone = within(column("ready")).getByLabelText("insert at 1");
    fireEvent.dragOver(zone, { dataTransfer });
    fireEvent.drop(zone, { dataTransfer });

    expect(onReorder).toHaveBeenCalledTimes(1);
    const [card, order] = onReorder.mock.calls[0];
    expect(card.id).toBe("c005");
    expect(order).toBe(15);
  });

  it("mutes the zones flanking the dragged card — dropping there is a no-op (i0006)", () => {
    const onReorder = vi.fn();
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, ready, in-progress, review, done]\n"),
      file("milestones/m01-a/milestone.md", "---\nid: m01\ntitle: A\n---\ng\n"),
      file("milestones/m01-a/c003-r1.md", rankedCard("c003", "Ready one", "ready", 10)),
      file("milestones/m01-a/c004-r2.md", rankedCard("c004", "Ready two", "ready", 20)),
      file("milestones/m01-a/c005-r3.md", rankedCard("c005", "Ready three", "ready", 30)),
    ]);
    render(<Board model={model} onReorderCard={onReorder} />);
    // Ready two is at index 1; zones 1 (above) and 2 (below) flank it
    fireEvent.dragStart(screen.getByText("Ready two").closest("article")!, {
      dataTransfer: fakeDataTransfer(),
    });

    // one synchronous read of every zone's class after dragstart
    const muted = within(column("ready"))
      .getAllByLabelText(/insert at/)
      .map((z) => z.className.includes("insert-zone-muted"));
    // zones 1 and 2 flank the dragged card → muted; 0 and 3 → not
    expect(muted).toEqual([false, true, true, false]);
  });

  it("a positioned drop from another column moves with a rank", () => {
    const onMove = vi.fn();
    render(<Board model={RANKED_MODEL} onMoveCard={onMove} />);
    const dataTransfer = fakeDataTransfer();
    fireEvent.dragStart(screen.getByText("Working").closest("article")!, {
      dataTransfer,
    });
    const zone = within(column("backlog")).getByLabelText("insert at 1");
    fireEvent.drop(zone, { dataTransfer });

    expect(onMove).toHaveBeenCalledTimes(1);
    const [card, status, order] = onMove.mock.calls[0];
    expect(card.id).toBe("c006");
    expect(status).toBe("backlog");
    expect(order).toBe(15);
  });

  it("renumbers unranked neighbors so the position sticks", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, ready, in-progress, review, done]\n"),
      file("milestones/m01-a/milestone.md", "---\nid: m01\ntitle: A\n---\ng\n"),
      file("milestones/m01-a/c001-u1.md", rankedCard("c001", "Unranked one", "backlog")),
      file("milestones/m01-a/c002-u2.md", rankedCard("c002", "Unranked two", "backlog")),
      file("milestones/m01-a/c003-r.md", rankedCard("c003", "Ready card", "ready", 10)),
    ]);
    const onMove = vi.fn();
    const onRenumber = vi.fn();
    render(<Board model={model} onMoveCard={onMove} onRenumber={onRenumber} />);
    const dataTransfer = fakeDataTransfer();
    fireEvent.dragStart(screen.getByText("Ready card").closest("article")!, {
      dataTransfer,
    });
    const zone = within(column("backlog")).getByLabelText("insert at 1");
    fireEvent.drop(zone, { dataTransfer });

    expect(onRenumber).toHaveBeenCalledTimes(1);
    const ranks = onRenumber.mock.calls[0][0] as Array<{ card: { id: string }; order: number }>;
    expect(ranks.map((r) => r.card.id).sort()).toEqual(["c001", "c002"]);
    const [, , order] = onMove.mock.calls[0];
    const rankOf = (id: string) => ranks.find((r) => r.card.id === id)!.order;
    expect(rankOf("c001")).toBeLessThan(order);
    expect(order).toBeLessThan(rankOf("c002"));
  });

  it("accounts for the dragged card's own slot when reordering downward", () => {
    const onReorder = vi.fn();
    render(<Board model={RANKED_MODEL} onReorderCard={onReorder} />);
    const dataTransfer = fakeDataTransfer();
    // drag Ready one (10) to the zone between Ready two (20) and Ready three (30)
    fireEvent.dragStart(screen.getByText("Ready one").closest("article")!, {
      dataTransfer,
    });
    const zone = within(column("ready")).getByLabelText("insert at 2");
    fireEvent.drop(zone, { dataTransfer });

    const [card, order] = onReorder.mock.calls[0];
    expect(card.id).toBe("c003");
    expect(order).toBe(25); // midpoint of 20 and 30, dragged card's slot excluded
  });
});

describe("c0058: tags on the board", () => {
  const TAG_MODEL = loadBoard([
    file("board.yaml", "columns: [backlog, done]\ntag_colors:\n  ui: \"#123456\"\n"),
    file(
      "cards/c001-a.md",
      "---\nid: c001\ntitle: Tagged card\nstatus: backlog\ntags: [ui, agent-dx]\n---\nbody\n",
    ),
    file(
      "cards/c002-b.md",
      "---\nid: c002\ntitle: Bare card\nstatus: backlog\n---\nbody\n",
    ),
    file(
      "cards/c003-c.md",
      "---\nid: c003\ntitle: Ui only\nstatus: done\ntags: [ui]\n---\nbody\n",
    ),
  ]);

  it("renders each of a card's tags as a chip", () => {
    render(<Board model={TAG_MODEL} />);
    const front = screen.getByText("Tagged card").closest("article")!;
    const chips = within(front).getAllByText(/ui|agent-dx/);
    expect(chips.map((c) => c.textContent)).toEqual(["ui", "agent-dx"]);
    chips.forEach((chip) => expect(chip).toHaveClass("tag-chip"));
  });

  it("shows no chips on a card without tags", () => {
    render(<Board model={TAG_MODEL} />);
    const front = screen.getByText("Bare card").closest("article")!;
    expect(front.querySelector(".tag-chip")).toBeNull();
  });

  it("colours a chip from the tag_colors override", () => {
    render(<Board model={TAG_MODEL} />);
    const front = screen.getByText("Ui only").closest("article")!;
    const chip = within(front).getByText("ui") as HTMLElement;
    expect(chip.style.backgroundColor).toBe("rgb(18, 52, 86)"); // #123456
  });
});

describe("c0058: tag filter", () => {
  const TAG_MODEL = loadBoard([
    file("board.yaml", "columns: [backlog, done]\n"),
    file(
      "cards/c001-a.md",
      "---\nid: c001\ntitle: UI card\nstatus: backlog\ntags: [ui]\n---\nbody\n",
    ),
    file(
      "cards/c002-b.md",
      "---\nid: c002\ntitle: DX card\nstatus: backlog\ntags: [agent-dx]\n---\nbody\n",
    ),
    file(
      "cards/c003-c.md",
      "---\nid: c003\ntitle: Both card\nstatus: backlog\ntags: [ui, agent-dx]\n---\nbody\n",
    ),
    file(
      "cards/c004-d.md",
      "---\nid: c004\ntitle: Untagged card\nstatus: backlog\n---\nbody\n",
    ),
  ]);

  function tagFilter() {
    return screen.getByRole("group", { name: "Tag filter" });
  }

  it("lists every tag in use", () => {
    render(<Board model={TAG_MODEL} />);
    const buttons = within(tagFilter())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(buttons).toEqual(["agent-dx", "ui"]); // collectTags sorts by name
  });

  it("shows only cards carrying any selected tag (OR within tags)", () => {
    render(<Board model={TAG_MODEL} />);
    fireEvent.click(within(tagFilter()).getByRole("button", { name: "ui" }));

    expect(screen.getByText("UI card")).toBeInTheDocument();
    expect(screen.getByText("Both card")).toBeInTheDocument();
    expect(screen.queryByText("DX card")).not.toBeInTheDocument();
    expect(screen.queryByText("Untagged card")).not.toBeInTheDocument();

    // add agent-dx → union
    fireEvent.click(within(tagFilter()).getByRole("button", { name: "agent-dx" }));
    expect(screen.getByText("DX card")).toBeInTheDocument();
    expect(screen.queryByText("Untagged card")).not.toBeInTheDocument();
  });

  it("clearing the selection restores all cards", () => {
    render(<Board model={TAG_MODEL} />);
    const ui = within(tagFilter()).getByRole("button", { name: "ui" });
    fireEvent.click(ui);
    expect(screen.queryByText("Untagged card")).not.toBeInTheDocument();
    fireEvent.click(ui); // toggle off
    expect(screen.getByText("Untagged card")).toBeInTheDocument();
  });

  it("composes with the type and search filters (all AND)", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog]\ntypes: [task, issue]\n"),
      file(
        "cards/c001-a.md",
        "---\nid: c001\ntitle: UI task alpha\nstatus: backlog\ntags: [ui]\n---\nbody\n",
      ),
      file(
        "cards/c002-b.md",
        "---\nid: c002\ntitle: UI issue beta\nstatus: backlog\ntype: issue\ntags: [ui]\n---\nbody\n",
      ),
    ]);
    render(<Board model={model} query="alpha" />);
    fireEvent.click(
      within(screen.getByRole("group", { name: "Tag filter" })).getByRole(
        "button",
        { name: "ui" },
      ),
    );
    // both carry ui, but only the alpha task matches the query
    expect(screen.getByText("UI task alpha")).toBeInTheDocument();
    expect(screen.queryByText("UI issue beta")).not.toBeInTheDocument();
  });

  it("renders no tag filter group when the board has no tags", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog]\n"),
      file("cards/c001-a.md", "---\nid: c001\ntitle: Bare\nstatus: backlog\n---\nb\n"),
    ]);
    render(<Board model={model} />);
    expect(screen.queryByRole("group", { name: "Tag filter" })).not.toBeInTheDocument();
  });

  it("gives an unselected chip an opaque pale fill with legible dark text (i0110)", () => {
    const model = loadBoard([
      file("board.yaml", 'columns: [backlog]\ntag_colors:\n  ui: "#65a30d"\n'),
      file("cards/c001-a.md", "---\nid: c001\ntitle: UI\nstatus: backlog\ntags: [ui]\n---\nb\n"),
    ]);
    render(<Board model={model} />);
    const chip = within(tagFilter()).getByRole("button", { name: "ui" });
    // not transparent-over-the-photo: a filled backing guarantees contrast
    expect(chip.style.backgroundColor).not.toBe("");
    expect(chip.style.backgroundColor).not.toBe("transparent");
    expect(chip.style.color).toBe("rgb(17, 17, 17)"); // #111111
    expect(chip.style.borderColor).toBe("rgb(101, 163, 13)"); // #65a30d, kept for identity

    // selected stays the full-colour fill with its own readable text
    fireEvent.click(chip);
    expect(chip.style.backgroundColor).toBe("rgb(101, 163, 13)");
    expect(chip.style.color).toBe("rgb(255, 255, 255)");
  });
});
