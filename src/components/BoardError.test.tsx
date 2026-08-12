import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BoardError } from "./BoardError";

const LONG = `auto-commit failed: pre-commit hook failed\n${"cargo test output line\n".repeat(200)}`;

describe("BoardError (i0141)", () => {
  it("shows a short message in full, with no details toggle", () => {
    render(<BoardError message="disk full" onDismiss={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toContain("disk full");
    expect(screen.queryByRole("button", { name: /details/i })).toBeNull();
  });

  it("collapses a long message to its first line", () => {
    render(<BoardError message={LONG} onDismiss={vi.fn()} />);

    const summary = screen.getByTestId("board-error-summary");
    expect(summary.textContent).toContain("auto-commit failed: pre-commit hook failed");
    expect(summary.textContent).not.toContain("cargo test output line");
    expect(screen.queryByTestId("board-error-detail")).toBeNull();
  });

  it("truncates a single overlong line", () => {
    const oneLine = `boom: ${"x".repeat(500)}`;
    render(<BoardError message={oneLine} onDismiss={vi.fn()} />);

    const summary = screen.getByTestId("board-error-summary");
    expect(summary.textContent!.length).toBeLessThan(200);
    expect(summary.textContent).toContain("…");
    expect(screen.getByRole("button", { name: /show details/i })).toBeTruthy();
  });

  it("reveals the full text on demand and hides it again", () => {
    render(<BoardError message={LONG} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /show details/i }));
    const detail = screen.getByTestId("board-error-detail");
    expect(detail.textContent).toContain("cargo test output line");
    expect(detail.textContent).toContain("auto-commit failed");

    fireEvent.click(screen.getByRole("button", { name: /hide details/i }));
    expect(screen.queryByTestId("board-error-detail")).toBeNull();
  });

  it("re-collapses when a new error arrives", () => {
    const { rerender } = render(<BoardError message={LONG} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /show details/i }));
    expect(screen.getByTestId("board-error-detail")).toBeTruthy();

    rerender(<BoardError message={`${LONG}!`} onDismiss={vi.fn()} />);
    expect(screen.queryByTestId("board-error-detail")).toBeNull();
  });

  it("dismisses", () => {
    const onDismiss = vi.fn();
    render(<BoardError message="disk full" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
