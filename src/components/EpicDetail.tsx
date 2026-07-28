import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card, Epic, EpicFieldChanges } from "../lib/cards";
import type { EpicEdit } from "../lib/board-actions";
import { DOD_HEADING, GOAL_HEADING } from "../lib/board-actions";
import { readSection } from "../lib/markdown";
import type { SaveBodyResult } from "./CardDetail";
import "./EpicDetail.css";

/**
 * The epic detail view: i0028 opened it (read-only stub), c0084 made it the
 * real thing — a Goal / Definition-of-done editor over `epic.md`, editable
 * title and status, and a rollup of the epic's cards grouped by status.
 *
 * Writes follow CardDetail's discipline: the draft is held only while editing,
 * a save is one atomic write, and a file that changed underneath comes back as
 * a conflict (c015) instead of clobbering.
 */
export function EpicDetail({
  epic,
  cards,
  columns,
  onChangeFields,
  onSaveEdit,
  onClose,
  onSelectCard,
}: {
  epic: Epic;
  /** The epic's child cards (may be empty for a fresh epic). */
  cards: Card[];
  /** Board columns — the status options and the rollup's order. */
  columns: string[];
  onChangeFields: (changes: EpicFieldChanges) => void;
  onSaveEdit: (edit: EpicEdit, force: boolean) => Promise<SaveBodyResult>;
  onClose: () => void;
  onSelectCard?: (card: Card) => void;
}) {
  const goal = readSection(epic.body, GOAL_HEADING);
  const definitionOfDone = readSection(epic.body, DOD_HEADING);

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [dodDraft, setDodDraft] = useState("");
  const [conflict, setConflict] = useState(false);

  // c023: Escape closes the dialog whatever has focus — suspended while
  // editing, where Escape means "cancel the edit".
  useEffect(() => {
    if (editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, onClose]);

  const startEdit = () => {
    setTitleDraft(epic.title);
    setGoalDraft(goal);
    setDodDraft(definitionOfDone);
    setConflict(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setConflict(false);
  };

  const save = async (force: boolean) => {
    const result = await onSaveEdit(
      {
        // a blank title falls back to the current one — no nameless epics
        title: titleDraft.trim() || epic.title,
        goal: goalDraft,
        definitionOfDone: dodDraft,
      },
      force,
    );
    if (result === "saved") {
      setEditing(false);
      setConflict(false);
    } else {
      setConflict(true);
    }
  };

  const editorKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      cancelEdit();
    }
    if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void save(false);
    }
  };

  // c018: archived cards are long done and off the board — the rollup counts
  // the epic's live work.
  const live = cards.filter((card) => !card.archived);
  const done = live.filter((card) => card.status === "done").length;
  // statuses in board order first, then any the board no longer defines
  const order = [...columns, ...live.map((card) => card.status)];
  const groups = [...new Set(order)]
    .map((status) => ({
      status,
      cards: live.filter((card) => card.status === status),
    }))
    .filter((group) => group.cards.length > 0);

  return (
    <div className="epic-detail-backdrop" onClick={onClose}>
      <div
        className="epic-detail"
        role="dialog"
        aria-label={epic.id}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="epic-detail-header">
          {editing ? (
            <input
              aria-label="Epic title"
              className="epic-detail-title-input"
              value={titleDraft}
              autoFocus
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={editorKeyDown}
            />
          ) : (
            <h2 className="epic-detail-title">{epic.title}</h2>
          )}
          <label className="epic-detail-status">
            Status
            <select
              aria-label="Status"
              value={epic.status}
              onChange={(event) => onChangeFields({ status: event.target.value })}
            >
              {/* an epic status the board no longer defines still shows */}
              {[...new Set([...columns, epic.status])].map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
          {!editing && (
            <button type="button" onClick={startEdit}>
              Edit
            </button>
          )}
          <button type="button" className="epic-detail-close" onClick={onClose}>
            Close
          </button>
        </header>

        {editing ? (
          <div className="epic-detail-editor">
            {conflict && (
              <div className="conflict-banner">
                <span>
                  This file changed on disk while you were editing — your draft
                  is untouched.
                </span>
                <span className="conflict-actions">
                  <button type="button" onClick={() => void save(true)}>
                    Overwrite
                  </button>
                  <button type="button" onClick={cancelEdit}>
                    Discard my edit
                  </button>
                </span>
              </div>
            )}
            <label className="epic-detail-field">
              Goal
              <textarea
                aria-label="Goal"
                value={goalDraft}
                onChange={(event) => setGoalDraft(event.target.value)}
                onKeyDown={editorKeyDown}
              />
            </label>
            <label className="epic-detail-field">
              Definition of done
              <textarea
                aria-label="Definition of done"
                value={dodDraft}
                onChange={(event) => setDodDraft(event.target.value)}
                onKeyDown={editorKeyDown}
              />
            </label>
            <div className="editor-actions">
              <button type="button" onClick={() => void save(false)}>
                Save
              </button>
              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
              <span className="editor-hint">
                Other sections of epic.md are left untouched.
              </span>
            </div>
          </div>
        ) : (
          <div className="epic-detail-body">
            <h3>Goal</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{goal}</ReactMarkdown>
            <h3>Definition of done</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{definitionOfDone}</ReactMarkdown>
          </div>
        )}

        <section className="epic-detail-rollup" aria-label="Cards">
          <h3>
            Cards <span className="epic-detail-count">{live.length}</span>
            {live.length > 0 && (
              <span className="epic-detail-progress">
                {done} of {live.length} done
              </span>
            )}
          </h3>
          {live.length === 0 ? (
            <p className="epic-detail-empty">No cards yet.</p>
          ) : (
            groups.map((group) => (
              <div key={group.status} className="epic-detail-group">
                <h4>
                  {group.status}
                  <span className="epic-detail-count">{group.cards.length}</span>
                </h4>
                <ul className="epic-detail-cards" aria-label={`${group.status} cards`}>
                  {group.cards.map((card) => (
                    <li key={card.path}>
                      <button type="button" onClick={() => onSelectCard?.(card)}>
                        <span className="epic-detail-card-id">{card.id}</span>
                        <span className="epic-detail-card-title">{card.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
