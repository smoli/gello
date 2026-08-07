import { useEffect, useState } from "react";
import "./BoardError.css";

/** Longest summary line the banner shows before it truncates. */
const SUMMARY_MAX = 140;

/** First line of the message, cut to SUMMARY_MAX; `truncated` says whether the
 *  banner is hiding anything (extra lines or a cut-off first line). */
function summarize(message: string): { summary: string; truncated: boolean } {
  const [first = "", ...rest] = message.trimEnd().split("\n");
  const line = first.trimEnd();
  if (line.length > SUMMARY_MAX) {
    return { summary: `${line.slice(0, SUMMARY_MAX).trimEnd()}…`, truncated: true };
  }
  return { summary: line, truncated: rest.some((l) => l.trim() !== "") };
}

/**
 * i0141: the error banner used to render the whole message inline, so a failing
 * pre-commit hook (a full `cargo test` log) covered the entire window with no
 * way out. The banner now shows one line and keeps the rest behind a toggle,
 * with the expanded text in its own scroll box.
 */
export function BoardError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // a new error starts collapsed — otherwise an open detail box from the
  // previous error swallows the next one
  useEffect(() => setExpanded(false), [message]);

  const { summary, truncated } = summarize(message);

  return (
    <div role="alert" className="board-error">
      <div className="board-error-line">
        <span className="board-error-summary" data-testid="board-error-summary">
          {summary}
        </span>
        {truncated && (
          <button
            type="button"
            className="board-error-toggle"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}
        <button
          type="button"
          className="board-error-dismiss"
          aria-label="Dismiss error"
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
      {expanded && (
        <pre className="board-error-detail" data-testid="board-error-detail">
          {message}
        </pre>
      )}
    </div>
  );
}
