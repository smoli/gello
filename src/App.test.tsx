import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { loadBoard } from "./lib/board";
import { loadBoardFromDisk } from "./lib/board-io";
import App from "./App";

vi.mock("./lib/board-io", () => ({ loadBoardFromDisk: vi.fn() }));
const loadMock = vi.mocked(loadBoardFromDisk);

describe("App", () => {
  beforeEach(() => {
    loadMock.mockReset();
  });

  it("shows the placeholder when no board is found", async () => {
    loadMock.mockResolvedValueOnce(null);

    render(<App />);

    expect(await screen.findByText(/no board loaded/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "gello" })).toBeInTheDocument();
  });

  it("renders the board once loaded", async () => {
    loadMock.mockResolvedValueOnce(
      loadBoard([
        {
          path: "inbox/c001-hello.md",
          content: "---\nid: c001\ntitle: Hello board\nstatus: backlog\n---\nx\n",
        },
      ]),
    );

    render(<App />);

    expect(await screen.findByText("Hello board")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "backlog" })).toBeInTheDocument();
    expect(screen.queryByText(/no board loaded/i)).not.toBeInTheDocument();
  });
});
