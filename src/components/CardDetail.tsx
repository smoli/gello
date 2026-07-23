import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card, CardFieldChanges } from "../lib/cards";
import type { Dependency, DependencyOption } from "../lib/board";
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
  dependencies = [],
  blocking = [],
  dependencyOptions = [],
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
  /** c0124: this card's own `depends`, resolved against the board. */
  dependencies?: Dependency[];
  /** c0124: the cards waiting on this one — derived, so read-only here. */
  blocking?: Card[];
  /** c0124: what this card could be made to depend on, loop-closers flagged. */
  dependencyOptions?: DependencyOption[];
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
  // c0124: why the last pick was turned down (a loop), shown next to the picker
  const [dependencyRefusal, setDependencyRefusal] = useState<string | null>(null);
  // c0127: the tokenized add-dependency input — what has been typed and which
  // suggestion is highlighted. A dropdown of every card does not scale; typing
  // narrows it, email-recipient style.
  const [depQuery, setDepQuery] = useState("");
  const [depActive, setDepActive] = useState(0);
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

  // c0127: the cards matching what has been typed, capped so a long board does
  // not fill the panel — narrowing further is a keystroke away. Match id or
  // title, case-insensitively; nothing shows until something is typed.
  const DEP_SUGGESTION_CAP = 8;
  const depTrimmed = depQuery.trim().toLowerCase();
  const depSuggestions =
    depTrimmed === ""
      ? []
      : dependencyOptions
          .filter(
            (option) =>
              option.id.toLowerCase().includes(depTrimmed) ||
              option.title.toLowerCase().includes(depTrimmed),
          )
          .slice(0, DEP_SUGGESTION_CAP);

  /** c0124: take the pick unless it would close a loop — a cycle leaves every
   *  card in it blocked forever, with nothing on the board saying why. */
  const addDependency = (id: string) => {
    const option = dependencyOptions.find((candidate) => candidate.id === id);
    if (!option) return;
    if (option.cycle !== null) {
      setDependencyRefusal(
        `Would create a cycle: ${[card.id, ...option.cycle].join(" → ")}`,
      );
      return;
    }
    setDependencyRefusal(null);
    // c0127: a taken pick empties the field, so the next one starts fresh
    setDepQuery("");
    setDepActive(0);
    onChangeFields({ depends: [...card.depends, id] });
  };

  const removeDependency = (id: string) => {
    setDependencyRefusal(null);
    onChangeFields({ depends: card.depends.filter((dep) => dep !== id) });
  };

  /** c0127: keyboard on the add-dependency input — arrows move the highlight,
   *  Enter takes it, Escape drops the suggestions without closing the dialog. */
  const dependencyInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setDepActive((i) => Math.min(depSuggestions.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setDepActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      const pick = depSuggestions[depActive];
      if (pick) {
        event.preventDefault();
        addDependency(pick.id);
      }
    } else if (event.key === "Escape" && depQuery !== "") {
      // stop the window-level Escape from closing the whole dialog (c023)
      event.stopPropagation();
      setDepQuery("");
      setDepActive(0);
    }
  };

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
        {/* c0124: `depends` used to be visible only in the raw Markdown. The
            full picture belongs here — every dependency and where it stands —
            unlike the card front (c0123), which names only what still blocks. */}
        {(dependencies.length > 0 || dependencyOptions.length > 0) && (
          <div className="card-backlinks card-depends">
            <span className="field-label">Depends on:</span>
            {dependencies.map(({ id, card: dependency }) => (
              <span
                key={id}
                className={
                  dependency === null || dependency.status !== "done"
                    ? "card-depends-entry card-depends-open"
                    : "card-depends-entry"
                }
              >
                {dependency !== null ? (
                  <>
                    <button
                      type="button"
                      className="card-link"
                      onClick={() => onOpenCardId(id)}
                    >
                      {id} — {dependency.title}
                    </button>
                    <span className="card-depends-status">{dependency.status}</span>
                  </>
                ) : (
                  <span className="card-ref-dangling">
                    {id} (not found on this board)
                  </span>
                )}
                <button
                  type="button"
                  className="card-depends-remove"
                  aria-label={`Remove dependency ${id}`}
                  title="Remove this dependency"
                  onClick={() => removeDependency(id)}
                >
                  ×
                </button>
              </span>
            ))}
            {dependencyOptions.length > 0 && (
              // c0127: type-to-filter instead of a dropdown of every card. The
              // resolved dependencies above are the tokens; this adds another.
              <span className="card-depends-add">
                <input
                  type="text"
                  aria-label="Add dependency"
                  className="card-depends-input"
                  placeholder="Add dependency…"
                  value={depQuery}
                  onChange={(event) => {
                    setDepQuery(event.target.value);
                    setDepActive(0);
                    setDependencyRefusal(null);
                  }}
                  onKeyDown={dependencyInputKeyDown}
                />
                {depSuggestions.length > 0 && (
                  <ul
                    className="card-depends-suggestions"
                    role="listbox"
                    aria-label="Dependency suggestions"
                  >
                    {depSuggestions.map((option, i) => (
                      <li key={option.id} className="card-depends-suggestion-row">
                        <button
                          type="button"
                          role="option"
                          aria-selected={i === depActive}
                          className={
                            i === depActive
                              ? "card-depends-suggestion card-depends-suggestion-active"
                              : "card-depends-suggestion"
                          }
                          onClick={() => addDependency(option.id)}
                        >
                          {option.id} — {option.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            )}
            {dependencyRefusal !== null && (
              <span role="alert" className="card-depends-refusal">
                {dependencyRefusal}
              </span>
            )}
          </div>
        )}
        {/* c0124: the other direction — who finishing this card would release.
            Derived from their files, so it is read-only: a dependency is
            removed from the card that declares it. */}
        {blocking.length > 0 && (
          <div className="card-backlinks">
            <span className="field-label">Blocking:</span>
            {blocking.map((blocked) => (
              <button
                key={blocked.path}
                type="button"
                className="card-link"
                onClick={() => onOpenCardId(blocked.id)}
              >
                {blocked.id} — {blocked.title}
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
