import { useEffect, useState } from "react";
import "./QuickCapture.css";

type CaptureMode = "task" | "bug";

/**
 * The idea inbox: a button (and global mod+N) opening a minimal capture
 * form; mod+B opens the same form in bug mode (c024). Title is the only
 * required field — triage happens later, on the board. Speed is the point.
 */
export function QuickCapture({
  onCreate,
}: {
  onCreate: (title: string, body: string, type: CaptureMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("task");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "n" || event.key === "b") {
        event.preventDefault();
        setMode(event.key === "b" ? "bug" : "task");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = () => {
    setOpen(false);
    setMode("task");
    setTitle("");
    setBody("");
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed, body, mode);
    close();
  };

  const openAs = (nextMode: CaptureMode) => {
    setMode(nextMode);
    setOpen(true);
  };

  if (!open) {
    return (
      <div className="quick-capture-buttons">
        <button
          type="button"
          className="quick-capture-button"
          onClick={() => openAs("task")}
        >
          + New idea
        </button>
        <button
          type="button"
          className="quick-capture-button quick-capture-button-bug"
          onClick={() => openAs("bug")}
        >
          + New bug
        </button>
      </div>
    );
  }

  return (
    <div
      className="quick-capture"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          // don't let Escape fall through to a card detail behind us
          event.stopPropagation();
          close();
        }
      }}
    >
      <p className="quick-capture-mode">
        {mode === "bug" ? "New bug" : "New idea"}
      </p>
      <label>
        Title
        <input
          aria-label="Title"
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="One line is enough"
        />
      </label>
      <label>
        Details
        <textarea
          aria-label="Details"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Optional"
          rows={3}
        />
      </label>
      <div className="quick-capture-actions">
        <button type="button" onClick={submit}>
          Add
        </button>
        <button type="button" onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}
