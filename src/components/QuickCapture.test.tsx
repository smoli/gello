import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuickCapture } from "./QuickCapture";

describe("QuickCapture", () => {
  it("opens the capture form with an autofocused title input", () => {
    render(<QuickCapture onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));

    const title = screen.getByLabelText("Title");
    expect(title).toHaveFocus();
  });

  it("submits title and body, then closes and resets", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dark mode" },
    });
    fireEvent.change(screen.getByLabelText("Details"), {
      target: { value: "Some notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Dark mode", "Some notes", "task");
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();

    // reopens empty
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("submits from the title input with Enter", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Quick one" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });

    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Quick one", "", "task");
  });

  it("offers a visible '+ New bug' button (c034)", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /new bug/i }));
    expect(screen.getByText(/new bug/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Broken" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });

    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Broken", "", "bug");
  });

  it("opens in bug mode via mod+B and creates a bug (c024)", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} />);

    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(screen.getByText(/new bug/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "It crashed" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });

    expect(onCreate).toHaveBeenCalledExactlyOnceWith("It crashed", "", "bug");
  });

  it("ignores submission with an empty title", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("closes on Escape without creating", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("opens via the global mod+N shortcut", () => {
    render(<QuickCapture onCreate={vi.fn()} />);

    fireEvent.keyDown(window, { key: "n", metaKey: true });

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });
});
