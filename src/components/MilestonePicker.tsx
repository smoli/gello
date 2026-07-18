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
  fromStatus,
  onPick,
  onDismiss,
}: {
  options: MilestoneOption[];
  /** The dropped-on column — the status a milestone pick will apply. */
  status: string;
  /** The card's current status, so dismiss can return it to its origin. */
  fromStatus: string;
  onPick: (folder: string, epicId: string | null) => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  // Dismiss returns a card that already carries a meaningful flag (e.g.
  // discuss) to that status; a raw backlog idea keeps the c030 "flag it
  // forward" behavior — dismiss applies the dropped-on status instead.
  const dismissLabel =
    fromStatus === "backlog" ? "Stay in inbox" : `Move back to ${fromStatus}`;

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
        </ul>
        <button
          type="button"
          className="milestone-picker-dismiss"
          onClick={onDismiss}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
