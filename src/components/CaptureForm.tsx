import { useState } from "react";
import "./QuickCapture.css";

/**
 * The minimal draft form shared by quick capture (⌘N/⌘I) and report-issue
 * (c037): nothing exists on disk until submit; Escape aborts without a
 * trace.
 */
export function CaptureForm({
  heading,
  onSubmit,
  onCancel,
}: {
  heading: string;
  onSubmit: (title: string, body: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed, body);
  };

  return (
    <div
      className="quick-capture"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          // don't let Escape fall through to a card detail behind us
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <p className="quick-capture-mode">{heading}</p>
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
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
