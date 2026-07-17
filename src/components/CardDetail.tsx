import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card, CardFieldChanges, Priority } from "../lib/cards";
import { splitLogSection } from "../lib/markdown";
import { assetLinkPrefix, insertAt } from "../lib/assets";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // c011: caret to restore after an async image insert re-renders the textarea
  const caretRef = useRef<number | null>(null);
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

  // c011: restore the caret after an async image insert updates bodyDraft
  useEffect(() => {
    if (caretRef.current !== null && textareaRef.current) {
      const pos = caretRef.current;
      caretRef.current = null;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
    }
  });

  /**
   * c011: persist each image and splice a relative Markdown link at the caret.
   * Sequential so multiple images land in order; the working text is threaded
   * locally because setBodyDraft is async.
   */
  const insertImages = async (files: File[]) => {
    if (!onSaveImage || files.length === 0) return;
    const el = textareaRef.current;
    let start = el?.selectionStart ?? bodyDraft.length;
    let end = el?.selectionEnd ?? bodyDraft.length;
    let working = bodyDraft;
    const prefix = assetLinkPrefix(card.path);
    for (const file of files) {
      const relPath = await onSaveImage(file);
      const alt = file.name.replace(/\.[^.]+$/, "") || "image";
      const snippet = `![${alt}](${prefix}${relPath})`;
      const result = insertAt(working, start, end, snippet);
      working = result.text;
      start = end = result.cursor;
    }
    caretRef.current = start;
    setBodyDraft(working);
  };

  const onEditorPaste = (event: React.ClipboardEvent) => {
    const files = imageFilesFrom(event.clipboardData);
    if (files.length === 0) return; // let the browser handle text/other pastes
    event.preventDefault();
    void insertImages(files);
  };

  const onEditorDrop = (event: React.DragEvent) => {
    const files = imageFilesFrom(event.dataTransfer);
    if (files.length === 0) return;
    event.preventDefault();
    void insertImages(files);
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
          {/* i0005: assign (inbox) or reassign (triaged) a milestone from the
              detail — onTriage moves the file either way (inbox→milestone or
              milestone→milestone), without duplicating or losing it. */}
          <label>
            Milestone
            <select
              aria-label="Milestone"
              value={
                milestoneLabel === null
                  ? "inbox"
                  : (milestoneOptions.find((o) => o.milestoneId === card.milestone)
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
                !milestoneOptions.some((o) => o.milestoneId === card.milestone) && (
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
              ref={textareaRef}
              aria-label="Card body"
              value={bodyDraft}
              autoFocus
              onChange={(event) => setBodyDraft(event.target.value)}
              onKeyDown={editorKeyDown}
              onPaste={onSaveImage ? onEditorPaste : undefined}
              onDrop={onSaveImage ? onEditorDrop : undefined}
              onDragOver={onSaveImage ? (e) => e.preventDefault() : undefined}
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

/** c011: gather image files from a paste/drop payload (items first, then the
 *  files list), skipping anything that isn't an image. */
function imageFilesFrom(data: DataTransfer): File[] {
  const files: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length === 0) {
    for (const file of Array.from(data.files ?? [])) {
      if (file.type.startsWith("image/")) files.push(file);
    }
  }
  return files;
}

/** c011: a Markdown image whose src is resolved to a displayable URL. Local
 *  asset paths can't load from the webview origin, so loadImage turns them
 *  into data URLs; remote/data URLs pass straight through. */
function AssetImage({
  src,
  alt,
  loadImage,
}: {
  src: string;
  alt: string;
  loadImage?: (src: string) => Promise<string | null>;
}) {
  const [resolved, setResolved] = useState<string | null>(
    loadImage ? null : src,
  );
  // resolve only when the src changes, not when the (inline) loadImage prop
  // gets a new identity each parent render
  const loadImageRef = useRef(loadImage);
  loadImageRef.current = loadImage;
  useEffect(() => {
    const resolve = loadImageRef.current;
    if (!resolve || src === "") {
      setResolved(src || null);
      return;
    }
    let alive = true;
    void resolve(src).then((url) => {
      if (alive) setResolved(url);
    });
    return () => {
      alive = false;
    };
  }, [src]);

  if (!resolved) return null;
  return <img src={resolved} alt={alt} />;
}
