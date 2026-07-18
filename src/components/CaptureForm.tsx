import { useRef, useState } from "react";
import { useImageInsert } from "./useImageInsert";
import "./QuickCapture.css";

/**
 * The minimal draft form shared by quick capture (⌘N/⌘I) and report-issue
 * (c037): nothing exists on disk until submit; Escape aborts without a
 * trace.
 */
export function CaptureForm({
  heading,
  detailsLabel = "Details",
  onSubmit,
  onCancel,
  onSaveImage,
}: {
  heading: string;
  /** i0028: label for the second field — "Goal" in epic mode, else "Details". */
  detailsLabel?: string;
  onSubmit: (title: string, body: string) => void;
  onCancel: () => void;
  /** i0013: persist a pasted/dropped image, returning its relative link path. */
  onSaveImage?: (file: File) => Promise<string>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const imageInsert = useImageInsert(body, setBody, onSaveImage);
  // i0016: latch so a single form instance can only submit once — no
  // duplicate card from a double handler, double-click, or fast key repeat
  const submitted = useRef(false);

  const submit = () => {
    if (submitted.current) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    submitted.current = true;
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
          return;
        }
        // c0064: Cmd/Ctrl+Enter submits from anywhere in the form (plain Enter
        // in the Details textarea stays a newline). This is the ONLY handler
        // for mod+Enter — the title input handles only plain Enter (i0016), so
        // one keypress can't submit twice. Ignore IME-composition Enter.
        if (
          event.key === "Enter" &&
          (event.metaKey || event.ctrlKey) &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          submit();
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
            // i0016: plain Enter only — Cmd/Ctrl+Enter is handled once at the
            // form level, so a mod+Enter here doesn't double-submit
            if (
              event.key === "Enter" &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.nativeEvent.isComposing
            ) {
              submit();
            }
          }}
          placeholder="One line is enough"
        />
      </label>
      <label>
        {detailsLabel}
        <textarea
          ref={imageInsert.ref}
          aria-label={detailsLabel}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onPaste={imageInsert.onPaste}
          onDrop={imageInsert.onDrop}
          onDragOver={imageInsert.onDragOver}
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
