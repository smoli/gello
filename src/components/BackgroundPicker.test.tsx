import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BackgroundPicker } from "./BackgroundPicker";

function props(overrides = {}) {
  return {
    current: null as string | null,
    position: { x: 10, y: 10 },
    onPreview: vi.fn(),
    onCommit: vi.fn(),
    onRemove: vi.fn(),
    onPickImage: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("BackgroundPicker", () => {
  it("has Image / Color / Gradient modes", () => {
    render(<BackgroundPicker {...props()} />);
    expect(screen.getByRole("button", { name: "Image" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Color" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gradient" })).toBeInTheDocument();
  });

  it("color mode previews live and commits the hex", () => {
    const p = props();
    render(<BackgroundPicker {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Color" }));
    fireEvent.change(screen.getByLabelText("Background color"), {
      target: { value: "#123456" },
    });
    expect(p.onPreview).toHaveBeenLastCalledWith("#123456");

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(p.onCommit).toHaveBeenCalledWith("#123456");
  });

  it("gradient mode previews a linear-gradient with the angle", () => {
    const p = props();
    render(<BackgroundPicker {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Gradient" }));
    fireEvent.change(screen.getByLabelText("Angle"), { target: { value: "90" } });

    expect(p.onPreview).toHaveBeenLastCalledWith(
      expect.stringMatching(/^linear-gradient\(90deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/),
    );
  });

  it("pre-populates from an existing gradient background", () => {
    render(
      <BackgroundPicker
        {...props({ current: "linear-gradient(120deg, #ff0000, #0000ff)" })}
      />,
    );
    // gradient mode active → angle control shows 120
    expect(screen.getByLabelText("Angle")).toHaveValue("120");
  });

  it("shows Remove only when a background is set", () => {
    const p = props({ current: "#000000" });
    render(<BackgroundPicker {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(p.onRemove).toHaveBeenCalledTimes(1);
  });

  it("hides Remove when nothing is set", () => {
    render(<BackgroundPicker {...props({ current: null })} />);
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("image mode triggers the file picker", () => {
    const p = props();
    render(<BackgroundPicker {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Image" }));
    fireEvent.click(screen.getByRole("button", { name: /choose image/i }));
    expect(p.onPickImage).toHaveBeenCalledTimes(1);
  });

  it("Cancel reverts the preview and closes", () => {
    const p = props();
    render(<BackgroundPicker {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Color" }));
    fireEvent.change(screen.getByLabelText("Background color"), {
      target: { value: "#abcdef" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(p.onPreview).toHaveBeenLastCalledWith(null);
    expect(p.onClose).toHaveBeenCalled();
  });
});
