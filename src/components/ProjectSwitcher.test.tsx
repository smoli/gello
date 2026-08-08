import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, createEvent, within } from "@testing-library/react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { OVERVIEW } from "../lib/switcher";

const items = ["/home/me/gello", "/home/me/popexel", "/home/me/holzhof"];

function renderSwitcher(overrides = {}) {
  const props = { items, selected: 1, dead: new Set<string>(), onPick: vi.fn(), ...overrides };
  render(<ProjectSwitcher {...props} />);
  return props;
}

describe("ProjectSwitcher (c0146)", () => {
  it("lists the recent projects by folder name, current first", () => {
    renderSwitcher();
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("gello"),
      expect.stringContaining("popexel"),
      expect.stringContaining("holzhof"),
    ]);
  });

  it("marks the selected entry as active", () => {
    renderSwitcher({ selected: 1 });
    expect(
      screen.getByRole("option", { name: /popexel/, selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /gello/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("greys an entry whose board is not found and labels it", () => {
    renderSwitcher({ dead: new Set(["/home/me/popexel"]) });
    const dead = screen.getByRole("option", { name: /popexel/ });
    expect(dead).toHaveClass("switcher-item-dead");
    expect(within(dead).getByText(/not found/i)).toBeInTheDocument();
    // a live entry carries neither
    const live = screen.getByRole("option", { name: /gello/ });
    expect(live).not.toHaveClass("switcher-item-dead");
  });

  it("commits an entry on click, by its index", () => {
    const { onPick } = renderSwitcher();
    fireEvent.click(screen.getByRole("option", { name: /holzhof/ }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith(2);
  });

  // i0160: the switcher gesture holds Control, and on macOS Control is the
  // secondary-click modifier — so a click meant to pick an entry arrives as a
  // contextmenu event.
  describe("Control-click on macOS (i0160)", () => {
    it("commits the entry the secondary click lands on, native menu suppressed", () => {
      const { onPick } = renderSwitcher();
      const entry = screen.getByRole("option", { name: /holzhof/ });
      const event = createEvent.contextMenu(entry, { ctrlKey: true });
      fireEvent(entry, event);
      expect(onPick).toHaveBeenCalledExactlyOnceWith(2);
      expect(event.defaultPrevented).toBe(true);
    });

    it("suppresses the native menu on the overlay chrome without committing", () => {
      const { onPick } = renderSwitcher();
      const overlay = screen.getByRole("dialog", { name: /switch project/i });
      const event = createEvent.contextMenu(overlay, { ctrlKey: true });
      fireEvent(overlay, event);
      expect(onPick).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });
  });

  // i0158: the cross-project view is an entry like a project.
  describe("the activity view entry (i0158)", () => {
    it("names it instead of showing the sentinel", () => {
      renderSwitcher({ items: [...items, OVERVIEW] });
      const entry = screen.getByRole("option", { name: /activity across projects/i });
      expect(entry).not.toHaveTextContent("\0");
    });

    it("tags it current when it is the place you are in", () => {
      renderSwitcher({ items: [OVERVIEW, ...items], selected: 1 });
      const entry = screen.getByRole("option", { name: /activity across projects/i });
      expect(within(entry).getByText("current")).toBeInTheDocument();
      // ...and the board behind it is then not the current one
      expect(within(screen.getByRole("option", { name: /gello/ })).queryByText("current"))
        .not.toBeInTheDocument();
    });

    it("commits it by index like any other entry", () => {
      const { onPick } = renderSwitcher({ items: [...items, OVERVIEW] });
      fireEvent.click(screen.getByRole("option", { name: /activity across projects/i }));
      expect(onPick).toHaveBeenCalledExactlyOnceWith(3);
    });
  });
});
