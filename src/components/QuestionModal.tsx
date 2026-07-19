import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GelloAnswer, GelloQuestion } from "../lib/gello-question";
import "./QuestionModal.css";

/**
 * c0101: the auto-opening popup that answers a single parked `gelloquestion`.
 * Choice questions render their options as checkboxes; an open question gets a
 * text slot. Answering hands the app a `GelloAnswer`; Cancel defers.
 */
export function QuestionModal({
  cardId,
  question,
  onAnswer,
  onCancel,
}: {
  cardId: string;
  question: GelloQuestion;
  onAnswer: (answer: GelloAnswer) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [text, setText] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const toggle = (index: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const canAnswer = question.isChoice ? selected.size > 0 : text.trim() !== "";

  const submit = () => {
    if (!canAnswer) return;
    onAnswer(
      question.isChoice
        ? { kind: "choice", selected: [...selected].sort((a, b) => a - b) }
        : { kind: "open", text },
    );
  };

  return (
    <div className="question-modal-backdrop" onClick={onCancel}>
      <div
        className="question-modal"
        role="dialog"
        aria-label={`Question for ${cardId}`}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="question-modal-heading">The agent has a question</p>
        <div className="question-modal-prompt">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.prompt}</ReactMarkdown>
        </div>

        {question.isChoice ? (
          <ul className="question-modal-options">
            {question.options.map((label, index) => (
              <li key={index}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(index)}
                    onChange={() => toggle(index)}
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <textarea
            className="question-modal-text"
            aria-label="Your answer"
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            placeholder="Type your answer"
          />
        )}

        <div className="question-modal-actions">
          <button type="button" onClick={submit} disabled={!canAnswer}>
            Answer
          </button>
          <button type="button" onClick={onCancel}>
            Cancel for now
          </button>
        </div>
      </div>
    </div>
  );
}
