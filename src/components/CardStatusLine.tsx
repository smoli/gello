import { Fragment } from "react";
import type { CardStatusLine as StatusLine } from "../lib/card-status";

// c0148: renders the resolved status line (card-status.ts). Plain text for
// every kind — what the card detail shows read-only — plus the interactive
// Restart button (stopped) and clickable blocked-dependency links when the card
// front passes handlers. One renderer, so the front and the detail can't drift.

/** The per-kind tooltip the card front has always shown. */
function titleFor(line: StatusLine): string | undefined {
  switch (line.kind) {
    case "activity":
      return line.stale ? "Companion may be stalled — its state file is over 30s old" : undefined;
    case "countdown":
      return "Drag the card out of this column to cancel";
    case "waiting-slot":
      return "Every in-progress slot is full — this starts when one frees up";
    case "blocked":
      return "Blocked — these dependencies are not done";
    case "startable":
      return "Startable — every dependency is done";
    default:
      return undefined;
  }
}

export function CardStatusLine({
  line,
  onRestart,
  onOpenBlocker,
}: {
  line: StatusLine | null;
  /** c0141: restart a stopped run (card front only). Absent → read-only text. */
  onRestart?: () => void;
  /** c0123: open a named blocker (card front only). Absent → read-only text. */
  onOpenBlocker?: (id: string) => void;
}) {
  if (!line) return null;

  // c0123: the blocked line names the unfinished dependencies; on the front
  // each is a link that opens that card.
  if (line.kind === "blocked" && line.blockers && onOpenBlocker) {
    return (
      <p className={line.className} role="status" title={titleFor(line)}>
        waiting on{" "}
        {line.blockers.map((blocker, i) => (
          <Fragment key={blocker.id}>
            {i > 0 && ", "}
            {blocker.missing ? (
              <span className="card-blocked-missing" title="No card with this id">
                {blocker.id} (missing)
              </span>
            ) : (
              <button
                type="button"
                className="card-blocked-link"
                onClick={(event) => {
                  event.stopPropagation(); // the whole front opens the card (c0118)
                  onOpenBlocker(blocker.id);
                }}
              >
                {blocker.id}
              </button>
            )}
          </Fragment>
        ))}
      </p>
    );
  }

  // c0141: a stopped run offers an in-place restart on the front.
  if (line.kind === "stopped" && onRestart) {
    return (
      <p className={line.className} role="status">
        run stopped —{" "}
        <button
          type="button"
          className="card-restart"
          title="Restart — resume the agent on this card"
          onClick={(event) => {
            event.stopPropagation(); // the whole front opens the card (c0118)
            onRestart();
          }}
        >
          Restart
        </button>
      </p>
    );
  }

  // every other case — and the detail's read-only view of stopped/blocked — is
  // plain text.
  return (
    <p className={line.className} role="status" title={titleFor(line)}>
      {line.text}
    </p>
  );
}
