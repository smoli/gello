import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TitleBar } from "./TitleBar";
import { isMacOS } from "../lib/platform";

vi.mock("../lib/platform", () => ({ isMacOS: vi.fn().mockReturnValue(false) }));
// window controls call the Tauri window API — stub it out for these tests
vi.mock("../lib/window", () => ({
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  isWindowMaximized: vi.fn().mockResolvedValue(false),
  onWindowResized: vi.fn().mockResolvedValue(() => {}),
}));

beforeEach(() => vi.mocked(isMacOS).mockReturnValue(false));

describe("TitleBar", () => {
  it("renders the gello title with folder and branch", () => {
    render(<TitleBar root="/Users/x/gello/.gello" branch="main" />);
    expect(screen.getByText("gello - gello (main)")).toBeInTheDocument();
  });

  it("omits the branch when not a git repo", () => {
    render(<TitleBar root="/x/proj/.gello" branch={null} />);
    expect(screen.getByText("gello - proj")).toBeInTheDocument();
  });

  it("c0083: shows no dirty indicator when clean or absent", () => {
    render(<TitleBar root="/x/.gello" branch="main" dirty={{ board_dirty: false, code_dirty: false }} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("c0083: shows a board-only dirty indicator distinct from a code one", () => {
    const { rerender } = render(
      <TitleBar root="/x/.gello" branch="main" dirty={{ board_dirty: true, code_dirty: false }} />,
    );
    const boardDot = screen.getByRole("status");
    expect(boardDot).toHaveAccessibleName("Uncommitted board changes");
    expect(boardDot.className).toContain("titlebar-dirty-board");

    rerender(
      <TitleBar root="/x/.gello" branch="main" dirty={{ board_dirty: true, code_dirty: true }} />,
    );
    const codeDot = screen.getByRole("status");
    expect(codeDot).toHaveAccessibleName("Uncommitted changes (includes code)");
    expect(codeDot.className).toContain("titlebar-dirty-code");
  });

  it("is a Tauri drag region", () => {
    const { container } = render(<TitleBar root="/x/.gello" branch={null} />);
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
  });

  // c0066: the fulltext search box now lives in the top bar

  it("shows no search box without an onSearch handler", () => {
    render(<TitleBar root="/x/.gello" branch={null} />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("reports query changes and reflects the value", () => {
    const onSearch = vi.fn();
    render(
      <TitleBar root="/x/.gello" branch={null} search="foo" onSearch={onSearch} />,
    );
    const search = screen.getByRole("searchbox") as HTMLInputElement;
    expect(search.value).toBe("foo");

    fireEvent.change(search, { target: { value: "kanban" } });
    expect(onSearch).toHaveBeenCalledWith("kanban");
  });

  it("clears the query on Escape", () => {
    const onSearch = vi.fn();
    render(
      <TitleBar root="/x/.gello" branch={null} search="kanban" onSearch={onSearch} />,
    );
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("focuses the search box on Cmd/Ctrl+F", () => {
    render(<TitleBar root="/x/.gello" branch={null} search="" onSearch={vi.fn()} />);
    const search = screen.getByRole("searchbox");
    expect(search).not.toHaveFocus();

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    expect(search).toHaveFocus();
  });

  it("keeps the search box interactive (not a drag region)", () => {
    render(<TitleBar root="/x/.gello" branch={null} search="" onSearch={vi.fn()} />);
    expect(
      screen.getByRole("searchbox").hasAttribute("data-tauri-drag-region"),
    ).toBe(false);
  });

  // i0017: custom window controls on Windows/Linux, native chrome on macOS

  it("renders custom window controls off macOS", () => {
    vi.mocked(isMacOS).mockReturnValue(false);
    const { container } = render(<TitleBar root="/x/.gello" branch={null} />);
    expect(container.querySelector(".titlebar")).toHaveClass("titlebar-win");
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("renders NO window controls on macOS (native traffic lights)", () => {
    vi.mocked(isMacOS).mockReturnValue(true);
    const { container } = render(<TitleBar root="/x/.gello" branch={null} />);
    expect(container.querySelector(".titlebar")).toHaveClass("titlebar-mac");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});
