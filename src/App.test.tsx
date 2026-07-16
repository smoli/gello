import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadBoard } from "./lib/board";
import { loadBoardFromDisk, readFileRaw, watchBoard } from "./lib/board-io";
import { writeFileAtomic } from "./lib/fs";
import App from "./App";

vi.mock("./lib/board-io", () => ({
  loadBoardFromDisk: vi.fn(),
  readFileRaw: vi.fn(),
  removeFile: vi.fn(),
  watchBoard: vi.fn(),
}));
vi.mock("./lib/fs", () => ({ writeFileAtomic: vi.fn() }));
const loadMock = vi.mocked(loadBoardFromDisk);
const readMock = vi.mocked(readFileRaw);
const writeMock = vi.mocked(writeFileAtomic);
const watchMock = vi.mocked(watchBoard);

function loadedFixture() {
  return {
    root: "/repo/.gello",
    model: loadBoard([
      {
        path: "inbox/c001-hello.md",
        content:
          "---\nid: c001\ntitle: Hello board\nstatus: backlog\n---\n\n- [ ] a first task\n",
      },
      {
        path: "milestones/m02-board-ui/milestone.md",
        content: "---\nid: m02\ntitle: Board UI\n---\ngoal\n",
      },
      {
        path: "milestones/m02-board-ui/c005-board-card.md",
        content:
          "---\nid: c005\ntitle: Board card\nstatus: backlog\nmilestone: m02\n---\nx\n",
      },
      {
        path: "milestones/m02-board-ui/c006-reviewed.md",
        content:
          "---\nid: c006\ntitle: Reviewed card\nstatus: review\nmilestone: m02\n---\nx\n",
      },
    ]),
  };
}

describe("App", () => {
  beforeEach(() => {
    loadMock.mockReset();
    readMock.mockReset();
    writeMock.mockReset();
    watchMock.mockReset();
    watchMock.mockResolvedValue(() => {});
  });

  it("shows the placeholder when no board is found", async () => {
    loadMock.mockResolvedValueOnce(null);

    render(<App />);

    expect(await screen.findByText(/no board loaded/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "gello" })).toBeInTheDocument();
  });

  it("renders the board once loaded", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());

    render(<App />);

    expect(await screen.findByText("Hello board")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "backlog" })).toBeInTheDocument();
    expect(screen.queryByText(/no board loaded/i)).not.toBeInTheDocument();
  });

  it("moves a card optimistically and persists it", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    const card = (await screen.findByText("Board card")).closest("article")!;
    fireEvent.keyDown(card, { key: "ArrowRight" });

    const ready = screen.getByRole("region", { name: "ready" });
    expect(within(ready).getByText("Board card")).toBeInTheDocument();
    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m02-board-ui/c005-board-card.md",
      expect.stringContaining("status: ready"),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens the card detail on click and closes on Escape", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());

    render(<App />);
    fireEvent.click((await screen.findByText("Hello board")).closest("article")!);

    const dialog = screen.getByRole("dialog", { name: "c001" });
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape in the quick-capture form leaves an open card detail alone (c023)", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());

    render(<App />);
    fireEvent.click((await screen.findByText("Hello board")).closest("article")!);
    expect(screen.getByRole("dialog", { name: "c001" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    // capture closed, detail untouched
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "c001" })).toBeInTheDocument();

    // a second Escape (focus wherever) closes the detail
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("persists a priority change from the detail view", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    fireEvent.click((await screen.findByText("Hello board")).closest("article")!);
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "high" },
    });

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/inbox/c001-hello.md",
      expect.stringContaining("priority: high"),
    );
  });

  it("persists a checkbox toggle from the detail view", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    fireEvent.click((await screen.findByText("Hello board")).closest("article")!);
    fireEvent.click(screen.getByRole("checkbox"));

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/inbox/c001-hello.md",
      expect.stringContaining("- [x] a first task"),
    );
    // and the dialog reflects the optimistic update
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("saves an edited body when the disk is unchanged", async () => {
    const fixture = loadedFixture();
    loadMock.mockResolvedValueOnce(fixture);
    readMock.mockResolvedValueOnce(fixture.model.inbox[0].raw); // unchanged
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    fireEvent.click((await screen.findByText("Hello board")).closest("article")!);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Card body" }), {
      target: { value: "\nfresh body\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByRole("button", { name: "Edit" });
    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/inbox/c001-hello.md",
      expect.stringContaining("fresh body"),
    );
  });

  it("surfaces an external change instead of clobbering it", async () => {
    const fixture = loadedFixture();
    loadMock.mockResolvedValueOnce(fixture);
    const externallyChanged = fixture.model.inbox[0].raw.replace(
      "a first task",
      "agent rewrote this task",
    );
    readMock.mockResolvedValue(externallyChanged);
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    fireEvent.click((await screen.findByText("Hello board")).closest("article")!);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Card body" }), {
      target: { value: "\nmy competing draft\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/changed on disk/i)).toBeInTheDocument();
    expect(writeMock).not.toHaveBeenCalled();

    // overwrite is an explicit second decision
    fireEvent.click(screen.getByRole("button", { name: /overwrite/i }));
    await screen.findByRole("button", { name: "Edit" });
    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/inbox/c001-hello.md",
      expect.stringContaining("my competing draft"),
    );
  });

  it("captures a new idea into the inbox", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    await screen.findByText("Hello board");
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dark mode" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/inbox/c007-dark-mode.md",
      expect.stringContaining("title: Dark mode"),
    );
    const inbox = screen.getByRole("region", { name: "inbox" });
    expect(within(inbox).getByText("Dark mode")).toBeInTheDocument();
  });

  it("triages an inbox card into a milestone", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    fireEvent.click((await screen.findByText("Hello board")).closest("article")!);
    fireEvent.change(screen.getByLabelText("Milestone"), {
      target: { value: "m02-board-ui" },
    });

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m02-board-ui/c001-hello.md",
      expect.stringContaining("milestone: m02"),
    );
    // optimistic move out of the inbox into the milestone group
    expect(screen.queryByRole("region", { name: "inbox" })).not.toBeInTheDocument();
    const backlog = screen.getByRole("region", { name: "backlog" });
    expect(within(backlog).getByText("Hello board")).toBeInTheDocument();
    // detail stays open on the moved card, now with a read-only milestone
    const dialog = screen.getByRole("dialog", { name: "c001" });
    expect(within(dialog).getByText("Board UI")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Milestone")).not.toBeInTheDocument();
  });

  it("applies external file changes to the board live (debounced)", async () => {
    vi.useFakeTimers();
    try {
      const fixture = loadedFixture();
      loadMock.mockResolvedValueOnce(fixture);
      let emitChange: ((paths: string[]) => void) | null = null;
      watchMock.mockImplementation(async (_root, onChange) => {
        emitChange = onChange;
        return () => {};
      });
      const movedRaw = fixture.model.milestones[0].cards[0].raw.replace(
        "status: backlog",
        "status: review",
      );
      readMock.mockResolvedValue(movedRaw);

      render(<App />);
      await vi.waitFor(() => {
        expect(screen.getByText("Board card")).toBeInTheDocument();
      });
      expect(watchMock).toHaveBeenCalledWith("/repo/.gello", expect.any(Function));

      // burst of three events for the same file → one coalesced re-read
      emitChange!(["milestones/m02-board-ui/c005-board-card.md"]);
      emitChange!(["milestones/m02-board-ui/c005-board-card.md"]);
      emitChange!(["milestones/m02-board-ui/c005-board-card.md"]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(readMock).toHaveBeenCalledExactlyOnceWith(
        "/repo/.gello/milestones/m02-board-ui/c005-board-card.md",
      );
      const review = screen.getByRole("region", { name: "review" });
      expect(within(review).getByText("Board card")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes a card from the board when its file is deleted externally", async () => {
    vi.useFakeTimers();
    try {
      loadMock.mockResolvedValueOnce(loadedFixture());
      let emitChange: ((paths: string[]) => void) | null = null;
      watchMock.mockImplementation(async (_root, onChange) => {
        emitChange = onChange;
        return () => {};
      });
      readMock.mockRejectedValue(new Error("NotFound"));

      render(<App />);
      await vi.waitFor(() => {
        expect(screen.getByText("Hello board")).toBeInTheDocument();
      });

      emitChange!(["inbox/c001-hello.md"]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(screen.queryByText("Hello board")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("drag-triages an inbox card onto a milestone zone without opening the detail", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    const inboxCard = (await screen.findByText("Hello board")).closest("article")!;
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(type: string, value: string) {
        this.data[type] = value;
      },
      getData(type: string) {
        return this.data[type] ?? "";
      },
      effectAllowed: "",
    };

    fireEvent.dragStart(inboxCard, { dataTransfer });
    const strip = screen.getByRole("region", { name: "assign to milestone" });
    const zone = within(strip).getByText("Board UI").closest("div")!;
    fireEvent.drop(zone, { dataTransfer });

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m02-board-ui/c001-hello.md",
      expect.stringContaining("status: backlog"),
    );
    // no dialog popped open by the drag
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // card now renders under the milestone in its status column
    const backlog = screen.getByRole("region", { name: "backlog" });
    expect(within(backlog).getByText("Hello board")).toBeInTheDocument();
  });

  it("report-issue drafts first, creates on submit, and opens the issue (c024/c035/c037)", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    fireEvent.click((await screen.findByText("Reviewed card")).closest("article")!);
    fireEvent.click(screen.getByRole("button", { name: /report issue/i }));

    // nothing on disk yet — it's a draft form carrying the ref context
    expect(writeMock).not.toHaveBeenCalled();
    expect(screen.getByText(/issue for c006/i)).toBeInTheDocument();
    // rendered in its own overlay above the card-detail dialog (c040)
    const overlay = document.querySelector(".issue-draft-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay!.querySelector(".quick-capture")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "The filter flickers" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m02-board-ui/c007-the-filter-flickers.md",
      expect.stringContaining("ref: c006"),
    );
    const dialog = screen.getByRole("dialog", { name: "c007" });
    expect(within(dialog).getByText("The filter flickers")).toBeInTheDocument();

    // ref link navigates to the source
    fireEvent.click(within(dialog).getByRole("button", { name: /c006 —/ }));
    expect(screen.getByRole("dialog", { name: "c006" })).toBeInTheDocument();
  });

  it("escaping the issue draft creates nothing (c037)", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());

    render(<App />);
    fireEvent.click((await screen.findByText("Reviewed card")).closest("article")!);
    fireEvent.click(screen.getByRole("button", { name: /report issue/i }));
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(writeMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/issue for c006/i)).not.toBeInTheDocument();
    // the source card's dialog is still open underneath
    expect(screen.getByRole("dialog", { name: "c006" })).toBeInTheDocument();
  });

  it("rolls the card back and shows an alert when the write fails", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockRejectedValueOnce(new Error("disk full"));

    render(<App />);
    const card = (await screen.findByText("Board card")).closest("article")!;
    fireEvent.keyDown(card, { key: "ArrowRight" });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("disk full");
    const backlog = screen.getByRole("region", { name: "backlog" });
    expect(within(backlog).getByText("Board card")).toBeInTheDocument();
  });
});
