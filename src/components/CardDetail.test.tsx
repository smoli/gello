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
    onSaveBody: vi.fn().mockResolvedValue("saved" as const),
    onTriage: vi.fn(),
    milestoneOptions: [
      { folder: "m01-alpha", milestoneId: "m01", label: "Alpha" },
      { folder: "m03-card-detail", milestoneId: "m03", label: "Card detail & capture" },
    ],
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

  it("shows the milestone read-only for milestone cards", () => {
    renderDetail();

    expect(screen.getByText("Card detail & capture")).toBeInTheDocument();
    expect(screen.queryByLabelText("Milestone")).not.toBeInTheDocument();
  });

  it("offers a triage select for inbox cards", () => {
    const props = renderDetail({ milestoneLabel: null });

    const select = screen.getByLabelText("Milestone");
    expect(select).toHaveValue("inbox");

    fireEvent.change(select, { target: { value: "m01-alpha" } });

    expect(props.onTriage).toHaveBeenCalledExactlyOnceWith("m01-alpha", "m01");
  });

  it("switches to a markdown textarea in edit mode", () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const textarea = screen.getByRole("textbox", { name: "Card body" });
    expect(textarea).toHaveValue(fixture().body);
  });

  it("saves the draft and returns to the rendered view", async () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Card body" }), {
      target: { value: "\nnew body\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onSaveBody).toHaveBeenCalledExactlyOnceWith("\nnew body\n", false);
    await screen.findByRole("button", { name: "Edit" });
    expect(
      screen.queryByRole("textbox", { name: "Card body" }),
    ).not.toBeInTheDocument();
  });

  it("saves via mod+S inside the textarea", () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Card body" }), {
      key: "s",
      metaKey: true,
    });

    expect(props.onSaveBody).toHaveBeenCalledTimes(1);
  });

  it("cancels the edit with Escape, keeping the dialog open and saving nothing", () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Card body" }), {
      target: { value: "\ndiscarded draft\n" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Card body" }), {
      key: "Escape",
    });

    expect(props.onSaveBody).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Card body" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces a conflict: draft kept, overwrite and discard offered", async () => {
    const props = renderDetail({
      onSaveBody: vi
        .fn()
        .mockResolvedValueOnce("conflict" as const)
        .mockResolvedValueOnce("saved" as const),
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Card body" }), {
      target: { value: "\nmy draft\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/changed on disk/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Card body" })).toHaveValue(
      "\nmy draft\n",
    );

    fireEvent.click(screen.getByRole("button", { name: /overwrite/i }));
    expect(props.onSaveBody).toHaveBeenLastCalledWith("\nmy draft\n", true);
  });

  it("discards the draft on conflict without saving", async () => {
    const props = renderDetail({
      onSaveBody: vi.fn().mockResolvedValueOnce("conflict" as const),
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/changed on disk/i);

    fireEvent.click(screen.getByRole("button", { name: /discard/i }));

    expect(props.onSaveBody).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("textbox", { name: "Card body" }),
    ).not.toBeInTheDocument();
  });

  it("closes via button and Escape", () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("closes on Escape even when focus is outside the dialog (c023)", () => {
    const props = renderDetail();

    // reproduces the real-app situation: focus stayed on the card front
    // behind the overlay, so the key event never reaches the dialog element
    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape while editing cancels only the edit, even with focus elsewhere", () => {
    const props = renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Card body" }), {
      key: "Escape",
    });

    expect(props.onClose).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("textbox", { name: "Card body" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
