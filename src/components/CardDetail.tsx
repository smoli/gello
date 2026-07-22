import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card, CardFieldChanges } from "../lib/cards";
import { splitLogSection } from "../lib/markdown";
import {
  parseGelloQuestion,
  stripGelloQuestion,
  unfenceWithAnswer,
  type GelloAnswer,
} from "../lib/gello-question";
import { QuestionModal } from "./QuestionModal";
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
  /** Epic id to assign; null for the "No epic" (standalone) target (c0078). */
  milestoneId: string | null;
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
  onSaveEdit,
  onTriage,
  onReportIssue,
  onFollowUp,
  onOpenCardId,
  refCard,
  openIssues,
  followUps,
  startInEdit,
  onSaveImage,
  loadImage,
  onDelete,
  onArchive,
  onAnswerQuestion,
  onClose,
}: {
  card: Card;
  milestoneLabel: string | null;
  columns: string[];
  milestoneOptions: MilestoneOption[];
  onChangeFields: (changes: CardFieldChanges) => void;
  onSaveEdit: (edit: CardEdit, force: boolean) => Promise<SaveBodyResult>;
  onTriage: (folder: string, epicId: string | null) => void;
  onReportIssue: () => void;
  /** c0115: start a follow-up task for this finished card. */
  onFollowUp: () => void;
  onOpenCardId: (id: string) => void;
  refCard: RefCardInfo | null;
  openIssues: Card[];
  /** c0115: open follow-up tasks pointing at this card. */
  followUps: Card[];
  /** Open directly in edit mode (c035: fresh report-issue cards). */
  startInEdit?: boolean;
  /** c011: persist a pasted/dropped image; returns its board-relative path. */
  onSaveImage?: (file: File) => Promise<string>;
  /** c011: resolve a body image's src to a displayable URL (data URL). */
  loadImage?: (src: string) => Promise<string | null>;
  /** c0062: permanently delete this card (file + assets). */
  onDelete?: () => void;
  /** c018: move this card into (`true`) or out of (`false`) its `archive/`. */
  onArchive?: (archived: boolean) => void;
  /** c0101: answer a parked gelloquestion — the app writes the un-fenced body. */
  onAnswerQuestion?: (newBody: string) => void;
  onClose: () => void;
}) {
  // c041: the Log section is machine-managed — only the part before it is
  // editable; the log is reattached untouched on save
  const { editable: editableBody, log: logSection } = splitLogSection(card.body);

  // c0101: an active gelloquestion — pop the answer modal on open (the detail
  // remounts per card, so this initializes fresh each time), render the
  // question in a panel, and strip the fence from the main body.
  const question = parseGelloQuestion(card.body);
  const [answering, setAnswering] = useState(question !== null);
  const submitAnswer = (answer: GelloAnswer) => {
    const newBody = unfenceWithAnswer(card.body, answer);
    if (newBody !== null) onAnswerQuestion?.(newBody);
    setAnswering(false);
  };

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
            {/* c0115: a problem can surface at any point, so report-issue is
                offered on every card; follow-up is about work already finished. */}
            <button type="button" onClick={onReportIssue}>
              Report issue
            </button>
            {(card.status === "review" || card.status === "done") && (
              <button
                type="button"
                onClick={onFollowUp}
                title="Creates a task in ready — a running companion starts on it"
              >
                Follow up
              </button>
            )}
            {!editing && (
              <button type="button" onClick={startEdit}>
                Edit
              </button>
            )}
            {/* c018: archiving is for cards that are long done — offered on a
                done card, and reversed from the archived card itself. */}
            {onArchive && !editing && (card.archived || card.status === "done") && (
              <button type="button" onClick={() => onArchive(!card.archived)}>
                {card.archived ? "Unarchive" : "Archive"}
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
              // c0088/i0031: a no-epic card (card.epic null) matches the
              // "No epic" option (milestoneId null); an epic card matches its id.
              value={
                milestoneOptions.find((o) => o.milestoneId === card.epic)?.folder ?? ""
              }
              onChange={(event) => {
                const option = milestoneOptions.find(
                  (o) => o.folder === event.target.value,
                );
                if (option) onTriage(option.folder, option.milestoneId);
              }}
            >
              {/* a card whose epic isn't among the options (e.g. a legacy id)
                  still shows its label rather than an empty select */}
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
            {/* c0115: an issue was found in its parent; a follow-up follows it */}
            {card.type === "issue" ? "found in: " : "follow-up to: "}
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
        {/* c0115: kept separate from open issues — an unresolved problem reads
            differently from planned extra work. */}
        {followUps.length > 0 && (
          <div className="card-backlinks">
            <span className="field-label">Follow-ups from this card:</span>
            {followUps.map((followUp) => (
              <button
                key={followUp.path}
                type="button"
                className="card-link"
                onClick={() => onOpenCardId(followUp.id)}
              >
                {followUp.id} — {followUp.title}
              </button>
            ))}
          </div>
        )}
        {/* c0101: the parked question in its own panel, above the body */}
        {question && !editing && (
          <div className="gello-question-panel">
            <p className="gello-question-panel-label">Agent question</p>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.inner}</ReactMarkdown>
            <button
              type="button"
              className="gello-question-panel-answer"
              onClick={() => setAnswering(true)}
            >
              Answer
            </button>
          </div>
        )}
        <div className="card-detail-body" hidden={editing}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
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
            {question ? stripGelloQuestion(card.body) : card.body}
          </ReactMarkdown>
        </div>
      </div>
      {question && answering && (
        <QuestionModal
          cardId={card.id}
          question={question}
          onAnswer={submitAnswer}
          onCancel={() => setAnswering(false)}
        />
      )}
    </div>
  );
}
