import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WindowControls } from "./WindowControls";
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  onWindowResized,
  toggleMaximizeWindow,
} from "../lib/window";

vi.mock("../lib/window", () => ({
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  isWindowMaximized: vi.fn().mockResolvedValue(false),
  onWindowResized: vi.fn().mockResolvedValue(() => {}),
}));

describe("WindowControls (i0017)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isWindowMaximized).mockResolvedValue(false);
    vi.mocked(onWindowResized).mockResolvedValue(() => {});
  });

  it("renders minimize, maximize, and close", () => {
    render(<WindowControls />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maximize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("wires each control to its window action", () => {
    render(<WindowControls />);
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(minimizeWindow).toHaveBeenCalledOnce();
    expect(toggleMaximizeWindow).toHaveBeenCalledOnce();
    expect(closeWindow).toHaveBeenCalledOnce();
  });

  it("shows a Restore label/icon when the window is maximized", async () => {
    vi.mocked(isWindowMaximized).mockResolvedValue(true);
    render(<WindowControls />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Maximize" })).not.toBeInTheDocument();
  });
});
