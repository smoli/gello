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

  it("offers a visible '+ New issue' button (c034)", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /new issue/i }));
    expect(screen.getByText(/new issue/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Broken" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });

    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Broken", "", "issue");
  });

  it("opens in issue mode via mod+I and creates an issue (c024)", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} />);

    fireEvent.keyDown(window, { key: "i", metaKey: true });
    expect(screen.getByText(/new issue/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "It crashed" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });

    expect(onCreate).toHaveBeenCalledExactlyOnceWith("It crashed", "", "issue");
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

  it("i0013: pasting an image into the draft inserts a link (with the draft's type)", async () => {
    const onSaveImage = vi.fn().mockResolvedValue("../assets/c0008/shot.png");
    render(<QuickCapture onCreate={vi.fn()} onSaveImage={onSaveImage} />);

    fireEvent.click(screen.getByRole("button", { name: /new issue/i }));
    const details = screen.getByLabelText("Details") as HTMLTextAreaElement;

    const file = new File([new Uint8Array([1])], "shot.png", { type: "image/png" });
    fireEvent.paste(details, {
      clipboardData: {
        items: [{ kind: "file", type: "image/png", getAsFile: () => file }],
        files: [file],
      },
    });

    await vi.waitFor(() => {
      expect(onSaveImage).toHaveBeenCalledExactlyOnceWith("issue", file);
      expect(details.value).toBe("![shot](../assets/c0008/shot.png)");
    });
  });

  it("i0013: cancelling the draft discards the reserved id", () => {
    const onDiscard = vi.fn();
    render(<QuickCapture onCreate={vi.fn()} onDiscard={onDiscard} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDiscard).toHaveBeenCalledOnce();
  });
});
