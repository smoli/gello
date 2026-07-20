import { useEffect, useState } from "react";
import { tagChipStyle, tagColor, type TagCount } from "../lib/tags";
import "./TagManager.css";

/**
 * c0058: the tag management surface. Lists every tag in use with a card count,
 * a colour picker (writes an override to board.yaml), and a rename control
 * (rewrites the tag everywhere it appears). All three surfaces — chips, filter,
 * and this manager — read the same `tags:` field; nothing new is stored on cards.
 */
export function TagManager({
  tags,
  tagColors,
  onSetColor,
  onRename,
  onClose,
}: {
  tags: TagCount[];
  tagColors: Record<string, string>;
  onSetColor: (tag: string, colour: string) => void;
  onRename: (from: string, to: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="tag-manager-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-label="Manage tags" className="tag-manager">
        <header className="tag-manager-header">
          <h1>Manage tags</h1>
          <button type="button" aria-label="close" onClick={onClose}>
            ✕
          </button>
        </header>
        {tags.length === 0 ? (
          <p className="tag-manager-empty">No tags in use yet.</p>
        ) : (
          <ul className="tag-manager-list">
            {tags.map(({ tag, count }) => (
              <TagRow
                key={tag}
                tag={tag}
                count={count}
                colour={tagColor(tag, tagColors)}
                onSetColor={onSetColor}
                onRename={onRename}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TagRow({
  tag,
  count,
  colour,
  onSetColor,
  onRename,
}: {
  tag: string;
  count: number;
  colour: string;
  onSetColor: (tag: string, colour: string) => void;
  onRename: (from: string, to: string) => void;
}) {
  const [draft, setDraft] = useState(tag);

  const rename = () => {
    const next = draft.trim();
    if (next !== "" && next !== tag) onRename(tag, next);
  };

  return (
    <li role="listitem" aria-label={tag} className="tag-manager-row">
      <span className="tag-chip" style={tagChipStyle(colour)}>
        {tag}
      </span>
      <span className="tag-manager-count">{count}</span>
      <input
        type="color"
        aria-label="Colour"
        value={colour}
        onChange={(event) => onSetColor(tag, event.target.value)}
      />
      <input
        aria-label="Rename tag"
        className="tag-manager-rename"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") rename();
        }}
      />
      <button type="button" onClick={rename}>
        Rename
      </button>
    </li>
  );
}
