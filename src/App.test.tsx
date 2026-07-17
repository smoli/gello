import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadBoard } from "./lib/board";
import {
  appFlagGet,
  appFlagSet,
  detectSkillDirs,
  gitBranch,
  imageDataUrl,
  initBoard,
  loadBoardAt,
  loadBoardFromDisk,
  pickFolder,
  readFileRaw,
  writeNewFiles,
  watchBoard,
  watchGitHead,
} from "./lib/board-io";
import { writeFileAtomic } from "./lib/fs";
import App from "./App";

vi.mock("./lib/board-io", () => ({
  loadBoardFromDisk: vi.fn(),
  readFileRaw: vi.fn(),
  removeFile: vi.fn(),
  watchBoard: vi.fn(),
  imageDataUrl: vi.fn(),
  gitBranch: vi.fn(),
  watchGitHead: vi.fn(),
  detectSkillDirs: vi.fn(),
  appFlagGet: vi.fn(),
  appFlagSet: vi.fn(),
  loadBoardAt: vi.fn(),
  pickFolder: vi.fn(),
  initBoard: vi.fn(),
  writeNewFiles: vi.fn(),
}));
vi.mock("./lib/fs", () => ({ writeFileAtomic: vi.fn() }));
const loadMock = vi.mocked(loadBoardFromDisk);
const readMock = vi.mocked(readFileRaw);
const writeMock = vi.mocked(writeFileAtomic);
const watchMock = vi.mocked(watchBoard);
const imageMock = vi.mocked(imageDataUrl);

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
    imageMock.mockReset();
    vi.mocked(gitBranch).mockResolvedValue(null);
    vi.mocked(watchGitHead).mockResolvedValue(() => {});
    vi.mocked(detectSkillDirs).mockResolvedValue([]);
    vi.mocked(appFlagGet).mockResolvedValue(null);
    vi.mocked(appFlagSet).mockResolvedValue(undefined);
    vi.mocked(loadBoardAt).mockResolvedValue(null);
    vi.mocked(pickFolder).mockResolvedValue(null);
    vi.mocked(initBoard).mockResolvedValue("/x/.gello");
    vi.mocked(writeNewFiles).mockReset();
    vi.mocked(writeNewFiles).mockResolvedValue(undefined);
  });

  it("shows the placeholder when no board is found", async () => {
    loadMock.mockResolvedValueOnce(null);

    render(<App />);

    expect(await screen.findByText(/no board loaded/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "gello" })).toBeInTheDocument();
  });

  it("can open a folder from the no-board screen (c016)", async () => {
    loadMock.mockResolvedValueOnce(null);
    vi.mocked(pickFolder).mockResolvedValue("/x");
    vi.mocked(loadBoardAt).mockResolvedValue({
      root: "/x/.gello",
      model: loadBoard([
        { path: "inbox/c001.md", content: "---\nid: c001\ntitle: Opened board\nstatus: backlog\n---\nx\n" },
      ]),
    });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /open folder/i }));

    expect(await screen.findByText("Opened board")).toBeInTheDocument();
    expect(vi.mocked(loadBoardAt)).toHaveBeenCalledWith("/x");
  });

  it("offers to initialize a board when the picked folder has none, then opens it (c017)", async () => {
    loadMock.mockResolvedValueOnce(null);
    vi.mocked(pickFolder).mockResolvedValue("/x");
    // first open → no board; after init → board loads
    vi.mocked(loadBoardAt)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        root: "/x/.gello",
        model: loadBoard([
          { path: "inbox/c001.md", content: "---\nid: c001\ntitle: Fresh board\nstatus: backlog\n---\nx\n" },
        ]),
      });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /open folder/i }));

    // init prompt appears
    fireEvent.click(await screen.findByRole("button", { name: /initialize board/i }));

    expect(vi.mocked(initBoard)).toHaveBeenCalledWith("/x");
    expect(await screen.findByText("Fresh board")).toBeInTheDocument();
  });

  it("sets a color background via the right-click picker in one board.yaml write (c0060)", async () => {
    loadMock.mockResolvedValueOnce({
      root: "/repo/proj/.gello",
      model: loadBoard([
        { path: "board.yaml", content: "columns: [backlog, done]\n" },
        { path: "inbox/c001.md", content: "---\nid: c001\ntitle: t\nstatus: backlog\n---\nx\n" },
      ]),
    });

    const { container } = render(<App />);
    await screen.findByText("t");
    fireEvent.contextMenu(container.querySelector(".board") as HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: "Color" }));
    fireEvent.change(screen.getByLabelText("Background color"), {
      target: { value: "#123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await vi.waitFor(() => {
      const boardYamlWrites = vi
        .mocked(writeNewFiles)
        .mock.calls.filter((c) => c[0][0].path.endsWith("/board.yaml"));
      expect(boardYamlWrites).toHaveLength(1); // one write, not per slider tick
      expect(boardYamlWrites[0][0][0].content).toContain('background: "#123456"');
    });
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
      "/repo/.gello/inbox/c0007-dark-mode.md",
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
    // detail stays open on the moved card; the milestone select now reflects
    // its new home and stays editable for reassignment (i0005)
    const dialog = screen.getByRole("dialog", { name: "c001" });
    expect(within(dialog).getByLabelText("Milestone")).toHaveValue("m02-board-ui");
  });

  it("i0005: dropping an inbox card on ready prompts for a milestone, then triages", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    const cardEl = (await screen.findByText("Hello board")).closest("article")!;
    const data: Record<string, string> = {};
    const dataTransfer = {
      setData: (t: string, v: string) => {
        data[t] = v;
      },
      getData: (t: string) => data[t] ?? "",
    };
    fireEvent.dragStart(cardEl, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "ready" }), { dataTransfer });

    // no write yet — the picker is waiting for a milestone choice
    expect(writeMock).not.toHaveBeenCalled();
    const picker = screen.getByRole("dialog", { name: "assign milestone" });
    fireEvent.click(within(picker).getByText("Board UI"));

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m02-board-ui/c001-hello.md",
      expect.stringContaining("status: ready"),
    );
    expect(writeMock.mock.calls[0][1]).toContain("milestone: m02");
  });

  it("i0005: dismissing the milestone picker applies the status but keeps the card in inbox", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    const cardEl = (await screen.findByText("Hello board")).closest("article")!;
    const data: Record<string, string> = {};
    const dataTransfer = {
      setData: (t: string, v: string) => {
        data[t] = v;
      },
      getData: (t: string) => data[t] ?? "",
    };
    fireEvent.dragStart(cardEl, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "ready" }), { dataTransfer });

    fireEvent.click(screen.getByRole("button", { name: /stay in inbox/i }));

    // status applied in place, still in the inbox folder (no milestone, no move)
    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/inbox/c001-hello.md",
      expect.stringContaining("status: ready"),
    );
    expect(writeMock.mock.calls[0][1]).not.toContain("milestone:");
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
      "/repo/.gello/milestones/m02-board-ui/i0001-the-filter-flickers.md",
      expect.stringContaining("ref: c006"),
    );
    const dialog = screen.getByRole("dialog", { name: "i0001" });
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

  it("loads the configured board background image (c047)", async () => {
    const fixture = {
      root: "/repo/.gello",
      model: loadBoard([
        { path: "board.yaml", content: "background: assets/board/bg.jpg\n" },
        {
          path: "inbox/c001-hello.md",
          content: "---\nid: c001\ntitle: Hello board\nstatus: backlog\n---\nx\n",
        },
      ]),
    };
    loadMock.mockResolvedValueOnce(fixture);
    imageMock.mockResolvedValueOnce("data:image/jpeg;base64,QUJD");

    const { container } = render(<App />);
    await screen.findByText("Hello board");

    expect(imageMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/assets/board/bg.jpg",
    );
    await vi.waitFor(() => {
      expect(
        (container.querySelector(".board") as HTMLElement).style.backgroundImage,
      ).toContain("data:image/jpeg;base64,QUJD");
    });
  });

  it("offers and installs the discuss skill into detected dirs (c032)", async () => {
    loadMock.mockResolvedValueOnce({
      root: "/repo/proj/.gello",
      model: loadBoard([
        { path: "inbox/c001.md", content: "---\nid: c001\ntitle: t\nstatus: backlog\n---\nx\n" },
      ]),
    });
    vi.mocked(detectSkillDirs).mockResolvedValue(["/repo/proj/.claude/skills"]);
    readMock.mockRejectedValue(new Error("no such file")); // skill not installed yet
    vi.mocked(writeNewFiles).mockResolvedValue(undefined);

    render(<App />);
    const install = await screen.findByRole("button", { name: "Install" });
    expect(vi.mocked(detectSkillDirs)).toHaveBeenCalledWith("/repo/proj");

    fireEvent.click(install);

    await vi.waitFor(() => {
      const files = vi.mocked(writeNewFiles).mock.calls[0][0];
      expect(files).toContainEqual({
        path: "/repo/proj/.claude/skills/gello-discuss/SKILL.md",
        content: expect.stringContaining("gello-managed"),
      });
    });
    expect(
      screen.queryByRole("button", { name: "Install" }),
    ).not.toBeInTheDocument();
  });

  it("remembers 'don't ask' and does not install (c032)", async () => {
    loadMock.mockResolvedValueOnce({
      root: "/repo/proj/.gello",
      model: loadBoard([
        { path: "inbox/c001.md", content: "---\nid: c001\ntitle: t\nstatus: backlog\n---\nx\n" },
      ]),
    });
    vi.mocked(detectSkillDirs).mockResolvedValue(["/repo/proj/.claude/skills"]);
    readMock.mockRejectedValue(new Error("no such file")); // skills not installed

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /don't ask/i }));

    expect(vi.mocked(appFlagSet)).toHaveBeenCalledWith(
      "skills-prompt-dismissed:/repo/proj",
      "1",
    );
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("does not prompt when all skills are already present and current (i0009)", async () => {
    loadMock.mockResolvedValueOnce({
      root: "/repo/proj/.gello",
      model: loadBoard([
        { path: "inbox/c001.md", content: "---\nid: c001\ntitle: t\nstatus: backlog\n---\nx\n" },
      ]),
    });
    vi.mocked(detectSkillDirs).mockResolvedValue(["/repo/proj/.claude/skills"]);
    // every skill file already exists and is current → installDecision "skip"
    const { managedSkillFile, ALL_SKILLS, skillFilePath } = await import("./lib/skills");
    readMock.mockImplementation(async (path: string) => {
      const skill = ALL_SKILLS.find((s) => path === skillFilePath("/repo/proj/.claude/skills", s));
      if (skill) return managedSkillFile(skill);
      throw new Error("no such file");
    });

    render(<App />);
    await screen.findByText("t");
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("does not prompt when this project was previously dismissed (c032)", async () => {
    loadMock.mockResolvedValueOnce({
      root: "/repo/proj/.gello",
      model: loadBoard([
        { path: "inbox/c001.md", content: "---\nid: c001\ntitle: t\nstatus: backlog\n---\nx\n" },
      ]),
    });
    // dismissed flag set for THIS project's key only
    vi.mocked(appFlagGet).mockImplementation(async (key: string) =>
      key === "skills-prompt-dismissed:/repo/proj" ? "1" : null,
    );
    vi.mocked(detectSkillDirs).mockResolvedValue(["/repo/proj/.claude/skills"]);
    readMock.mockRejectedValue(new Error("no such file"));

    render(<App />);
    await screen.findByText("t");
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("a dismissal for another project does not bleed into this one (i0010)", async () => {
    loadMock.mockResolvedValueOnce({
      root: "/repo/proj/.gello",
      model: loadBoard([
        { path: "inbox/c001.md", content: "---\nid: c001\ntitle: t\nstatus: backlog\n---\nx\n" },
      ]),
    });
    // a DIFFERENT project was dismissed — must not suppress this one
    vi.mocked(appFlagGet).mockImplementation(async (key: string) =>
      key === "skills-prompt-dismissed:/some/other" ? "1" : null,
    );
    vi.mocked(detectSkillDirs).mockResolvedValue(["/repo/proj/.claude/skills"]);
    readMock.mockRejectedValue(new Error("no such file"));

    render(<App />);
    expect(await screen.findByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("opens a picked folder and swaps the board (c016)", async () => {
    loadMock.mockResolvedValueOnce({
      root: "/repo/proj/.gello",
      model: loadBoard([
        { path: "inbox/c001.md", content: "---\nid: c001\ntitle: Old board\nstatus: backlog\n---\nx\n" },
      ]),
    });
    vi.mocked(pickFolder).mockResolvedValue("/other");
    vi.mocked(loadBoardAt).mockResolvedValue({
      root: "/other/.gello",
      model: loadBoard([
        { path: "inbox/c001.md", content: "---\nid: c001\ntitle: New board\nstatus: backlog\n---\nx\n" },
      ]),
    });

    render(<App />);
    await screen.findByText("Old board");
    // open the project menu (button shows current folder "proj")
    fireEvent.click(screen.getByRole("button", { name: /proj/ }));
    fireEvent.click(screen.getByText(/open folder/i));

    expect(await screen.findByText("New board")).toBeInTheDocument();
    expect(screen.queryByText("Old board")).not.toBeInTheDocument();
    expect(vi.mocked(loadBoardAt)).toHaveBeenCalledWith("/other");
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

  it("reorders a card within the backlog and persists its rank (c056)", async () => {
    loadMock.mockResolvedValueOnce({
      root: "/repo/.gello",
      model: loadBoard([
        {
          path: "milestones/m01-a/milestone.md",
          content: "---\nid: m01\ntitle: A\n---\ng\n",
        },
        {
          path: "milestones/m01-a/c001-one.md",
          content: "---\nid: c001\ntitle: Card one\nstatus: backlog\norder: 10\n---\nx\n",
        },
        {
          path: "milestones/m01-a/c002-two.md",
          content: "---\nid: c002\ntitle: Card two\nstatus: backlog\norder: 20\n---\nx\n",
        },
      ]),
    });
    writeMock.mockResolvedValueOnce(undefined);

    render(<App />);
    const dragged = (await screen.findByText("Card two")).closest("article")!;
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
    fireEvent.dragStart(dragged, { dataTransfer });
    const backlog = screen.getByRole("region", { name: "backlog" });
    // zone 0 = above Card one (10) → rank below 10, only the dragged file written
    const zone = within(backlog).getByLabelText("insert at 0");
    fireEvent.drop(zone, { dataTransfer });

    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/milestones/m01-a/c002-two.md",
      expect.stringContaining("order: 0"),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
