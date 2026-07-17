import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TitleBar } from "./TitleBar";

describe("TitleBar", () => {
  it("renders the gello title with folder and branch", () => {
    render(<TitleBar root="/Users/x/gello/.gello" branch="main" />);
    expect(screen.getByText("gello: gello (main)")).toBeInTheDocument();
  });

  it("omits the branch when not a git repo", () => {
    render(<TitleBar root="/x/proj/.gello" branch={null} />);
    expect(screen.getByText("gello: proj")).toBeInTheDocument();
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
});
