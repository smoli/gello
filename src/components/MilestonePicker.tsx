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
}: {
  options: MilestoneOption[];
  status: string;
  onPick: (folder: string, milestoneId: string) => void;
  onDismiss: () => void;
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
        aria-label="assign milestone"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="milestone-picker-hint">
          Move to <strong>{status}</strong> in milestone:
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
        </ul>
        <button
          type="button"
          className="milestone-picker-dismiss"
          onClick={onDismiss}
        >
          Stay in inbox
        </button>
      </div>
    </div>
  );
}
