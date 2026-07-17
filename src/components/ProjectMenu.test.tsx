import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProjectMenu } from "./ProjectMenu";

describe("ProjectMenu", () => {
  const props = () => ({
    currentPath: "/Users/x/gello",
    recent: ["/Users/x/gello", "/Users/x/other-proj"],
    onOpenRecent: vi.fn(),
    onPickFolder: vi.fn(),
  });

  it("shows the current project folder name", () => {
    render(<ProjectMenu {...props()} />);
    expect(screen.getByRole("button", { name: /gello/ })).toBeInTheDocument();
  });

  it("lists recent projects (excluding the current) and opens one", () => {
    const p = props();
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /gello/ }));

    expect(screen.getByText("other-proj")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "gello" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("other-proj"));
    expect(p.onOpenRecent).toHaveBeenCalledWith("/Users/x/other-proj");
  });

  it("offers Open folder…", () => {
    const p = props();
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /gello/ }));
    fireEvent.click(screen.getByText(/open folder/i));
    expect(p.onPickFolder).toHaveBeenCalledTimes(1);
  });
});
