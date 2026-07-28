import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EpicDetail } from "./EpicDetail";
import { parseCard, parseEpic, type Card, type Epic } from "../lib/cards";

const COLUMNS = ["inbox", "backlog", "ready", "in-progress", "review", "done"];

const EPIC_RAW =
  "---\nid: e07\ntitle: Dark mode\nstatus: backlog\n---\n\n" +
  "## Goal\n\nShip dark theme.\n\n## Definition of done\n\n- [ ] toggle works\n";

function epic(raw = EPIC_RAW): Epic {
  const parsed = parseEpic("epics/e07-dark-mode/epic.md", raw);
  if (!parsed.ok) throw new Error("fixture must parse");
  return parsed.epic;
}

function childCard(
  id = "c010",
  title = "Theme toggle",
  status = "ready",
  extra = "",
): Card {
  const parsed = parseCard(
    `epics/e07-dark-mode/${id}-slug.md`,
    `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\nepic: e07\n${extra}---\nx\n`,
  );
  if (!parsed.ok) throw new Error("fixture must parse");
  return parsed.card;
}

function renderDetail(
  overrides: Partial<React.ComponentProps<typeof EpicDetail>> = {},
) {
  const props = {
    epic: epic(),
    cards: [] as Card[],
    columns: COLUMNS,
    onChangeFields: vi.fn(),
    onSaveEdit: vi.fn().mockResolvedValue("saved"),
    onClose: vi.fn(),
    onSelectCard: vi.fn(),
    ...overrides,
  };
  render(<EpicDetail {...props} />);
  return props;
}

describe("EpicDetail (i0028)", () => {
  it("shows the epic goal and an empty child rollup", () => {
    renderDetail();
    expect(screen.getByRole("dialog", { name: "e07" })).toBeInTheDocument();
    expect(screen.getByText("Dark mode")).toBeInTheDocument();
    expect(screen.getByText(/Ship dark theme/)).toBeInTheDocument();
    expect(screen.getByText("No cards yet.")).toBeInTheDocument();
  });

  it("lists child cards and opens one on click", () => {
    const card = childCard();
    const { onSelectCard } = renderDetail({ cards: [card] });
    fireEvent.click(screen.getByText("Theme toggle"));
    expect(onSelectCard).toHaveBeenCalledWith(card);
  });

  it("closes on Escape and on the Close button", () => {
    const { onClose } = renderDetail();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("EpicDetail goal / definition-of-done editor (c0084)", () => {
  it("shows both sections read-only until Edit is pressed", () => {
    renderDetail();
    expect(screen.getByText("Ship dark theme.")).toBeInTheDocument();
    expect(screen.getByText("toggle works")).toBeInTheDocument();
    expect(screen.queryByLabelText("Goal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Goal")).toHaveValue("Ship dark theme.");
    expect(screen.getByLabelText("Definition of done")).toHaveValue("- [ ] toggle works");
    expect(screen.getByLabelText("Epic title")).toHaveValue("Dark mode");
  });

  it("saves title, goal and definition of done together", async () => {
    const { onSaveEdit } = renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Epic title"), {
      target: { value: "Dark theme" },
    });
    fireEvent.change(screen.getByLabelText("Goal"), {
      target: { value: "Ship a full dark theme." },
    });
    fireEvent.change(screen.getByLabelText("Definition of done"), {
      target: { value: "- [x] toggle works" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaveEdit).toHaveBeenCalledWith(
      {
        title: "Dark theme",
        goal: "Ship a full dark theme.",
        definitionOfDone: "- [x] toggle works",
      },
      false,
    );
    await waitFor(() => expect(screen.queryByLabelText("Goal")).not.toBeInTheDocument());
  });

  it("keeps the old title when the field is blanked", async () => {
    const { onSaveEdit } = renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Epic title"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaveEdit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Dark mode" }),
      false,
    );
  });

  it("saves with Cmd-S", async () => {
    const { onSaveEdit } = renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.keyDown(screen.getByLabelText("Goal"), { key: "s", metaKey: true });

    expect(onSaveEdit).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByLabelText("Goal")).not.toBeInTheDocument());
  });

  it("cancels the edit with Escape, leaving the dialog open", () => {
    const { onClose } = renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.keyDown(screen.getByLabelText("Goal"), { key: "Escape" });

    expect(screen.queryByLabelText("Goal")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancelling drops the draft — reopening the editor shows the file again", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "scratch" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Goal")).toHaveValue("Ship dark theme.");
  });

  it("offers Overwrite / Discard on a conflict and keeps the draft (c015)", async () => {
    const onSaveEdit = vi
      .fn()
      .mockResolvedValueOnce("conflict")
      .mockResolvedValueOnce("saved");
    renderDetail({ onSaveEdit });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "mine" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText(/changed on disk/);
    expect(screen.getByLabelText("Goal")).toHaveValue("mine");

    fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ goal: "mine" }),
      true,
    );
    await waitFor(() => expect(screen.queryByLabelText("Goal")).not.toBeInTheDocument());
  });

  it("discarding a conflicted edit leaves the editor without writing", async () => {
    const onSaveEdit = vi.fn().mockResolvedValue("conflict");
    renderDetail({ onSaveEdit });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText(/changed on disk/);
    fireEvent.click(screen.getByRole("button", { name: "Discard my edit" }));

    expect(screen.queryByLabelText("Goal")).not.toBeInTheDocument();
    expect(onSaveEdit).toHaveBeenCalledOnce();
  });

  it("edits an epic whose sections are missing, without inventing text", () => {
    const { onSaveEdit } = renderDetail({
      epic: epic("---\nid: e07\ntitle: Dark mode\n---\n"),
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Goal")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "A goal." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaveEdit).toHaveBeenCalledWith(
      { title: "Dark mode", goal: "A goal.", definitionOfDone: "" },
      false,
    );
  });

  it("reconciles an external edit while not editing (c0084)", () => {
    const { rerender } = render(
      <EpicDetail
        epic={epic()}
        cards={[]}
        columns={COLUMNS}
        onChangeFields={vi.fn()}
        onSaveEdit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const changed = epic(
      "---\nid: e07\ntitle: Dark mode\nstatus: backlog\n---\n\n## Goal\n\nRewritten by an agent.\n",
    );

    rerender(
      <EpicDetail
        epic={changed}
        cards={[]}
        columns={COLUMNS}
        onChangeFields={vi.fn()}
        onSaveEdit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Rewritten by an agent.")).toBeInTheDocument();
  });
});

describe("EpicDetail frontmatter (c0084)", () => {
  it("edits the status from the board's columns", () => {
    const { onChangeFields } = renderDetail();
    const select = screen.getByLabelText("Status");
    expect(select).toHaveValue("backlog");
    expect(within(select as HTMLSelectElement).getAllByRole("option")).toHaveLength(
      COLUMNS.length,
    );

    fireEvent.change(select, { target: { value: "in-progress" } });

    expect(onChangeFields).toHaveBeenCalledWith({ status: "in-progress" });
  });

  it("keeps showing a status that is not a board column", () => {
    renderDetail({
      epic: epic("---\nid: e07\ntitle: Dark mode\nstatus: paused\n---\n"),
    });
    expect(screen.getByLabelText("Status")).toHaveValue("paused");
  });
});

describe("EpicDetail child rollup (c0084)", () => {
  const cards = [
    childCard("c010", "Theme toggle", "done"),
    childCard("c011", "Token palette", "done"),
    childCard("c012", "Contrast pass", "in-progress"),
    childCard("c013", "Docs", "backlog"),
  ];

  it("groups the cards by status in board order, with counts", () => {
    renderDetail({ cards });

    const rollup = screen.getByRole("region", { name: "Cards" });
    const headings = within(rollup)
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["backlog1", "in-progress1", "done2"]);
    expect(within(screen.getByLabelText("done cards")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("summarises progress across the epic", () => {
    renderDetail({ cards });
    expect(screen.getByText("2 of 4 done")).toBeInTheDocument();
  });

  it("leaves archived cards out of the rollup (c018)", () => {
    renderDetail({
      cards: [
        childCard("c010", "Theme toggle", "done"),
        {
          ...childCard("c009", "Old spike", "done"),
          path: "epics/e07-dark-mode/archive/c009-old-spike.md",
          archived: true,
        },
      ],
    });

    expect(screen.getByText("1 of 1 done")).toBeInTheDocument();
    expect(screen.queryByText("Old spike")).not.toBeInTheDocument();
  });

  it("opens a child card from its own status group", () => {
    const { onSelectCard } = renderDetail({ cards });
    fireEvent.click(screen.getByText("Contrast pass"));
    expect(onSelectCard).toHaveBeenCalledWith(cards[2]);
  });
});
