import { useEffect } from "react";
import type { MilestoneOption } from "./CardDetail";
import "./MilestonePicker.css";

/**
 * i0005: inline milestone picker shown when a milestone-less inbox card is
 * dropped on a triage column (discuss/backlog/ready). Picking a milestone
 * triages the card into it with the dropped-on status; dismissing (Escape,
 * backdrop, or "Stay in inbox") applies the status only and leaves the card
 * in the inbox (preserving the c030 escape hatch).
 */
export function MilestonePicker({
  options,
  status,
  onPick,
  onDismiss,
  onNewEpic,
}: {
  options: MilestoneOption[];
  /** The dropped-on column — the status a pick will apply. */
  status: string;
  onPick: (folder: string, epicId: string | null) => void;
  /** c0085: dismiss = cancel the whole drop (Escape / backdrop); no change. */
  onDismiss: () => void;
  /** i0028: create a new epic inline and assign this card to it. */
  onNewEpic?: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="milestone-picker-backdrop"
      data-testid="milestone-picker-backdrop"
      onClick={onDismiss}
    >
      <div
        className="milestone-picker"
        role="dialog"
        aria-label="assign epic"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="milestone-picker-hint">
          Move to <strong>{status}</strong> in epic:
        </p>
        <ul className="milestone-picker-list">
          {options.map((option) => (
            <li key={option.folder}>
              <button
                type="button"
                onClick={() => onPick(option.folder, option.milestoneId)}
              >
                {option.label}
              </button>
            </li>
          ))}
          {onNewEpic && (
            <li>
              <button
                type="button"
                className="milestone-picker-new-epic"
                onClick={onNewEpic}
              >
                + New epic…
              </button>
            </li>
          )}
        </ul>
        <p className="milestone-picker-cancel-hint">Esc to cancel</p>
      </div>
    </div>
  );
}
