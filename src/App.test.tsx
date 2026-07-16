import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { loadBoard } from "./lib/board";
import { loadBoardFromDisk } from "./lib/board-io";
import { writeFileAtomic } from "./lib/fs";
import App from "./App";

vi.mock("./lib/board-io", () => ({ loadBoardFromDisk: vi.fn() }));
vi.mock("./lib/fs", () => ({ writeFileAtomic: vi.fn() }));
const loadMock = vi.mocked(loadBoardFromDisk);
const writeMock = vi.mocked(writeFileAtomic);

function loadedFixture() {
  return {
    root: "/repo/.gello",
    model: loadBoard([
      {
        path: "inbox/c001-hello.md",
        content:
          "---\nid: c001\ntitle: Hello board\nstatus: backlog\n---\n\n- [ ] a first task\n",
      },
    ]),
  };
}

describe("App", () => {
  beforeEach(() => {
    loadMock.mockReset();
    writeMock.mockReset();
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
    const card = (await screen.findByText("Hello board")).closest("article")!;
    fireEvent.keyDown(card, { key: "ArrowRight" });

    const ready = screen.getByRole("region", { name: "ready" });
    expect(within(ready).getByText("Hello board")).toBeInTheDocument();
    expect(writeMock).toHaveBeenCalledExactlyOnceWith(
      "/repo/.gello/inbox/c001-hello.md",
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

  it("rolls the card back and shows an alert when the write fails", async () => {
    loadMock.mockResolvedValueOnce(loadedFixture());
    writeMock.mockRejectedValueOnce(new Error("disk full"));

    render(<App />);
    const card = (await screen.findByText("Hello board")).closest("article")!;
    fireEvent.keyDown(card, { key: "ArrowRight" });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("disk full");
    const backlog = screen.getByRole("region", { name: "backlog" });
    expect(within(backlog).getByText("Hello board")).toBeInTheDocument();
  });
});
