import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuestionModal } from "./QuestionModal";
import { parseGelloQuestion } from "../lib/gello-question";

const choice = parseGelloQuestion(
  "```gelloquestion\nWhich database?\n- [ ] Postgres\n- [ ] SQLite\n```\n",
)!;
const open = parseGelloQuestion(
  "```gelloquestion\nWhat should the timeout be?\n```\n",
)!;

describe("QuestionModal (c0101)", () => {
  it("answers a choice question with the selected option(s)", () => {
    const onAnswer = vi.fn();
    render(<QuestionModal cardId="c001" question={choice} onAnswer={onAnswer} onCancel={vi.fn()} />);

    expect(screen.getByText("Which database?")).toBeInTheDocument();
    // Answer is disabled until something is picked
    expect(screen.getByRole("button", { name: "Answer" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("SQLite"));
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ selected: [1], text: "" });
  });

  it("answers an open question with typed text", () => {
    const onAnswer = vi.fn();
    render(<QuestionModal cardId="c001" question={open} onAnswer={onAnswer} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "30 seconds" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ selected: [], text: "30 seconds" });
  });

  // c0103 — a choice question must still let the human say something the agent
  // did not offer
  describe("free text on a choice question", () => {
    const answerTo = (question: typeof choice) => {
      const onAnswer = vi.fn();
      render(
        <QuestionModal
          cardId="c001"
          question={question}
          onAnswer={onAnswer}
          onCancel={vi.fn()}
        />,
      );
      return onAnswer;
    };

    it("offers a text field alongside the options", () => {
      answerTo(choice);
      expect(screen.getByLabelText("SQLite")).toBeInTheDocument();
      expect(screen.getByLabelText("Your answer")).toBeInTheDocument();
    });

    it("sends the checked options and the note together", () => {
      const onAnswer = answerTo(choice);
      fireEvent.click(screen.getByLabelText("SQLite"));
      fireEvent.change(screen.getByLabelText("Your answer"), {
        target: { value: "only if we drop the ORM" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Answer" }));

      expect(onAnswer).toHaveBeenCalledExactlyOnceWith({
        selected: [1],
        text: "only if we drop the ORM",
      });
    });

    it("accepts a note with no option checked", () => {
      const onAnswer = answerTo(choice);
      fireEvent.change(screen.getByLabelText("Your answer"), {
        target: { value: "neither — use DuckDB" },
      });
      expect(screen.getByRole("button", { name: "Answer" })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "Answer" }));

      expect(onAnswer).toHaveBeenCalledExactlyOnceWith({
        selected: [],
        text: "neither — use DuckDB",
      });
    });

    it("keeps Answer disabled until there is a choice or a note", () => {
      answerTo(choice);
      const button = screen.getByRole("button", { name: "Answer" });
      expect(button).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Your answer"), {
        target: { value: "   " }, // whitespace is not an answer
      });
      expect(button).toBeDisabled();
    });
  });

  it("cancels on the button, the backdrop, and Escape", () => {
    const onCancel = vi.fn();
    render(<QuestionModal cardId="c001" question={open} onAnswer={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel for now/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
