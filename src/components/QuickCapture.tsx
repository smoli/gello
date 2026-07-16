import { useEffect, useState } from "react";
import "./QuickCapture.css";

/**
 * The idea inbox: a button (and global mod+N) opening a minimal capture
 * form. Title is the only required field — triage happens later, on the
 * board. Speed is the point.
 */
export function QuickCapture({
  onCreate,
}: {
  onCreate: (title: string, body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "n" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = () => {
    setOpen(false);
    setTitle("");
    setBody("");
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed, body);
    close();
  };

  if (!open) {
    return (
      <button
        type="button"
        className="quick-capture-button"
        onClick={() => setOpen(true)}
      >
        + New idea
      </button>
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
