import { useEffect } from "react";
import type { Card, Epic } from "../lib/cards";
import "./EpicDetail.css";

/**
 * i0028: the **minimal** epic view opened after creating an epic (or by
 * selecting one). Shows the epic's goal / definition-of-done (read-only stub)
 * and a rollup of its child cards. The full goal/DoD editor is c0084.
 */
export function EpicDetail({
  epic,
  cards,
  onClose,
  onSelectCard,
}: {
  epic: Epic;
  /** The epic's child cards (may be empty for a fresh epic). */
  cards: Card[];
  onClose: () => void;
  onSelectCard?: (card: Card) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="epic-detail-backdrop" onClick={onClose}>
      <div
        className="epic-detail"
        role="dialog"
        aria-label={epic.id}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="epic-detail-header">
          <h2 className="epic-detail-title">{epic.title}</h2>
          <span className="epic-detail-status">{epic.status}</span>
          <button type="button" className="epic-detail-close" onClick={onClose}>
            Close
          </button>
        </header>

        {/* stub: the goal / definition-of-done text as written; c0084 makes it an editor */}
        <pre className="epic-detail-body">{epic.body.trim()}</pre>

        <section className="epic-detail-rollup">
          <h3>
            Cards <span className="epic-detail-count">{cards.length}</span>
          </h3>
          {cards.length === 0 ? (
            <p className="epic-detail-empty">No cards yet.</p>
          ) : (
            <ul className="epic-detail-cards">
              {cards.map((card) => (
                <li key={card.path}>
                  <button type="button" onClick={() => onSelectCard?.(card)}>
                    <span className="epic-detail-card-status">{card.status}</span>
                    <span className="epic-detail-card-title">{card.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="epic-detail-note">
          Full goal / definition-of-done editing lands in c0084.
        </p>
      </div>
    </div>
  );
}
