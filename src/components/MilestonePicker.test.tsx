import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MilestonePicker } from "./MilestonePicker";

const OPTIONS = [
  { folder: "m01-alpha", milestoneId: "m01", label: "Alpha" },
  { folder: "m02-beta", milestoneId: "m02", label: "Beta" },
];

describe("MilestonePicker (i0005)", () => {
  it("lists the board's milestones and the target status", () => {
    render(
      <MilestonePicker
        options={OPTIONS}
        status="discuss"
        onPick={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    // the status the card is being moved to is surfaced
    expect(screen.getByRole("dialog")).toHaveTextContent("discuss");
  });

  it("picks a milestone with its folder + id", () => {
    const onPick = vi.fn();
    render(
      <MilestonePicker
        options={OPTIONS}
        status="ready"
        onPick={onPick}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Beta"));
    expect(onPick).toHaveBeenCalledExactlyOnceWith("m02-beta", "m02");
  });

  it("dismisses via the stay-in-inbox action", () => {
    const onDismiss = vi.fn();
    render(
      <MilestonePicker
        options={OPTIONS}
        status="ready"
        onPick={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /stay in inbox/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("dismisses on Escape", () => {
    const onDismiss = vi.fn();
    render(
      <MilestonePicker
        options={OPTIONS}
        status="ready"
        onPick={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("dismisses on a backdrop click", () => {
    const onDismiss = vi.fn();
    render(
      <MilestonePicker
        options={OPTIONS}
        status="ready"
        onPick={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByTestId("milestone-picker-backdrop"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
