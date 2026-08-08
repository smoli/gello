import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { loadBoardAt, readFileRaw, watchBoard, writeNewFiles } from "../lib/board-io";
import { writeFileAtomic } from "../lib/fs";
import { loadBoard } from "../lib/board";
import { autoProjectColor } from "../lib/multi";
import { MultiProject } from "./MultiProject";

vi.mock("../lib/board-io", () => ({
  loadBoardAt: vi.fn(),
  watchBoard: vi.fn(),
  readFileRaw: vi.fn(),
  writeNewFiles: vi.fn(),
  removeFile: vi.fn(),
  removeDir: vi.fn(),
  imageDataUrl: vi.fn(),
}));
vi.mock("../lib/fs", () => ({ writeFileAtomic: vi.fn() }));

const loadMock = vi.mocked(loadBoardAt);
const watchMock = vi.mocked(watchBoard);
const readMock = vi.mocked(readFileRaw);
const writeMock = vi.mocked(writeFileAtomic);
const configMock = vi.mocked(writeNewFiles);

const GELLO = "/repo/gello";
const POPEXEL = "/repo/popexel";

/** A card file for a fixture board. */
function card(id: string, title: string, status: string, extra = "") {
  return {
    path: `cards/${id}-x.md`,
    content: `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\n${extra}---\n\nbody\n`,
  };
}

const FILES: Record<string, Array<{ path: string; content: string }>> = {
  [GELLO]: [
    card("c001", "Gello ready card", "ready"),
    card("c002", "Gello running card", "in-progress"),
    card("c003", "Gello finished card", "review"),
    card("c004", "Gello parked card", "in-progress", "awaiting: input\n"),
    card("c005", "Gello backlog card", "backlog"),
  ],
  [POPEXEL]: [
    // c001 again: ids are per-board, so the two must not collide
    card("c001", "Popexel ready card", "ready"),
    card("c009", "Popexel finished card", "review"),
  ],
};

/** The parked card's body carries the question the view answers inline. */
FILES[GELLO][3].content =
  "---\nid: c004\ntitle: Gello parked card\nstatus: in-progress\nawaiting: input\n---\n\n" +
  "```gelloquestion\nWhich way?\n\n- [ ] left\n- [ ] right\n```\n";

/** The change callbacks the view registered, by board root. */
let watchers: Record<string, (paths: string[]) => void>;
/** The stop functions watchBoard handed back, by board root. */
let stops: Record<string, ReturnType<typeof vi.fn>>;

function renderView(projects = [GELLO, POPEXEL], known = [GELLO, POPEXEL, "/repo/third"]) {
  const onChangeProjects = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <MultiProject
      projects={projects}
      known={known}
      onChangeProjects={onChangeProjects}
      onClose={onClose}
    />,
  );
  return { ...view, onChangeProjects, onClose };
}

/** A rendered card front, by project name and card title. */
function front(project: string, title: string): HTMLElement {
  return screen.getByLabelText(new RegExp(`^${project}/\\w+: ${title}$`));
}

function column(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

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

describe("MultiProject (c0138)", () => {
  beforeEach(() => {
    watchers = {};
    stops = {};
    loadMock.mockReset();
    loadMock.mockImplementation(async (folder: string) => {
      const files = FILES[folder];
      if (!files) return null;
      return { root: `${folder}/.gello`, legacy: false, model: loadBoard(files) };
    });
    watchMock.mockReset();
    watchMock.mockImplementation(async (root: string, onChange) => {
      watchers[root] = onChange;
      const stop = vi.fn();
      stops[root] = stop;
      return stop;
    });
    readMock.mockReset();
    readMock.mockResolvedValue("");
    writeMock.mockReset();
    writeMock.mockResolvedValue(undefined);
    configMock.mockReset();
    configMock.mockResolvedValue(undefined);
  });

  it("aggregates ready / in-progress / review across the selected projects", async () => {
    renderView();

    expect(await screen.findByText("Gello ready card")).toBeInTheDocument();
    expect(within(column("ready")).getByText("Popexel ready card")).toBeInTheDocument();
    expect(within(column("in-progress")).getByText("Gello running card")).toBeInTheDocument();
    expect(within(column("review")).getByText("Gello finished card")).toBeInTheDocument();
    expect(within(column("review")).getByText("Popexel finished card")).toBeInTheDocument();
    // only those three columns — a backlog card is not this view's business
    expect(screen.queryByText("Gello backlog card")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "backlog" })).not.toBeInTheDocument();
  });

  it("shows both projects' c001 — cards are keyed by project and id", async () => {
    renderView();

    expect(await screen.findByText("Gello ready card")).toBeInTheDocument();
    expect(front("gello", "Gello ready card")).toBeInTheDocument();
    expect(front("popexel", "Popexel ready card")).toBeInTheDocument();
  });

  it("colours each card with its source project's colour", async () => {
    renderView();

    await screen.findByText("Gello ready card");
    expect(front("gello", "Gello ready card")).toHaveStyle({
      borderLeftColor: autoProjectColor(GELLO),
    });
    expect(front("popexel", "Popexel ready card")).toHaveStyle({
      borderLeftColor: autoProjectColor(POPEXEL),
    });
  });

  it("prefers the colour the project's board.yaml sets", async () => {
    loadMock.mockImplementation(async (folder: string) => ({
      root: `${folder}/.gello`,
      legacy: false,
      model: loadBoard([
        { path: "board.yaml", content: 'project_color: "#0d9488"\n' },
        ...FILES[folder],
      ]),
    }));
    renderView();

    await screen.findByText("Gello ready card");
    expect(front("gello", "Gello ready card")).toHaveStyle({ borderLeftColor: "#0d9488" });
  });

  it("writes a picked colour to that project's board.yaml, surgically", async () => {
    loadMock.mockImplementation(async (folder: string) => ({
      root: `${folder}/.gello`,
      legacy: false,
      model: loadBoard([
        { path: "board.yaml", content: "columns: [ready, in-progress, review]\n" },
        ...FILES[folder],
      ]),
    }));
    renderView();

    await screen.findByText("Popexel ready card");
    fireEvent.click(screen.getByRole("button", { name: "Colour for popexel" }));
    fireEvent.click(screen.getByRole("button", { name: "Colour #2563eb" }));

    await waitFor(() => expect(configMock).toHaveBeenCalled());
    const [file] = configMock.mock.calls[0][0];
    expect(file.path).toBe("/repo/popexel/.gello/board.yaml");
    expect(file.content).toContain('project_color: "#2563eb"');
    // the surgical edit leaves the rest of board.yaml alone
    expect(file.content).toContain("columns: [ready, in-progress, review]");
  });

  it("watches every selected board and follows a card as it moves", async () => {
    renderView();

    await screen.findByText("Gello ready card");
    await waitFor(() => expect(Object.keys(watchers)).toHaveLength(2));

    // popexel's review card moves to done in its own project
    readMock.mockResolvedValue(
      "---\nid: c009\ntitle: Popexel finished card\nstatus: done\n---\n\nbody\n",
    );
    watchers["/repo/popexel/.gello"](["cards/c009-x.md"]);

    await waitFor(() =>
      expect(screen.queryByText("Popexel finished card")).not.toBeInTheDocument(),
    );
    expect(readMock).toHaveBeenCalledWith("/repo/popexel/.gello/cards/c009-x.md");
    // the other project's board is untouched by its neighbour's event
    expect(screen.getByText("Gello finished card")).toBeInTheDocument();
  });

  it("loads a project added to the selection, with no manual reload", async () => {
    const { rerender, onChangeProjects, onClose } = renderView([GELLO]);

    await screen.findByText("Gello ready card");
    expect(screen.queryByText("Popexel ready card")).not.toBeInTheDocument();

    rerender(
      <MultiProject
        projects={[GELLO, POPEXEL]}
        known={[GELLO, POPEXEL]}
        onChangeProjects={onChangeProjects}
        onClose={onClose}
      />,
    );

    expect(await screen.findByText("Popexel ready card")).toBeInTheDocument();
    expect(screen.getByText("Gello ready card")).toBeInTheDocument();
  });

  it("drops a removed project's cards and stops watching it", async () => {
    const { rerender, onChangeProjects, onClose } = renderView();

    await screen.findByText("Popexel ready card");
    await waitFor(() => expect(Object.keys(stops)).toHaveLength(2));

    rerender(
      <MultiProject
        projects={[GELLO]}
        known={[GELLO, POPEXEL]}
        onChangeProjects={onChangeProjects}
        onClose={onClose}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText("Popexel ready card")).not.toBeInTheDocument(),
    );
    expect(stops["/repo/popexel/.gello"]).toHaveBeenCalled();
    expect(stops["/repo/gello/.gello"]).not.toHaveBeenCalled();
  });

  it("picks a project to add from the known list", async () => {
    const { onChangeProjects } = renderView([GELLO], [GELLO, POPEXEL]);

    await screen.findByText("Gello ready card");
    fireEvent.click(screen.getByRole("button", { name: "Add project" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "popexel" }));

    expect(onChangeProjects).toHaveBeenCalledExactlyOnceWith([GELLO, POPEXEL]);
  });

  it("removes a project from the view", async () => {
    const { onChangeProjects } = renderView();

    await screen.findByText("Popexel ready card");
    fireEvent.click(screen.getByRole("button", { name: "Remove popexel" }));

    expect(onChangeProjects).toHaveBeenCalledExactlyOnceWith([GELLO]);
  });

  it("accepts a review card by dropping it on the done area — in its own project", async () => {
    renderView();

    await screen.findByText("Popexel finished card");
    const dataTransfer = fakeDataTransfer();
    fireEvent.dragStart(front("popexel", "Popexel finished card"), { dataTransfer });
    fireEvent.dragOver(screen.getByRole("region", { name: "done" }), { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "done" }), { dataTransfer });

    await waitFor(() => expect(writeMock).toHaveBeenCalled());
    const [path, content] = writeMock.mock.calls[0];
    expect(path).toBe("/repo/popexel/.gello/cards/c009-x.md");
    expect(content).toContain("status: done");
    expect(content).toMatch(/status-changed: \d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/);
  });

  it("rebases the accept on the owning project's disk content", async () => {
    renderView();

    await screen.findByText("Popexel finished card");
    // an agent renamed the card between the view's last read and the drop
    readMock.mockResolvedValue(
      "---\nid: c009\ntitle: Renamed by an agent\nstatus: review\n---\n\nbody\n",
    );
    const dataTransfer = fakeDataTransfer();
    fireEvent.dragStart(front("popexel", "Popexel finished card"), { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "done" }), { dataTransfer });

    await waitFor(() => expect(writeMock).toHaveBeenCalled());
    expect(readMock).toHaveBeenCalledWith("/repo/popexel/.gello/cards/c009-x.md");
    const [, content] = writeMock.mock.calls[0];
    expect(content).toContain("title: Renamed by an agent");
    expect(content).toContain("status: done");
  });

  it("does not accept a card dropped on done from another column", async () => {
    renderView();

    await screen.findByText("Gello ready card");
    const dataTransfer = fakeDataTransfer();
    fireEvent.dragStart(front("gello", "Gello ready card"), { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "done" }), { dataTransfer });

    // accepting is for work waiting on review; a ready card is not that
    await waitFor(() => expect(screen.getByText("Gello ready card")).toBeInTheDocument());
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("badges a card with a parked question and answers it inline", async () => {
    renderView();

    await screen.findByText("Gello parked card");
    const parked = front("gello", "Gello parked card");
    expect(within(parked).getByLabelText("Needs input")).toBeInTheDocument();

    fireEvent.click(within(parked).getByLabelText("Needs input"));
    const dialog = await screen.findByRole("dialog", { name: /question for c004/i });
    fireEvent.click(within(dialog).getByLabelText("left"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Answer" }));

    await waitFor(() => expect(writeMock).toHaveBeenCalled());
    const [path, content] = writeMock.mock.calls[0];
    expect(path).toBe("/repo/gello/.gello/cards/c004-x.md");
    expect(content).toContain("awaiting: answered");
    expect(content).toContain("- [x] left");
    // un-fenced in place: the resolved Q&A is plain markdown now
    expect(content).not.toContain("```gelloquestion");
  });

  it("opens a card's detail scoped to its project", async () => {
    renderView();

    await screen.findByText("Popexel finished card");
    fireEvent.click(front("popexel", "Popexel finished card"));

    const detail = await screen.findByRole("dialog", { name: /popexel/i });
    expect(within(detail).getByText("Popexel finished card")).toBeInTheDocument();
    // the detail's status options come from that project's own board config
    expect(within(detail).getByLabelText("Status")).toHaveValue("review");
  });

  it("writes a detail edit against the card's own project", async () => {
    renderView();

    await screen.findByText("Popexel finished card");
    fireEvent.click(front("popexel", "Popexel finished card"));
    const detail = await screen.findByRole("dialog", { name: /popexel/i });
    fireEvent.change(within(detail).getByLabelText("Status"), {
      target: { value: "in-progress" },
    });

    await waitFor(() => expect(writeMock).toHaveBeenCalled());
    expect(writeMock.mock.calls[0][0]).toBe("/repo/popexel/.gello/cards/c009-x.md");
    expect(writeMock.mock.calls[0][1]).toContain("status: in-progress");
  });

  it("reads only board files — never a companion state file", async () => {
    renderView();

    await screen.findByText("Gello ready card");
    watchers["/repo/gello/.gello"](["cards/c001-x.md"]);

    await waitFor(() => expect(readMock).toHaveBeenCalled());
    for (const [path] of readMock.mock.calls) {
      expect(path).not.toContain(".companion");
    }
  });

  it("says so when a selected project has no board any more", async () => {
    loadMock.mockImplementation(async (folder: string) =>
      folder === POPEXEL
        ? null
        : { root: `${folder}/.gello`, legacy: false, model: loadBoard(FILES[folder]) },
    );
    renderView();

    expect(await screen.findByText(/no gello board/i)).toHaveTextContent(POPEXEL);
    // the projects that do load are unaffected
    expect(screen.getByText("Gello ready card")).toBeInTheDocument();
  });

  it("leaves the view when the board is asked for", async () => {
    const { onClose } = renderView();

    fireEvent.click(screen.getByRole("button", { name: /back to board/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
