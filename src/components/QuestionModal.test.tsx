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

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ kind: "choice", selected: [1] });
  });

  it("answers an open question with typed text", () => {
    const onAnswer = vi.fn();
    render(<QuestionModal cardId="c001" question={open} onAnswer={onAnswer} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "30 seconds" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ kind: "open", text: "30 seconds" });
  });

  it("cancels on the button, the backdrop, and Escape", () => {
    const onCancel = vi.fn();
    render(<QuestionModal cardId="c001" question={open} onAnswer={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel for now/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
