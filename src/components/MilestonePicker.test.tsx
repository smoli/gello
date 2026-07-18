import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MilestonePicker } from "./MilestonePicker";

const OPTIONS = [
  { folder: "m01-alpha", milestoneId: "m01", label: "Alpha" },
  { folder: "m02-beta", milestoneId: "m02", label: "Beta" },
];

function renderPicker(
  overrides: Partial<Parameters<typeof MilestonePicker>[0]> = {},
) {
  const props = {
    options: OPTIONS,
    status: "ready",
    onPick: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  };
  render(<MilestonePicker {...props} />);
  return props;
}

describe("MilestonePicker (i0005)", () => {
  it("lists the board's milestones and the target status", () => {
    renderPicker({ status: "discuss" });

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    // the status the card is being moved to is surfaced
    expect(screen.getByRole("dialog")).toHaveTextContent("discuss");
  });

  it("picks a milestone with its folder + id", () => {
    const { onPick } = renderPicker();

    fireEvent.click(screen.getByText("Beta"));
    expect(onPick).toHaveBeenCalledExactlyOnceWith("m02-beta", "m02");
  });

  it("c0085: has no 'Stay in inbox' / 'Move back' dismiss button", () => {
    renderPicker();

    expect(
      screen.queryByRole("button", { name: /stay in inbox|move back/i }),
    ).not.toBeInTheDocument();
  });

  it("c0085: dismisses (cancels) on Escape", () => {
    const { onDismiss } = renderPicker();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("dismisses on a backdrop click", () => {
    const { onDismiss } = renderPicker();

    fireEvent.click(screen.getByTestId("milestone-picker-backdrop"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
