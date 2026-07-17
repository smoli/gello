import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
