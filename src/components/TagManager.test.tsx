import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TagManager } from "./TagManager";
import { autoTagColor } from "../lib/tags";

const TAGS = [
  { tag: "agent-dx", count: 2 },
  { tag: "ui", count: 5 },
];

function setup(overrides: Partial<Parameters<typeof TagManager>[0]> = {}) {
  const props = {
    tags: TAGS,
    tagColors: { ui: "#123456" },
    onSetColor: vi.fn(),
    onRename: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<TagManager {...props} />);
  return props;
}

function row(tag: string) {
  return screen.getByRole("listitem", { name: tag });
}

describe("TagManager", () => {
  it("lists each tag in use with its card count", () => {
    setup();
    expect(within(row("ui")).getByText("5")).toBeInTheDocument();
    expect(within(row("agent-dx")).getByText("2")).toBeInTheDocument();
  });

  it("shows the colour override, falling back to the auto colour", () => {
    setup();
    const uiColour = within(row("ui")).getByLabelText("Colour") as HTMLInputElement;
    expect(uiColour.value).toBe("#123456");
    const dxColour = within(row("agent-dx")).getByLabelText("Colour") as HTMLInputElement;
    expect(dxColour.value).toBe(autoTagColor("agent-dx"));
  });

  it("calls onSetColor when a colour is changed", () => {
    const { onSetColor } = setup();
    const uiColour = within(row("ui")).getByLabelText("Colour");
    fireEvent.input(uiColour, { target: { value: "#00ff00" } });
    expect(onSetColor).toHaveBeenCalledWith("ui", "#00ff00");
  });

  it("renames a tag via its input + button, only when changed and non-empty", () => {
    const { onRename } = setup();
    const input = within(row("ui")).getByLabelText("Rename tag");
    const button = within(row("ui")).getByRole("button", { name: "Rename" });

    // unchanged → no call
    fireEvent.click(button);
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.click(button);
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "interface" } });
    fireEvent.click(button);
    expect(onRename).toHaveBeenCalledWith("ui", "interface");
  });

  it("closes via the close button", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an empty-state note when no tags are in use", () => {
    setup({ tags: [] });
    expect(screen.getByText(/no tags/i)).toBeInTheDocument();
  });
});
