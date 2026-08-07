import { useRef, useState } from "react";
import type React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { referenceKind, type Reference } from "../lib/references";

/**
 * c0151: the card's reference documents — files copied into the card's asset
 * folder and listed in its `## References` section. A text or markdown
 * reference opens inline here; anything else is handed to the OS.
 */
export function CardReferences({
  references,
  onAdd,
  onRemove,
  onOpen,
  loadText,
}: {
  references: Reference[];
  /** Copy these files in and record them on the card. */
  onAdd: (files: File[]) => void;
  onRemove: (target: string) => void;
  onOpen?: (target: string) => void;
  loadText?: (target: string) => Promise<string | null>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  // the reference open inline, and its content once read (null while loading)
  const [view, setView] = useState<{ target: string; text: string | null } | null>(null);
  const [dragging, setDragging] = useState(false);

  const toggleView = async (target: string) => {
    if (view?.target === target) {
      setView(null);
      return;
    }
    setView({ target, text: null });
    const text = (await loadText?.(target)) ?? null;
    // a second click while the read was in flight wins
    setView((current) => (current?.target === target ? { target, text } : current));
  };

  const takeFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onAdd(files);
  };

  const onDrop = (event: React.DragEvent) => {
    setDragging(false);
    if ((event.dataTransfer.files?.length ?? 0) === 0) return;
    event.preventDefault();
    takeFiles(event.dataTransfer.files);
  };

  return (
    <div
      role="group"
      aria-label="References"
      className={dragging ? "card-references card-references-dragging" : "card-references"}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <span className="field-label">References:</span>
      {references.length > 0 && (
        <ul className="card-reference-list" aria-label="References">
          {references.map((reference) => (
            <li key={`${reference.target}`} className="card-reference">
              <span className="card-reference-row">
                <span className="card-reference-label">{reference.label}</span>
                {referenceKind(reference.target) === "external" ? (
                  <button
                    type="button"
                    className="card-reference-action"
                    aria-label={`Open ${reference.label}`}
                    onClick={() => onOpen?.(reference.target)}
                  >
                    Open
                  </button>
                ) : (
                  <button
                    type="button"
                    className="card-reference-action"
                    aria-label={
                      view?.target === reference.target
                        ? `Hide ${reference.label}`
                        : `View ${reference.label}`
                    }
                    onClick={() => void toggleView(reference.target)}
                  >
                    {view?.target === reference.target ? "Hide" : "View"}
                  </button>
                )}
                <button
                  type="button"
                  className="card-reference-remove"
                  aria-label={`Remove reference ${reference.label}`}
                  title="Remove this reference"
                  onClick={() => onRemove(reference.target)}
                >
                  ×
                </button>
              </span>
              {view?.target === reference.target && (
                <div className="card-reference-view">
                  {view.text === null ? (
                    <p className="card-reference-empty">Reading…</p>
                  ) : referenceKind(reference.target) === "markdown" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{view.text}</ReactMarkdown>
                  ) : (
                    <pre>{view.text}</pre>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <span className="card-reference-add">
        <button type="button" onClick={() => fileInput.current?.click()}>
          Add reference…
        </button>
        <span className="card-reference-hint">or drop a file here</span>
        <input
          ref={fileInput}
          type="file"
          multiple
          aria-label="Reference file"
          style={{ display: "none" }}
          onChange={(event) => {
            takeFiles(event.target.files);
            // clear, so picking the same file again still fires a change
            event.target.value = "";
          }}
        />
      </span>
    </div>
  );
}
