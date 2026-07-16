import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card, CardFieldChanges, Priority } from "../lib/cards";
import "./CardDetail.css";

const PRIORITIES: Priority[] = ["low", "normal", "high"];

export function CardDetail({
  card,
  milestoneLabel,
  columns,
  onChangeFields,
  onToggleTask,
  onClose,
}: {
  card: Card;
  milestoneLabel: string | null;
  columns: string[];
  onChangeFields: (changes: CardFieldChanges) => void;
  onToggleTask: (index: number) => void;
  onClose: () => void;
}) {
  const [tagsDraft, setTagsDraft] = useState(card.tags.join(", "));

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
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <header className="card-detail-header">
          <div className="card-detail-title">
            <span className="card-id">{card.id}</span>
            <h1>{card.title}</h1>
          </div>
          <button type="button" aria-label="close" onClick={onClose}>
            ✕
          </button>
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
          <div className="card-detail-milestone">
            <span className="field-label">Milestone</span>
            <span className="card-milestone">{milestoneLabel ?? "inbox"}</span>
          </div>
        </div>

        <div className="card-detail-body">
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
