import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuickCapture } from "./QuickCapture";

describe("QuickCapture", () => {
  it("opens the capture form with an autofocused title input", () => {
    render(<QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));

    const title = screen.getByLabelText("Title");
    expect(title).toHaveFocus();
  });

  it("submits title and body, then closes and resets", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);

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
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Quick one" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });

    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Quick one", "", "task");
  });

  it("i0028: ⌘/Ctrl+E opens epic mode and submits title + goal via onCreateEpic", () => {
    const onCreateEpic = vi.fn();
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={onCreateEpic} />);

    fireEvent.keyDown(window, { key: "e", metaKey: true });
    expect(screen.getByText("New epic")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Dark mode" } });
    fireEvent.change(screen.getByLabelText("Goal"), {
      target: { value: "Ship a full dark theme." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreateEpic).toHaveBeenCalledExactlyOnceWith(
      "Dark mode",
      "Ship a full dark theme.",
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("i0028: the '+ New epic' button opens epic mode", () => {
    render(<QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new epic/i }));
    expect(screen.getByText("New epic")).toBeInTheDocument();
    expect(screen.getByLabelText("Goal")).toBeInTheDocument();
  });

  it("i0028: bumping openEpicSignal opens epic mode (external trigger)", () => {
    const { rerender } = render(
      <QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} openEpicSignal={0} />,
    );
    expect(screen.queryByText("New epic")).not.toBeInTheDocument();
    rerender(<QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} openEpicSignal={1} />);
    expect(screen.getByText("New epic")).toBeInTheDocument();
  });

  it("offers a visible '+ New issue' button (c034)", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);

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
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);

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
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("c0064: Cmd/Ctrl+Enter submits from the Details textarea", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Big idea" },
    });
    const details = screen.getByLabelText("Details");
    fireEvent.change(details, { target: { value: "line one" } });

    // plain Enter in the textarea must NOT submit (it's a newline)
    fireEvent.keyDown(details, { key: "Enter" });
    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.keyDown(details, { key: "Enter", metaKey: true });
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Big idea", "line one", "task");
  });

  it("i0016: Cmd/Ctrl+Enter in the Title field submits exactly once", () => {
    // regression: both the title-input and form-level Enter handlers used to
    // fire for one keypress, creating the card twice
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Only once" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), {
      key: "Enter",
      metaKey: true,
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith("Only once", "", "task");
  });

  it("i0016: submit is idempotent — a second Add click can't create a twin", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Guarded" },
    });
    const add = screen.getByRole("button", { name: "Add" });
    fireEvent.click(add);
    fireEvent.click(add); // double-click / fast second invocation
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("i0016: IME-composition Enter does not submit", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "日本語" },
    });
    fireEvent.keyDown(screen.getByLabelText("Title"), {
      key: "Enter",
      isComposing: true,
    });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("c0064: Ctrl+Enter also submits", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Ctrl idea" },
    });
    fireEvent.keyDown(screen.getByLabelText("Details"), {
      key: "Enter",
      ctrlKey: true,
    });
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Ctrl idea", "", "task");
  });

  it("closes on Escape without creating", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("opens via the global mod+N shortcut", () => {
    render(<QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} />);

    fireEvent.keyDown(window, { key: "n", metaKey: true });

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("i0013: pasting an image into the draft inserts a link (with the draft's type)", async () => {
    const onSaveImage = vi.fn().mockResolvedValue("../assets/c0008/shot.png");
    render(<QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} onSaveImage={onSaveImage} />);

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
    render(<QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} onDiscard={onDiscard} />);

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDiscard).toHaveBeenCalledOnce();
  });
});
