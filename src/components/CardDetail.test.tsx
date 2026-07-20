import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    onSaveEdit: vi.fn().mockResolvedValue("saved" as const),
    onTriage: vi.fn(),
    onReportIssue: vi.fn(),
    onOpenCardId: vi.fn(),
    refCard: null,
    openIssues: [],
    milestoneOptions: [
      { folder: "m01-alpha", milestoneId: "m01", label: "Alpha" },
      { folder: "m03-card-detail", milestoneId: "m03", label: "Card detail & capture" },
      // c0078: the standalone "No epic" target the App always provides
      { folder: "cards", milestoneId: null, label: "No epic" },
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

  // i0107: checkboxes in the rendered display are read-only — a task's state
  // is changed by editing the body, not by clicking the disabled box.
  it("renders read-only checkboxes reflecting the task states", () => {
    renderDetail();

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    expect(boxes[0]).not.toBeChecked();
    expect(boxes[1]).toBeChecked();
    expect(boxes[0]).toBeDisabled();
    expect(boxes[1]).toBeDisabled();
    expect(boxes[2]).toBeDisabled();
  });

  it("edits status via the select", () => {
    const props = renderDetail();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "review" },
    });
    expect(props.onChangeFields).toHaveBeenLastCalledWith({ status: "review" });
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

  it("i0005: preselects the current milestone and reassigns a triaged card", () => {
    const props = renderDetail();

    const select = screen.getByLabelText("Epic");
    // fixture card has milestone m03 → the m03 folder is selected
    expect(select).toHaveValue("m03-card-detail");

    fireEvent.change(select, { target: { value: "m01-alpha" } });

    expect(props.onTriage).toHaveBeenCalledExactlyOnceWith("m01-alpha", "m01");
  });

  it("i0031: a no-epic card shows 'No epic' (not 'inbox') and can be assigned", () => {
    // a genuinely standalone card: no epic field, no milestone label
    const props = renderDetail({
      card: { ...fixture(), epic: null },
      milestoneLabel: null,
    });

    const select = screen.getByLabelText("Epic");
    // c0088: a standalone card has no epic → the "No epic" option is selected
    expect(select).toHaveValue("cards");
    expect(within(select).queryByText("inbox")).not.toBeInTheDocument();
    expect(within(select).getByText("No epic")).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "m01-alpha" } });
    expect(props.onTriage).toHaveBeenCalledExactlyOnceWith("m01-alpha", "m01");
  });

  it("c0101: auto-opens the answer modal for a parked question and un-fences on answer", () => {
    const raw =
      "---\nid: c009\ntitle: Q\nstatus: backlog\nawaiting: input\n---\n" +
      "\n```gelloquestion\nWhich?\n- [ ] a\n- [ ] b\n```\n";
    const parsed = parseCard("cards/c009-q.md", raw);
    if (!parsed.ok) throw new Error("fixture must parse");
    const onAnswerQuestion = vi.fn();
    renderDetail({ card: parsed.card, onAnswerQuestion });

    // the modal pops on open, scoped to the question
    const modal = screen.getByRole("dialog", { name: "Question for c009" });
    fireEvent.click(within(modal).getByLabelText("b"));
    fireEvent.click(within(modal).getByRole("button", { name: "Answer" }));

    expect(onAnswerQuestion).toHaveBeenCalledTimes(1);
    const newBody = onAnswerQuestion.mock.calls[0][0] as string;
    expect(newBody).not.toContain("```gelloquestion");
    expect(newBody).toContain("- [x] b");
    expect(newBody).toContain("- [ ] a");
  });

  it("c0101: a card with no question opens without a modal", () => {
    renderDetail(); // fixture card has no gelloquestion
    expect(screen.queryByRole("dialog", { name: /Question for/ })).not.toBeInTheDocument();
  });

  it("switches to a markdown textarea and a prefilled title input in edit mode", () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const textarea = screen.getByRole("textbox", { name: "Card body" });
    expect(textarea).toHaveValue(fixture().body);
    const title = screen.getByRole("textbox", { name: "Card title" });
    expect(title).toHaveValue("Card detail view");
  });

  it("saves title and body drafts together and returns to the rendered view", async () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Card title" }), {
      target: { value: "Renamed detail view" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Card body" }), {
      target: { value: "\nnew body\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onSaveEdit).toHaveBeenCalledExactlyOnceWith(
      { title: "Renamed detail view", body: "\nnew body\n" },
      false,
    );
    await screen.findByRole("button", { name: "Edit" });
    expect(
      screen.queryByRole("textbox", { name: "Card body" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the original title when the draft is blank", () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Card title" }), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onSaveEdit).toHaveBeenCalledExactlyOnceWith(
      { title: "Card detail view", body: fixture().body },
      false,
    );
  });

  it("saves via mod+S inside the textarea and the title input", () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Card body" }), {
      key: "s",
      metaKey: true,
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Card title" }), {
      key: "s",
      metaKey: true,
    });

    expect(props.onSaveEdit).toHaveBeenCalledTimes(2);
  });

  it("cancels the edit with Escape, keeping the dialog open and saving nothing", () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Card body" }), {
      target: { value: "\ndiscarded draft\n" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Card title" }), {
      target: { value: "Discarded title" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Card body" }), {
      key: "Escape",
    });

    expect(props.onSaveEdit).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Card body" }),
    ).not.toBeInTheDocument();
    // rendered title unchanged
    expect(
      screen.getByRole("heading", { name: "Card detail view" }),
    ).toBeInTheDocument();
  });

  it("surfaces a conflict: draft kept, overwrite and discard offered", async () => {
    const props = renderDetail({
      onSaveEdit: vi
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
    expect(props.onSaveEdit).toHaveBeenLastCalledWith(
      { title: "Card detail view", body: "\nmy draft\n" },
      true,
    );
  });

  it("discards the draft on conflict without saving", async () => {
    const props = renderDetail({
      onSaveEdit: vi.fn().mockResolvedValueOnce("conflict" as const),
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/changed on disk/i);

    fireEvent.click(screen.getByRole("button", { name: /discard/i }));

    expect(props.onSaveEdit).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("textbox", { name: "Card body" }),
    ).not.toBeInTheDocument();
  });

  it("shows a report-issue action only for review/done cards (c024)", () => {
    const props = renderDetail(); // fixture card is in-progress
    expect(
      screen.queryByRole("button", { name: /report issue/i }),
    ).not.toBeInTheDocument();
    cleanup();

    const reviewCard = { ...fixture(), status: "review" };
    const props2 = renderDetail({ card: reviewCard });
    fireEvent.click(screen.getByRole("button", { name: /report issue/i }));
    expect(props2.onReportIssue).toHaveBeenCalledTimes(1);
    expect(props.onReportIssue).not.toHaveBeenCalled();
  });

  it("renders a issue's ref as a link to the referenced card", () => {
    const issue = {
      ...fixture(),
      type: "issue",
      ref: "c001",
    };
    const props = renderDetail({
      card: issue,
      refCard: { exists: true, title: "The source card" },
    });

    expect(screen.getByText("issue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /c001/ }));
    expect(props.onOpenCardId).toHaveBeenCalledExactlyOnceWith("c001");
  });

  it("warns on a dangling ref instead of hiding it", () => {
    const issue = { ...fixture(), type: "issue", ref: "c999" };
    renderDetail({ card: issue, refCard: { exists: false, title: null } });

    expect(screen.getByText(/c999/)).toBeInTheDocument();
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it("lists open issues pointing at this card", () => {
    const props = renderDetail({
      openIssues: [
        { ...fixture(), id: "c050", title: "Broke the filter", path: "inbox/c050-x.md" },
      ],
    });

    expect(screen.getByText(/open issues/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Broke the filter/ }));
    expect(props.onOpenCardId).toHaveBeenCalledExactlyOnceWith("c050");
  });

  it("does not close when a drag-selection ends on the backdrop (c038)", () => {
    const props = renderDetail();
    const backdrop = document.querySelector(".card-detail-backdrop")!;

    // text selection starting inside the dialog, released over the backdrop
    fireEvent.mouseDown(screen.getByRole("heading", { name: "Card detail view" }));
    fireEvent.mouseUp(backdrop);
    fireEvent.click(backdrop);

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("still closes on a genuine backdrop click (press and release outside)", () => {
    const props = renderDetail();
    const backdrop = document.querySelector(".card-detail-backdrop")!;

    fireEvent.mouseDown(backdrop);
    fireEvent.mouseUp(backdrop);
    fireEvent.click(backdrop);

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("excludes the Log section from editing and reattaches it on save (c041)", () => {
    const withLog = {
      ...fixture(),
      body: "\n## What\n\nEditable text.\n\n## Log\n\n- 2026-07-16 created\n",
    };
    const props = renderDetail({ card: withLog });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox", { name: "Card body" });
    expect(textarea).toHaveValue("\n## What\n\nEditable text.\n\n");
    expect(screen.getByText(/log.*preserved automatically/i)).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "\n## What\n\nRewritten.\n\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onSaveEdit).toHaveBeenCalledExactlyOnceWith(
      {
        title: "Card detail view",
        body: "\n## What\n\nRewritten.\n\n## Log\n\n- 2026-07-16 created\n",
      },
      false,
    );
  });

  it("can open directly in edit mode (c035)", () => {
    renderDetail({ startInEdit: true });

    expect(screen.getByRole("textbox", { name: "Card body" })).toHaveValue(
      fixture().body,
    );
    expect(screen.getByRole("textbox", { name: "Card title" })).toHaveValue(
      "Card detail view",
    );
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

  // --- c0062: delete ----------------------------------------------------------

  it("c0062: deleting takes a confirm step before calling onDelete", () => {
    const onDelete = vi.fn();
    renderDetail({ onDelete });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    // not deleted yet — a confirm appeared
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/delete card and its images/i)).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("group", { name: "confirm delete" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("c0062: 'Keep' backs out of the delete confirm without deleting", () => {
    const onDelete = vi.fn();
    renderDetail({ onDelete });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/delete card and its images/i)).not.toBeInTheDocument();
  });

  it("c0062: no Delete control when onDelete is not provided", () => {
    renderDetail();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  // --- c011: paste/drag image assets ------------------------------------------

  function imageFile(name = "shot.png") {
    return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
  }

  it("c011: pasting an image saves it and inserts a relative link at the cursor", async () => {
    // onSaveImage returns the ready-to-insert relative path (App builds it)
    const onSaveImage = vi.fn().mockResolvedValue("../../assets/c009/pasted-x.png");
    renderDetail({ onSaveImage });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox", {
      name: "Card body",
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "before after" } });
    textarea.setSelectionRange(6, 6); // caret between "before " and "after"

    const file = imageFile();
    const prevented = !fireEvent.paste(textarea, {
      clipboardData: { items: [{ kind: "file", type: "image/png", getAsFile: () => file }], files: [file] },
    });
    expect(prevented).toBe(true); // image paste is handled, not pasted as text

    await vi.waitFor(() => {
      expect(onSaveImage).toHaveBeenCalledExactlyOnceWith(file);
      expect(textarea.value).toBe("before![shot](../../assets/c009/pasted-x.png) after");
    });
  });

  it("c011: a text-only paste is left to the browser", () => {
    const onSaveImage = vi.fn();
    renderDetail({ onSaveImage });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox", { name: "Card body" });

    const notPrevented = fireEvent.paste(textarea, {
      clipboardData: { items: [{ kind: "string", type: "text/plain" }], files: [] },
    });

    expect(notPrevented).toBe(true); // default text paste proceeds
    expect(onSaveImage).not.toHaveBeenCalled();
  });

  it("c011: dropping an image file inserts a link too", async () => {
    const onSaveImage = vi.fn().mockResolvedValue("../../assets/c009/dropped.png");
    renderDetail({ onSaveImage });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox", {
      name: "Card body",
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "" } });

    const file = imageFile("diagram.png");
    fireEvent.drop(textarea, { dataTransfer: { files: [file], items: [] } });

    await vi.waitFor(() => {
      expect(onSaveImage).toHaveBeenCalledExactlyOnceWith(file);
      expect(textarea.value).toBe("![diagram](../../assets/c009/dropped.png)");
    });
  });

  it("c011: renders a body image through loadImage as a data URL", async () => {
    const loadImage = vi
      .fn()
      .mockResolvedValue("data:image/png;base64,QUJD");
    renderDetail({ loadImage });

    await vi.waitFor(() => {
      const img = screen.getByAltText("screenshot") as HTMLImageElement;
      expect(img.src).toBe("data:image/png;base64,QUJD");
    });
    expect(loadImage).toHaveBeenCalledWith("assets/c009/shot.png");
  });
});
