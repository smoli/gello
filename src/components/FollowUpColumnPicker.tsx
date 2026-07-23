import { useEffect } from "react";
import "./FollowUpColumnPicker.css";

/**
 * c0131: shown when the follow-up target setting is "ask" — pick which column
 * the new follow-up lands in, then the draft opens targeting it. Dismissing
 * (Escape or backdrop) cancels the whole follow-up; nothing is created.
 */
export function FollowUpColumnPicker({
  sourceId,
  columns,
  onPick,
  onCancel,
}: {
  /** Id of the card being followed up on, for the dialog's accessible name. */
  sourceId: string;
  /** The columns offered, in board order. */
  columns: string[];
  onPick: (column: string) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="followup-picker-backdrop" onClick={onCancel}>
      <div
        className="followup-picker"
        role="dialog"
        aria-label={`Follow up on ${sourceId}`}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="followup-picker-hint">Follow-up lands in:</p>
        <ul className="followup-picker-list">
          {columns.map((column) => (
            <li key={column}>
              <button type="button" onClick={() => onPick(column)}>
                {column}
              </button>
            </li>
          ))}
        </ul>
        <p className="followup-picker-cancel-hint">Esc to cancel</p>
      </div>
    </div>
  );
}
