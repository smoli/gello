import { useEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card, CardFieldChanges } from "../lib/cards";
import type { Dependency, DependencyOption } from "../lib/board";
import type { CardStatusLine as CardStatusLineData } from "../lib/card-status";
import { CardStatusLine } from "./CardStatusLine";
import { splitLogSection } from "../lib/markdown";
import { applyTagSuggestion, suggestTags } from "../lib/tags";
import {
  parseGelloQuestion,
  stripGelloQuestion,
  unfenceWithAnswer,
  type GelloAnswer,
} from "../lib/gello-question";
import {
  addReference,
  parseReferences,
  removeReference,
  stripReferences,
} from "../lib/references";
import { QuestionModal } from "./QuestionModal";
import { CardReferences } from "./CardReferences";
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
  tagOptions = [],
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
  onSaveFile,
  onChangeBody,
  onOpenReference,
  loadReferenceText,
  onDelete,
  onArchive,
  onAnswerQuestion,
  restartable = false,
  onRestart,
  statusLine = null,
  onClose,
}: {
  card: Card;
  milestoneLabel: string | null;
  /** c0148: the card's live status line, resolved by the App — shown read-only. */
  statusLine?: CardStatusLineData | null;
  columns: string[];
  milestoneOptions: MilestoneOption[];
  /** c0145: every tag in use on the board, to suggest while typing. */
  tagOptions?: string[];
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
  /** c0151: copy a reference document into the card's assets; returns its
   *  card-relative path. */
  onSaveFile?: (file: File) => Promise<string>;
  /** c0151: persist a body the detail rewrote itself (a reference added or
   *  removed). Given together with `onSaveFile`, the References panel appears. */
  onChangeBody?: (newBody: string) => void;
  /** c0151: hand a reference to the OS — PDFs and the like open externally. */
  onOpenReference?: (target: string) => void;
  /** c0151: read a text/markdown reference for the inline view. */
  loadReferenceText?: (target: string) => Promise<string | null>;
  /** c0062: permanently delete this card (file + assets). */
  onDelete?: () => void;
  /** c018: move this card into (`true`) or out of (`false`) its `archive/`. */
  onArchive?: (archived: boolean) => void;
  /** c0101: answer a parked gelloquestion — the app writes the un-fenced body. */
  onAnswerQuestion?: (newBody: string) => void;
  /** i0135: whether this card's stopped run can be restarted (companion live +
   *  owned + in-progress + no live run) — computed by the app from companion state. */
  restartable?: boolean;
  /** i0135: restart the stopped run, resuming its session in place. */
  onRestart?: () => void;
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
  // c0145: the tag suggestions follow the caret, so a tag edited in the middle
  // of the list gets its own completions. The list only shows while the field
  // has focus, and Escape dismisses it until the next keystroke.
  const tagsInputRef = useRef<HTMLInputElement>(null);
  const [tagCaret, setTagCaret] = useState(0);
  const [tagFocus, setTagFocus] = useState(false);
  const [tagActive, setTagActive] = useState(0);
  const [tagDismissed, setTagDismissed] = useState(false);
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

  // c0151: reference documents. The panel owns the `## References` section, so
  // it is cut from the rendered body — one place, with the open/remove controls.
  const references = onSaveFile && onChangeBody ? parseReferences(card.body) : null;
  const addReferences = async (files: File[]) => {
    if (!onSaveFile || !onChangeBody) return;
    let body = card.body;
    for (const file of files) {
      // the store dedupes the filename, so same-named files get distinct
      // targets while both keep the original name as their label
      body = addReference(body, { label: file.name, target: await onSaveFile(file) });
    }
    onChangeBody(body);
  };
  const bodyWithoutQuestion = question ? stripGelloQuestion(card.body) : card.body;
  const renderedBody =
    references !== null ? stripReferences(bodyWithoutQuestion) : bodyWithoutQuestion;

  // i0122: the markdown `components` map must keep a stable identity across
  // renders — a fresh `img` renderer each render is a new component *type*, so
  // React tears down and remounts every AssetImage on any re-render (e.g. the
  // 2s companion poll), and the remount reloads the image: an empty→image flash
  // that reads as a flicker. `loadImage` rides through a ref so its per-render
  // identity never busts the memo; AssetImage only calls it when `src` changes.
  const loadImageRef = useRef(loadImage);
  loadImageRef.current = loadImage;
  const markdownComponents = useMemo<Components>(
    () => ({
      // c011: local asset links can't load from the webview origin — resolve
      // them to a data URL via loadImage
      img: ({ src, alt }) => (
        <AssetImage
          src={typeof src === "string" ? src : ""}
          alt={alt ?? ""}
          // pass a loader only when one exists, so AssetImage keeps its "no
          // loadImage → show the src as-is" path (c012); the ref keeps it current
          loadImage={
            loadImageRef.current
              ? (source) => loadImageRef.current?.(source) ?? Promise.resolve(null)
              : undefined
          }
        />
      ),
    }),
    [],
  );
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

  // c0145: what to offer for the tag under the caret
  const tagSuggestions =
    tagFocus && !tagDismissed ? suggestTags(tagOptions, tagsDraft, tagCaret) : [];

  /** c0145: take a suggestion — it replaces the tag under the caret, and the
   *  caret lands on the next one so a second tag can be typed straight away. */
  const takeTagSuggestion = (tag: string) => {
    const next = applyTagSuggestion(tagsDraft, tagCaret, tag);
    setTagsDraft(next.value);
    setTagCaret(next.caret);
    setTagActive(0);
    const input = tagsInputRef.current;
    if (input) {
      // the value lands via React on the next render — move the caret after it
      queueMicrotask(() => {
        input.focus();
        input.setSelectionRange(next.caret, next.caret);
      });
    }
  };

  /** c0145: keyboard on the Tags field — arrows move the highlight, Enter takes
   *  it (falling back to committing when nothing is suggested), Escape drops the
   *  list without closing the dialog. */
  const tagsInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (tagSuggestions.length > 0 && event.key === "ArrowDown") {
      event.preventDefault();
      setTagActive((i) => Math.min(tagSuggestions.length - 1, i + 1));
    } else if (tagSuggestions.length > 0 && event.key === "ArrowUp") {
      event.preventDefault();
      setTagActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      const pick = tagSuggestions[tagActive];
      if (pick) {
        event.preventDefault();
        takeTagSuggestion(pick);
      } else {
        commitTags();
      }
    } else if (event.key === "Escape" && tagSuggestions.length > 0) {
      // stop the window-level Escape from closing the whole dialog (c023)
      event.stopPropagation();
      setTagDismissed(true);
      setTagActive(0);
    }
  };

  /** Track the caret so the suggestions follow the tag being edited. */
  const syncTagCaret = (event: { currentTarget: HTMLInputElement }) => {
    setTagCaret(event.currentTarget.selectionStart ?? event.currentTarget.value.length);
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
            {/* i0135: a stopped run (quota, crash, connection) leaves the card
                in-progress with nothing re-picking it up — restart it here,
                resuming the session warm. Offered only for a companion-owned
                stopped card, same as the card front. */}
            {restartable && onRestart && (
              <button
                type="button"
                className="card-detail-restart"
                onClick={onRestart}
                title="Restart — resume the agent on this card"
              >
                Restart
              </button>
            )}
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

        {/* c0148: the same live status line the card front shows (activity /
            countdown / waiting-on-a-slot / stopped / blocked / startable), read
            only here — the Restart action and dependency links have their own
            homes in the detail. */}
        {statusLine && (
          <div className="card-detail-status">
            <CardStatusLine line={statusLine} />
          </div>
        )}

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
          <label className="card-detail-tags">
            Tags
            {/* c0145: type-ahead over the tags already in use on the board */}
            <input
              ref={tagsInputRef}
              aria-label="Tags"
              value={tagsDraft}
              onChange={(event) => {
                setTagsDraft(event.target.value);
                setTagActive(0);
                setTagDismissed(false);
                syncTagCaret(event);
              }}
              onFocus={(event) => {
                setTagFocus(true);
                syncTagCaret(event);
              }}
              onBlur={() => {
                setTagFocus(false);
                commitTags();
              }}
              onSelect={syncTagCaret}
              onKeyDown={tagsInputKeyDown}
            />
            {tagSuggestions.length > 0 && (
              <ul className="tag-suggestions" role="listbox" aria-label="Tag suggestions">
                {tagSuggestions.map((tag, i) => (
                  <li key={tag} className="tag-suggestion-row">
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === tagActive}
                      className={
                        i === tagActive
                          ? "tag-suggestion tag-suggestion-active"
                          : "tag-suggestion"
                      }
                      // keep the field focused: a blur would commit and close
                      // the list before the click lands
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => takeTagSuggestion(tag)}
                    >
                      {tag}
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
        {/* c0151: the attached documents, above the body they belong to */}
        {references !== null && !editing && (
          <CardReferences
            references={references}
            onAdd={(files) => void addReferences(files)}
            onRemove={(target) => onChangeBody?.(removeReference(card.body, target))}
            onOpen={onOpenReference}
            loadText={loadReferenceText}
          />
        )}
        <div className="card-detail-body" hidden={editing}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {renderedBody}
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
