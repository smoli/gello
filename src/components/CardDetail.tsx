import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card, CardFieldChanges } from "../lib/cards";
import { splitLogSection } from "../lib/markdown";
import { useImageInsert } from "./useImageInsert";
import { AssetImage } from "./AssetImage";
import "./CardDetail.css";

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

/** Resolution of this card's `ref`, computed by the App from the model. */
export interface RefCardInfo {
  exists: boolean;
  title: string | null;
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
  onReportIssue,
  onOpenCardId,
  refCard,
  openIssues,
  startInEdit,
  onSaveImage,
  loadImage,
  onDelete,
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
  onReportIssue: () => void;
  onOpenCardId: (id: string) => void;
  refCard: RefCardInfo | null;
  openIssues: Card[];
  /** Open directly in edit mode (c035: fresh report-issue cards). */
  startInEdit?: boolean;
  /** c011: persist a pasted/dropped image; returns its board-relative path. */
  onSaveImage?: (file: File) => Promise<string>;
  /** c011: resolve a body image's src to a displayable URL (data URL). */
  loadImage?: (src: string) => Promise<string | null>;
  /** c0062: permanently delete this card (file + assets). */
  onDelete?: () => void;
  onClose: () => void;
}) {
  // c041: the Log section is machine-managed — only the part before it is
  // editable; the log is reattached untouched on save
  const { editable: editableBody, log: logSection } = splitLogSection(card.body);

  const [tagsDraft, setTagsDraft] = useState(card.tags.join(", "));
  const [editing, setEditing] = useState(startInEdit ?? false);
  const [bodyDraft, setBodyDraft] = useState(startInEdit ? editableBody : "");
  const [titleDraft, setTitleDraft] = useState(startInEdit ? card.title : "");
  const [conflict, setConflict] = useState(false);
  // c0062: two-step guard for the destructive delete
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // c011: image paste/drop on the editor textarea (shared with quick capture)
  const imageInsert = useImageInsert(bodyDraft, setBodyDraft, onSaveImage);
  // c038: a click "on the backdrop" only counts if the press started there —
  // otherwise a text selection drifting outside the dialog would close it
  const pressStartedOnBackdrop = useRef(false);

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
    setBodyDraft(editableBody);
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
      // blank titles fall back to the original — no accidental nameless
      // cards; the machine-managed Log section is reattached untouched
      { title: titleDraft.trim() || card.title, body: bodyDraft + logSection },
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
    <div
      className="card-detail-backdrop"
      onMouseDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressStartedOnBackdrop.current) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-label={card.id}
        className="card-detail"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="card-detail-header">
          <div className="card-detail-title">
            <span className="card-id">
              {card.id}
              {card.type !== "task" && (
                <span className={`card-type type-${card.type}`}>{card.type}</span>
              )}
            </span>
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
            {(card.status === "review" || card.status === "done") && (
              <button type="button" onClick={onReportIssue}>
                Report issue
              </button>
            )}
            {!editing && (
              <button type="button" onClick={startEdit}>
                Edit
              </button>
            )}
            {onDelete && !editing && !confirmingDelete && (
              <button
                type="button"
                className="card-detail-delete"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
            )}
            {onDelete && confirmingDelete && (
              <span className="card-detail-delete-confirm" role="group" aria-label="confirm delete">
                <span>Delete card and its images?</span>
                <button
                  type="button"
                  className="card-detail-delete"
                  onClick={onDelete}
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)}>
                  Keep
                </button>
              </span>
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
          {/* i0005: assign (inbox) or reassign (triaged) a milestone from the
              detail — onTriage moves the file either way (inbox→milestone or
              milestone→milestone), without duplicating or losing it. */}
          <label>
            Epic
            <select
              aria-label="Epic"
              value={
                milestoneLabel === null
                  ? "inbox"
                  : (milestoneOptions.find((o) => o.milestoneId === card.epic)
                      ?.folder ?? "")
              }
              onChange={(event) => {
                const option = milestoneOptions.find(
                  (o) => o.folder === event.target.value,
                );
                if (option) onTriage(option.folder, option.milestoneId);
              }}
            >
              {milestoneLabel === null && <option value="inbox">inbox</option>}
              {milestoneLabel !== null &&
                !milestoneOptions.some((o) => o.milestoneId === card.epic) && (
                  <option value="">{milestoneLabel}</option>
                )}
              {milestoneOptions.map((option) => (
                <option key={option.folder} value={option.folder}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
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
              ref={imageInsert.ref}
              aria-label="Card body"
              value={bodyDraft}
              autoFocus
              onChange={(event) => setBodyDraft(event.target.value)}
              onKeyDown={editorKeyDown}
              onPaste={imageInsert.onPaste}
              onDrop={imageInsert.onDrop}
              onDragOver={imageInsert.onDragOver}
            />
            <div className="editor-actions">
              <button type="button" onClick={() => void save(false)}>
                Save
              </button>
              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
              {logSection !== "" && (
                <span className="editor-hint">
                  The ## Log section is machine-managed and preserved automatically.
                </span>
              )}
            </div>
          </div>
        )}
        {card.ref && (
          <div className="card-ref">
            found in:{" "}
            {refCard?.exists ? (
              <button
                type="button"
                className="card-link"
                onClick={() => onOpenCardId(card.ref!)}
              >
                {card.ref} — {refCard.title}
              </button>
            ) : (
              <span className="card-ref-dangling">
                {card.ref} (not found on this board)
              </span>
            )}
          </div>
        )}
        {openIssues.length > 0 && (
          <div className="card-backlinks">
            <span className="field-label">Open issues against this card:</span>
            {openIssues.map((issue) => (
              <button
                key={issue.path}
                type="button"
                className="card-link"
                onClick={() => onOpenCardId(issue.id)}
              >
                {issue.id} — {issue.title}
              </button>
            ))}
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
              // c011: local asset links can't load from the webview origin —
              // resolve them to a data URL via loadImage
              img: ({ src, alt }) => (
                <AssetImage
                  src={typeof src === "string" ? src : ""}
                  alt={alt ?? ""}
                  loadImage={loadImage}
                />
              ),
            }}
          >
            {card.body}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
