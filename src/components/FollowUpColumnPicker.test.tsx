import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { FollowUpColumnPicker } from "./FollowUpColumnPicker";

describe("FollowUpColumnPicker (c0131)", () => {
  const columns = ["inbox", "discuss", "backlog", "ready"];

  it("lists the given columns and names the card it follows up on", () => {
    render(
      <FollowUpColumnPicker
        sourceId="c006"
        columns={columns}
        onPick={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: /follow up on c006/i });
    for (const col of columns) {
      expect(within(dialog).getByRole("button", { name: col })).toBeInTheDocument();
    }
  });

  it("reports the picked column", () => {
    const onPick = vi.fn();
    render(
      <FollowUpColumnPicker
        sourceId="c006"
        columns={columns}
        onPick={onPick}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "backlog" }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith("backlog");
  });

  it("cancels on Escape and on a backdrop click", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <FollowUpColumnPicker
        sourceId="c006"
        columns={columns}
        onPick={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector(".followup-picker-backdrop")!);
    expect(onCancel).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("does not cancel when the dialog body itself is clicked", () => {
    const onCancel = vi.fn();
    render(
      <FollowUpColumnPicker
        sourceId="c006"
        columns={columns}
        onPick={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
