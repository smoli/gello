import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { parseCard } from "../lib/cards";
import { CardDetail } from "./CardDetail";

const RAW = `---
id: c009
title: Card detail view
status: in-progress
milestone: m03
priority: high
tags: [ui]
---

## What

A detail view with **bold** text and an image ![screenshot](assets/c009/shot.png).

\`\`\`ts
const code = true;
\`\`\`

## Acceptance criteria

- [ ] renders markdown
- [x] already done
- [ ] third thing
`;

function fixture() {
  const parsed = parseCard("milestones/m03-x/c009-detail.md", RAW);
  if (!parsed.ok) throw new Error("fixture must parse");
  return parsed.card;
}

function renderDetail(overrides: Partial<Parameters<typeof CardDetail>[0]> = {}) {
  const props = {
    card: fixture(),
    milestoneLabel: "Card detail & capture",
    columns: ["backlog", "ready", "in-progress", "review", "done"],
    onChangeFields: vi.fn(),
    onToggleTask: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<CardDetail {...props} />);
  return props;
}

describe("CardDetail", () => {
  it("renders the body as markdown", () => {
    renderDetail();

    expect(screen.getByRole("heading", { name: "What" })).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText(/const code = true/)).toBeInTheDocument();
    expect(screen.getByAltText("screenshot")).toBeInTheDocument();
  });

  it("shows id and title in the header", () => {
    renderDetail();

    expect(screen.getByText("c009")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Card detail view" }),
    ).toBeInTheDocument();
  });

  it("renders enabled checkboxes reflecting the task states", () => {
    renderDetail();

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    expect(boxes[0]).not.toBeChecked();
    expect(boxes[1]).toBeChecked();
    expect(boxes[0]).toBeEnabled();
  });

  it("reports checkbox toggles with the document-order index", () => {
    const props = renderDetail();

    fireEvent.click(screen.getAllByRole("checkbox")[2]);

    expect(props.onToggleTask).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("edits status and priority via selects", () => {
    const props = renderDetail();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "review" },
    });
    expect(props.onChangeFields).toHaveBeenLastCalledWith({ status: "review" });

    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "low" },
    });
    expect(props.onChangeFields).toHaveBeenLastCalledWith({ priority: "low" });
  });

  it("commits tags on Enter as a trimmed list", () => {
    const props = renderDetail();

    const input = screen.getByLabelText("Tags");
    fireEvent.change(input, { target: { value: " ui,  agent-dx ," } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(props.onChangeFields).toHaveBeenLastCalledWith({
      tags: ["ui", "agent-dx"],
    });
  });

  it("shows the milestone read-only", () => {
    renderDetail();

    expect(screen.getByText("Card detail & capture")).toBeInTheDocument();
    expect(screen.queryByLabelText("Milestone")).not.toBeInTheDocument();
  });

  it("closes via button and Escape", () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
