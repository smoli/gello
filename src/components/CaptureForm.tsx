import { useRef, useState } from "react";
import { useImageInsert } from "./useImageInsert";
import "./QuickCapture.css";

/**
 * The draft form behind every new card — quick capture (⌘N/⌘I/⌘E),
 * report-issue and follow-up (c037/c0118). Nothing exists on disk until
 * submit; Escape aborts without a trace (c0116: after confirming, once there
 * is a body to lose). c0122 made the roomy editor the standard: it opens
 * centred at full size rather than growing from a corner panel on focus.
 */
export function CaptureForm({
  heading,
  note,
  detailsLabel = "Details",
  onSubmit,
  onCancel,
  onSaveImage,
}: {
  heading: string;
  /** c0115: one line under the heading saying what submitting will set off —
   *  a follow-up lands in ready, where a running companion picks it up. */
  note?: string;
  /** i0028: label for the second field — "Goal" in epic mode, else "Details". */
  detailsLabel?: string;
  onSubmit: (title: string, body: string) => void;
  onCancel: () => void;
  /** i0013: persist a pasted/dropped image, returning its relative link path. */
  onSaveImage?: (file: File) => Promise<string>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // c0116: an editor this size can hold paragraphs, so one reflex Escape
  // costs more than it used to — ask first when there is a body to lose.
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
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
    // c0122: the overlay owns the centring. The panel used to place itself
    // (fixed, top-right, and centred once grown), which lost to the frameless
    // shell's own `top` rule for .quick-capture and left the grown editor
    // hanging off the top edge. A flex-centred overlay has no such rule to
    // lose to, and it is what the report-issue draft already did.
    <div className="capture-overlay">
      <div
        className="quick-capture"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            // don't let Escape fall through to a card detail behind us
            event.stopPropagation();
            // a second Escape dismisses the prompt — a reflex double-tap must
            // not blow through the guard it just raised
            if (confirmingDiscard) {
              setConfirmingDiscard(false);
              return;
            }
            if (body.trim() !== "") {
              setConfirmingDiscard(true);
              return;
            }
            onCancel();
            return;
          }
          // c0064: Cmd/Ctrl+Enter submits from anywhere in the form (plain
          // Enter in the Details textarea stays a newline). This is the ONLY
          // handler for mod+Enter — the title input handles only plain Enter
          // (i0016), so one keypress can't submit twice. Ignore IME Enter.
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
        {note && <p className="quick-capture-note">{note}</p>}
        <label>
          Title
          <input
            aria-label="Title"
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              // i0016: plain Enter only — Cmd/Ctrl+Enter is handled once at
              // the form level, so a mod+Enter here doesn't double-submit
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
            rows={16}
          />
        </label>
        <div className="quick-capture-actions">
          {confirmingDiscard ? (
            <span
              className="quick-capture-discard-confirm"
              role="group"
              aria-label="confirm discard"
            >
              <span>Discard this draft?</span>
              <button type="button" onClick={onCancel}>
                Discard
              </button>
              <button type="button" onClick={() => setConfirmingDiscard(false)}>
                Keep
              </button>
            </span>
          ) : (
            <>
              <button type="button" onClick={submit}>
                Add
              </button>
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
