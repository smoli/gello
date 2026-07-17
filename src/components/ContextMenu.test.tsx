import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ContextMenu } from "./ContextMenu";

function renderMenu(overrides: Partial<Parameters<typeof ContextMenu>[0]> = {}) {
  const props = {
    position: { x: 40, y: 60 },
    items: [
      { label: "Reload", onSelect: vi.fn() },
      { label: "Background…", onSelect: vi.fn() },
    ],
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ContextMenu {...props} />);
  return props;
}

describe("ContextMenu (i0011)", () => {
  it("renders its items as menu entries", () => {
    renderMenu();

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Reload" })).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Background…" }),
    ).toBeInTheDocument();
  });

  it("invokes an item's action and closes on click", () => {
    const items = [
      { label: "Reload", onSelect: vi.fn() },
      { label: "Background…", onSelect: vi.fn() },
    ];
    const { onClose } = renderMenu({ items });

    fireEvent.click(screen.getByRole("menuitem", { name: "Background…" }));

    expect(items[1].onSelect).toHaveBeenCalledOnce();
    expect(items[0].onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("positions itself at the click point", () => {
    renderMenu({ position: { x: 120, y: 200 } });

    const menu = screen.getByRole("menu");
    expect(menu).toHaveStyle({ left: "120px", top: "200px" });
  });

  it("closes on Escape", () => {
    const { onClose } = renderMenu();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on an outside click", () => {
    const { onClose } = renderMenu();
    fireEvent.click(screen.getByTestId("context-menu-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on a re-triggered right-click (outside) without a browser menu", () => {
    const { onClose } = renderMenu();
    const backdrop = screen.getByTestId("context-menu-backdrop");
    const event = fireEvent.contextMenu(backdrop);
    // the event was handled (default prevented) and the menu dismissed
    expect(event).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
