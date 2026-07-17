import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

  // c0063: submenu + toggle items

  it("reveals a submenu on hover and runs a nested item", () => {
    const toggle = vi.fn();
    const { onClose } = renderMenu({
      items: [
        { label: "Reload", onSelect: vi.fn() },
        {
          label: "Settings",
          items: [{ label: "Show thumbnails", checked: true, onSelect: toggle }],
        },
      ],
    });

    // nested item hidden until the submenu opens
    expect(
      screen.queryByRole("menuitemcheckbox", { name: "Show thumbnails" }),
    ).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /Settings/ }));
    const toggleItem = screen.getByRole("menuitemcheckbox", {
      name: "Show thumbnails",
    });
    expect(toggleItem).toBeInTheDocument();
    expect(toggleItem).toBeChecked(); // checked → aria-checked true

    fireEvent.click(toggleItem);
    expect(toggle).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("c0063: hover-intent — leaving briefly then returning keeps the submenu open", () => {
    vi.useFakeTimers();
    try {
      renderMenu({
        items: [
          {
            label: "Settings",
            items: [{ label: "Show thumbnails", checked: true, onSelect: vi.fn() }],
          },
        ],
      });
      const sub = screen
        .getByRole("menuitem", { name: /Settings/ })
        .closest(".context-menu-sub") as HTMLElement;

      fireEvent.mouseEnter(sub); // open
      expect(
        screen.getByRole("menuitemcheckbox", { name: "Show thumbnails" }),
      ).toBeInTheDocument();

      // pointer wanders off, then comes back before the close delay elapses
      fireEvent.mouseLeave(sub);
      act(() => vi.advanceTimersByTime(100));
      fireEvent.mouseEnter(sub);
      act(() => vi.advanceTimersByTime(400));

      // still open — the pending close was cancelled
      expect(
        screen.getByRole("menuitemcheckbox", { name: "Show thumbnails" }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("c0063: the submenu closes after the delay once the pointer leaves for good", () => {
    vi.useFakeTimers();
    try {
      renderMenu({
        items: [
          {
            label: "Settings",
            items: [{ label: "Show thumbnails", checked: true, onSelect: vi.fn() }],
          },
        ],
      });
      const sub = screen
        .getByRole("menuitem", { name: /Settings/ })
        .closest(".context-menu-sub") as HTMLElement;
      fireEvent.mouseEnter(sub);
      fireEvent.mouseLeave(sub);
      act(() => vi.advanceTimersByTime(300));
      expect(
        screen.queryByRole("menuitemcheckbox", { name: "Show thumbnails" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an unchecked toggle without a check", () => {
    renderMenu({
      items: [
        {
          label: "Settings",
          items: [{ label: "Show thumbnails", checked: false, onSelect: vi.fn() }],
        },
      ],
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Show thumbnails" }),
    ).not.toBeChecked();
  });
});
