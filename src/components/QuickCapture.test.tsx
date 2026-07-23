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

  // c0129: the capture and edit editors look alike now (c0122), but one
  // confirmed with Cmd+Enter and the other saved with Cmd+S. Cmd/Ctrl+S
  // confirms a new card too, so the same reflex works in both.

  it("c0129: Cmd+S submits from the Details textarea", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Save me" } });
    const details = screen.getByLabelText("Details");
    fireEvent.change(details, { target: { value: "some notes" } });

    // plain s is just a character, no submit
    fireEvent.keyDown(details, { key: "s" });
    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.keyDown(details, { key: "s", metaKey: true });
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Save me", "some notes", "task");
  });

  it("c0129: Ctrl+S also submits", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Ctrl save" } });
    fireEvent.keyDown(screen.getByLabelText("Details"), { key: "s", ctrlKey: true });
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Ctrl save", "", "task");
  });

  it("c0129: Cmd+S in the Title field submits exactly once", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Only once" } });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "s", metaKey: true });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith("Only once", "", "task");
  });

  it("c0129: Cmd+S prevents the browser's save-page default", () => {
    render(<QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Guarded" } });
    // fireEvent returns false when the handler called preventDefault
    const notDefaulted = fireEvent.keyDown(screen.getByLabelText("Details"), {
      key: "s",
      metaKey: true,
    });
    expect(notDefaulted).toBe(false);
  });

  it("c0129: Cmd+S with an empty title does not submit", () => {
    const onCreate = vi.fn();
    render(<QuickCapture onCreate={onCreate} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    fireEvent.keyDown(screen.getByLabelText("Details"), { key: "s", metaKey: true });
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toBeInTheDocument(); // still open
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

// c0122: the capture *is* the editor now — every new card opens in the same
// centred panel. c0116 grew it on body focus; that step is gone.

const panel = () => document.querySelector(".quick-capture") as HTMLElement;
const overlay = () => document.querySelector(".capture-overlay");

describe("c0122: every capture opens in the full editor", () => {
  const openIdea = (props = {}) => {
    const all = { onCreate: vi.fn(), onCreateEpic: vi.fn(), ...props };
    render(<QuickCapture {...all} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    return all;
  };

  it("centres the panel in an overlay instead of positioning it itself", () => {
    // c0122: the corner panel positioned itself, which collided with the
    // frameless shell's own `top` rule and left it hanging off the top edge.
    // An overlay that centres its child has no such rule to lose to.
    openIdea();
    expect(overlay()).not.toBeNull();
    expect(overlay()!.contains(panel())).toBe(true);
  });

  it("gives the body room straight away, with no focus step", () => {
    openIdea();
    expect(
      Number(screen.getByLabelText("Details").getAttribute("rows")),
    ).toBeGreaterThan(3);
  });

  it("opens in the editor for an issue capture", () => {
    render(<QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new issue/i }));
    expect(overlay()!.contains(panel())).toBe(true);
  });

  it("opens in the editor for an epic capture, where the body is the Goal", () => {
    render(<QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /new epic/i }));
    expect(overlay()!.contains(panel())).toBe(true);
    expect(Number(screen.getByLabelText("Goal").getAttribute("rows"))).toBeGreaterThan(3);
  });

  it("opens every capture the same way, not just the first", () => {
    const { onCreate } = openIdea();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "One" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onCreate).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    expect(overlay()!.contains(panel())).toBe(true);
  });

  it("still writes nothing until Add", () => {
    const { onCreate } = openIdea();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Still a draft" } });
    fireEvent.focus(screen.getByLabelText("Details"));
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "typing" } });

    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Still a draft", "typing", "task");
  });

  it("keeps plain Enter a newline and mod+Enter a submit", () => {
    const { onCreate } = openIdea();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Big idea" } });
    const details = screen.getByLabelText("Details");
    fireEvent.change(details, { target: { value: "line one" } });

    fireEvent.keyDown(details, { key: "Enter" });
    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.keyDown(details, { key: "Enter", metaKey: true });
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Big idea", "line one", "task");
  });

  it("i0013: an image pasted into the editor still lands", async () => {
    const onSaveImage = vi.fn().mockResolvedValue("../assets/c0008/shot.png");
    openIdea({ onSaveImage });
    const details = screen.getByLabelText("Details") as HTMLTextAreaElement;

    const file = new File([new Uint8Array([1])], "shot.png", { type: "image/png" });
    fireEvent.paste(details, {
      clipboardData: {
        items: [{ kind: "file", type: "image/png", getAsFile: () => file }],
        files: [file],
      },
    });

    await vi.waitFor(() => {
      expect(onSaveImage).toHaveBeenCalledExactlyOnceWith("task", file);
      expect(details.value).toBe("![shot](../assets/c0008/shot.png)");
    });
  });
});

describe("c0116: Escape guards a draft that has content", () => {
  const openIdea = () => {
    const props = { onCreate: vi.fn(), onCreateEpic: vi.fn(), onDiscard: vi.fn() };
    render(<QuickCapture {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    return props;
  };
  const confirmPrompt = () =>
    screen.queryByRole("group", { name: "confirm discard" });

  it("closes at once when the body is empty, title typed or not", () => {
    const { onDiscard } = openIdea();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Just a line" } });

    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("asks before throwing a written body away", () => {
    const { onDiscard } = openIdea();
    const details = screen.getByLabelText("Details");
    fireEvent.change(details, { target: { value: "a paragraph worth keeping" } });

    fireEvent.keyDown(details, { key: "Escape" });

    expect(confirmPrompt()).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument(); // still open
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("discards on confirm", () => {
    const { onDiscard } = openIdea();
    const details = screen.getByLabelText("Details");
    fireEvent.change(details, { target: { value: "a paragraph" } });
    fireEvent.keyDown(details, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("keeps the draft and its text on Keep", () => {
    const { onDiscard } = openIdea();
    const details = screen.getByLabelText("Details");
    fireEvent.change(details, { target: { value: "a paragraph" } });
    fireEvent.keyDown(details, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Keep" }));

    expect(confirmPrompt()).not.toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toHaveValue("a paragraph");
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("a second Escape dismisses the prompt rather than confirming it", () => {
    // a reflex double-tap must not blow straight through the guard
    const { onDiscard } = openIdea();
    const details = screen.getByLabelText("Details");
    fireEvent.change(details, { target: { value: "a paragraph" } });
    fireEvent.keyDown(details, { key: "Escape" });
    fireEvent.keyDown(details, { key: "Escape" });

    expect(confirmPrompt()).not.toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toHaveValue("a paragraph");
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("does not let Escape reach a card detail behind the panel", () => {
    const onOuterEscape = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === "Escape" && onOuterEscape()}>
        <QuickCapture onCreate={vi.fn()} onCreateEpic={vi.fn()} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /new idea/i }));
    const details = screen.getByLabelText("Details");
    fireEvent.change(details, { target: { value: "content" } });
    fireEvent.keyDown(details, { key: "Escape" });

    expect(onOuterEscape).not.toHaveBeenCalled();
  });
});
