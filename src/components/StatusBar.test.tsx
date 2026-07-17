import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { loadBoard } from "../lib/board";
import { StatusBar } from "./StatusBar";

const MODEL = loadBoard([
  { path: "board.yaml", content: "columns: [ready, done]\n" },
  { path: "inbox/c001-a.md", content: "---\nid: c001\ntitle: a\nstatus: ready\n---\nx\n" },
  { path: "inbox/c002-b.md", content: "---\nid: c002\ntitle: b\nstatus: done\n---\nx\n" },
]);

describe("StatusBar", () => {
  it("shows the project folder name with the full path as a title", () => {
    render(<StatusBar root="/Users/x/gello/.gello" model={MODEL} branch="main" />);

    const folder = screen.getByText("gello");
    expect(folder).toBeInTheDocument();
    expect(folder).toHaveAttribute("title", "/Users/x/gello");
  });

  it("shows the git branch", () => {
    render(<StatusBar root="/x/.gello" model={MODEL} branch="feature-x" />);
    expect(screen.getByText("feature-x")).toBeInTheDocument();
  });

  it("shows 'not a git repo' when there is no branch", () => {
    render(<StatusBar root="/x/.gello" model={MODEL} branch={null} />);
    expect(screen.getByText(/not a git repo/i)).toBeInTheDocument();
  });

  it("shows per-column card counts", () => {
    render(<StatusBar root="/x/.gello" model={MODEL} branch="main" />);
    const counts = screen.getByLabelText("card counts");
    expect(counts.textContent).toContain("ready 1");
    expect(counts.textContent).toContain("done 1");
  });
});
