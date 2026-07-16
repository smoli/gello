import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card, CardFieldChanges, Priority } from "../lib/cards";
import "./CardDetail.css";

const PRIORITIES: Priority[] = ["low", "normal", "high"];

export type SaveBodyResult = "saved" | "conflict";

export interface CardEdit {
  title: string;
  body: string;
}

export interface MilestoneOption {
  folder: string;
  milestoneId: string;
  label: string;
}

export function CardDetail({
  card,
  milestoneLabel,
  columns,
  milestoneOptions,
  onChangeFields,
  onToggleTask,
  onSaveEdit,
  onTriage,
  onClose,
}: {
  card: Card;
  milestoneLabel: string | null;
  columns: string[];
  milestoneOptions: MilestoneOption[];
  onChangeFields: (changes: CardFieldChanges) => void;
  onToggleTask: (index: number) => void;
  onSaveEdit: (edit: CardEdit, force: boolean) => Promise<SaveBodyResult>;
  onTriage: (folder: string, milestoneId: string) => void;
  onClose: () => void;
}) {
  const [tagsDraft, setTagsDraft] = useState(card.tags.join(", "));
  const [editing, setEditing] = useState(false);
  const [bodyDraft, setBodyDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [conflict, setConflict] = useState(false);

  // c023: Escape must close the dialog regardless of focus — the dialog
  // element only receives key events while focus is inside it, and after a
  // card click focus stays on the card front. Window-level listener instead;
  // suspended while editing (the editor owns Escape = cancel edit).
  useEffect(() => {
    if (editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, onClose]);

  const startEdit = () => {
    setBodyDraft(card.body);
    setTitleDraft(card.title);
    setConflict(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setConflict(false);
  };

  const save = async (force: boolean) => {
    const result = await onSaveEdit(
      // blank titles fall back to the original — no accidental nameless cards
      { title: titleDraft.trim() || card.title, body: bodyDraft },
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

  // assigns document-order indices to task checkboxes during the single
  // synchronous markdown render pass
  const taskCounter = { current: -1 };

  const commitTags = () => {
    const tags = tagsDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");
    onChangeFields({ tags });
  };

  return (
    <div className="card-detail-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-label={card.id}
        className="card-detail"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="card-detail-header">
          <div className="card-detail-title">
            <span className="card-id">{card.id}</span>
            {editing ? (
              <input
                aria-label="Card title"
                className="card-title-input"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={editorKeyDown}
              />
            ) : (
              <h1>{card.title}</h1>
            )}
          </div>
          <div className="card-detail-actions">
            {!editing && (
              <button type="button" onClick={startEdit}>
                Edit
              </button>
            )}
            <button type="button" aria-label="close" onClick={onClose}>
              ✕
            </button>
          </div>
        </header>

        <div className="card-detail-fields">
          <label>
            Status
            <select
              aria-label="Status"
              value={card.status}
              onChange={(event) => onChangeFields({ status: event.target.value })}
            >
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Priority"
              value={card.priority}
              onChange={(event) =>
                onChangeFields({ priority: event.target.value as Priority })
              }
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tags
            <input
              aria-label="Tags"
              value={tagsDraft}
              onChange={(event) => setTagsDraft(event.target.value)}
              onBlur={commitTags}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitTags();
              }}
            />
          </label>
          {milestoneLabel === null ? (
            <label>
              Milestone
              <select
                aria-label="Milestone"
                value="inbox"
                onChange={(event) => {
                  const option = milestoneOptions.find(
                    (o) => o.folder === event.target.value,
                  );
                  if (option) onTriage(option.folder, option.milestoneId);
                }}
              >
                <option value="inbox">inbox</option>
                {milestoneOptions.map((option) => (
                  <option key={option.folder} value={option.folder}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="card-detail-milestone">
              <span className="field-label">Milestone</span>
              <span className="card-milestone">{milestoneLabel}</span>
            </div>
          )}
        </div>

        {editing && (
          <div className="card-detail-editor">
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
            <textarea
              aria-label="Card body"
              value={bodyDraft}
              autoFocus
              onChange={(event) => setBodyDraft(event.target.value)}
              onKeyDown={editorKeyDown}
            />
            <div className="editor-actions">
              <button type="button" onClick={() => void save(false)}>
                Save
              </button>
              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="card-detail-body" hidden={editing}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              input: (props) => {
                if (props.type !== "checkbox") return <input {...props} />;
                taskCounter.current += 1;
                const index = taskCounter.current;
                return (
                  <input
                    type="checkbox"
                    checked={props.checked === true}
                    onChange={() => onToggleTask(index)}
                  />
                );
              },
            }}
          >
            {card.body}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
