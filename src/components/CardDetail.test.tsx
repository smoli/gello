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
    onFollowUp: vi.fn(),
    onOpenCardId: vi.fn(),
    refCard: null,
    openIssues: [],
    followUps: [],
    milestoneOptions: [
      { folder: "m01-alpha", milestoneId: "m01", label: "Alpha" },
      { folder: "m03-card-detail", milestoneId: "m03", label: "Card detail & capture" },
      // c0078: the standalone "No epic" target the App always provides
      { folder: "cards", milestoneId: null, label: "No epic" },
    ],
    onClose: vi.fn(),
    ...overrides,
  };
  const view = render(<CardDetail {...props} />);
  // i0122: expose rerender for the flicker regression, without changing the
  // shape existing callers rely on (they read props fields off the return).
  return Object.assign(props, { rerender: () => view.rerender(<CardDetail {...props} />) });
}

describe("CardDetail", () => {
  it("renders the body as markdown", () => {
    renderDetail();

    expect(screen.getByRole("heading", { name: "What" })).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText(/const code = true/)).toBeInTheDocument();
    expect(screen.getByAltText("screenshot")).toBeInTheDocument();
  });

  it("i0122: a re-render does not remount and reload the body image (flicker)", async () => {
    // the periodic re-render (e.g. the 2s companion poll) must not tear down
    // and re-resolve the image — that empty→image flash is the flicker.
    const loadImage = vi.fn().mockResolvedValue("data:image/png;base64,QUJD");
    const view = renderDetail({ loadImage });

    const img = await screen.findByAltText("screenshot");
    expect(img).toBeInTheDocument();
    expect(loadImage).toHaveBeenCalledTimes(1);

    view.rerender();
    view.rerender();
    await Promise.resolve();

    // still the same element, resolved once — never unmounted and reloaded
    expect(screen.getByAltText("screenshot")).toBe(img);
    expect(loadImage).toHaveBeenCalledTimes(1);
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

  // c0115 widened this: something can break at any point in a card's life, so
  // report-issue is no longer gated to review/done the way it was in c024.
  it("shows a report-issue action on a card in any status (c0115)", () => {
    const props = renderDetail(); // fixture card is in-progress
    fireEvent.click(screen.getByRole("button", { name: /report issue/i }));
    expect(props.onReportIssue).toHaveBeenCalledTimes(1);
    cleanup();

    const props2 = renderDetail({ card: { ...fixture(), status: "review" } });
    fireEvent.click(screen.getByRole("button", { name: /report issue/i }));
    expect(props2.onReportIssue).toHaveBeenCalledTimes(1);
  });

  it("offers Follow up only on a review or done card (c0115)", () => {
    renderDetail(); // in-progress: more work is not "follow-up" yet
    expect(
      screen.queryByRole("button", { name: /follow up/i }),
    ).not.toBeInTheDocument();
    cleanup();

    for (const status of ["review", "done"]) {
      const props = renderDetail({ card: { ...fixture(), status } });
      fireEvent.click(screen.getByRole("button", { name: /follow up/i }));
      expect(props.onFollowUp).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it("lists open issues and follow-ups as separate sections (c0115)", () => {
    const props = renderDetail({
      openIssues: [
        { ...fixture(), id: "i0007", title: "Broke the filter", path: "cards/i0007-x.md" },
      ],
      followUps: [
        { ...fixture(), id: "c0050", title: "Handle empty state", path: "cards/c0050-x.md" },
      ],
    });

    expect(screen.getByText(/open issues/i)).toBeInTheDocument();
    expect(screen.getByText(/follow-ups/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Handle empty state/ }));
    expect(props.onOpenCardId).toHaveBeenCalledExactlyOnceWith("c0050");
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

  it("labels a follow-up's back-link by intent, not as 'found in' (c0115)", () => {
    const followUp = { ...fixture(), type: "task", ref: "c001" };
    const props = renderDetail({
      card: followUp,
      refCard: { exists: true, title: "The finished card" },
    });

    expect(screen.getByText(/follow-up to/i)).toBeInTheDocument();
    expect(screen.queryByText(/found in/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /c001/ }));
    expect(props.onOpenCardId).toHaveBeenCalledExactlyOnceWith("c001");
  });

  it("warns on a dangling ref instead of hiding it", () => {
    const issue = { ...fixture(), type: "issue", ref: "c999" };
    renderDetail({ card: issue, refCard: { exists: false, title: null } });

    expect(screen.getByText(/c999/)).toBeInTheDocument();
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  // c0124: `depends` was parsed and then never shown anywhere in the app.

  describe("c0124: dependencies", () => {
    const dependent = (id: string, title: string, status: string) => ({
      ...fixture(),
      id,
      title,
      status,
      path: `cards/${id}-x.md`,
    });

    const withDepends = (overrides = {}) =>
      renderDetail({
        card: { ...fixture(), depends: ["c001"] },
        dependencies: [{ id: "c001", card: dependent("c001", "The groundwork", "review") }],
        ...overrides,
      });

    const dependsSection = () =>
      screen.getByText(/depends on/i).closest(".card-backlinks") as HTMLElement;

    it("lists what the card depends on, each opening that card", () => {
      const props = withDepends();
      const section = dependsSection();

      fireEvent.click(within(section).getByRole("button", { name: /The groundwork/ }));
      expect(props.onOpenCardId).toHaveBeenCalledExactlyOnceWith("c001");
    });

    it("tells an unfinished dependency apart from a satisfied one", () => {
      withDepends({
        card: { ...fixture(), depends: ["c001", "c002"] },
        dependencies: [
          { id: "c001", card: dependent("c001", "Still going", "review") },
          { id: "c002", card: dependent("c002", "Finished", "done") },
        ],
      });
      const section = dependsSection();

      const open = within(section).getByText(/Still going/).closest(".card-depends-entry")!;
      const settled = within(section).getByText(/Finished/).closest(".card-depends-entry")!;
      expect(open).toHaveClass("card-depends-open");
      expect(settled).not.toHaveClass("card-depends-open");
      // the detail is the full picture — each dependency says where it stands
      expect(open).toHaveTextContent("review");
      expect(settled).toHaveTextContent("done");
    });

    it("shows a dependency no card answers to as missing, like a dangling ref", () => {
      withDepends({
        card: { ...fixture(), depends: ["c404"] },
        dependencies: [{ id: "c404", card: null }],
      });
      const section = dependsSection();

      expect(within(section).getByText(/c404/)).toBeInTheDocument();
      expect(within(section).getByText(/not found/i)).toBeInTheDocument();
      // nothing to open
      expect(
        within(section).queryByRole("button", { name: /c404 —/ }),
      ).not.toBeInTheDocument();
    });

    // c0127: a bare dropdown does not scale to a board with many cards. The
    // add control is a tokenized input — type, get suggestions, pick one.

    const manyOptions = [
      { id: "c003", title: "Later work", cycle: null },
      { id: "c004", title: "Design the schema", cycle: null },
      { id: "c005", title: "Wire the backend", cycle: null },
    ];
    const addInput = () => screen.getByLabelText("Add dependency");
    const suggestions = () =>
      screen.queryByRole("listbox", { name: /dependency suggestions/i });
    const suggestionFor = (name: RegExp) =>
      within(suggestions()!).getByRole("option", { name });

    it("c0127: shows no suggestions until something is typed", () => {
      withDepends({ dependencyOptions: manyOptions });
      expect(suggestions()).not.toBeInTheDocument();
    });

    it("c0127: suggests the cards matching what was typed, by id or title", () => {
      withDepends({ dependencyOptions: manyOptions });

      fireEvent.change(addInput(), { target: { value: "sch" } });
      expect(suggestionFor(/Design the schema/)).toBeInTheDocument();
      expect(within(suggestions()!).queryByRole("option", { name: /Later work/ })).toBeNull();

      fireEvent.change(addInput(), { target: { value: "c005" } });
      expect(suggestionFor(/Wire the backend/)).toBeInTheDocument();
    });

    it("c0127: adds the dependency picked from the suggestions", () => {
      const props = withDepends({ dependencyOptions: manyOptions });

      fireEvent.change(addInput(), { target: { value: "later" } });
      fireEvent.click(suggestionFor(/Later work/));

      expect(props.onChangeFields).toHaveBeenCalledExactlyOnceWith({
        depends: ["c001", "c003"],
      });
    });

    it("c0127: Enter picks the highlighted suggestion", () => {
      const props = withDepends({ dependencyOptions: manyOptions });

      fireEvent.change(addInput(), { target: { value: "c" } });
      fireEvent.keyDown(addInput(), { key: "ArrowDown" }); // move to the second
      fireEvent.keyDown(addInput(), { key: "Enter" });

      expect(props.onChangeFields).toHaveBeenCalledExactlyOnceWith({
        depends: ["c001", "c004"],
      });
    });

    it("c0127: clears the typed text and the suggestions after adding", () => {
      withDepends({ dependencyOptions: manyOptions });

      fireEvent.change(addInput(), { target: { value: "later" } });
      fireEvent.click(suggestionFor(/Later work/));

      expect(addInput()).toHaveValue("");
      expect(suggestions()).not.toBeInTheDocument();
    });

    it("c0127: refuses a pick that would close a loop, and says which", () => {
      const props = withDepends({
        dependencyOptions: [{ id: "c003", title: "Circular", cycle: ["c003", "c009"] }],
      });

      fireEvent.change(addInput(), { target: { value: "circ" } });
      fireEvent.click(suggestionFor(/Circular/));

      expect(props.onChangeFields).not.toHaveBeenCalled();
      const refusal = screen.getByRole("alert");
      expect(refusal).toHaveTextContent(/cycle/i);
      // names the loop it would close, so the refusal is actionable
      expect(refusal).toHaveTextContent(/c009 → c003 → c009/);
    });

    it("c0127: Escape clears the suggestions without closing the dialog", () => {
      const props = withDepends({ dependencyOptions: manyOptions });

      fireEvent.change(addInput(), { target: { value: "later" } });
      fireEvent.keyDown(addInput(), { key: "Escape" });

      expect(suggestions()).not.toBeInTheDocument();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it("removes a dependency", () => {
      const props = withDepends();

      fireEvent.click(screen.getByRole("button", { name: /remove dependency c001/i }));

      expect(props.onChangeFields).toHaveBeenCalledExactlyOnceWith({ depends: [] });
    });

    it("lists the cards this one is blocking, with nothing to edit there", () => {
      const props = withDepends({
        blocking: [dependent("c005", "Waiting on me", "ready")],
      });
      const section = screen.getByText(/blocking/i).closest(".card-backlinks") as HTMLElement;

      fireEvent.click(within(section).getByRole("button", { name: /Waiting on me/ }));
      expect(props.onOpenCardId).toHaveBeenCalledExactlyOnceWith("c005");
      // derived from other cards' files — removing here would write theirs
      expect(within(section).queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
      expect(within(section).queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("hides the blocking section when nothing depends on this card", () => {
      withDepends({ blocking: [] });
      expect(screen.queryByText(/blocking/i)).not.toBeInTheDocument();
    });
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

describe("archive action (c018)", () => {
  function doneCard(path = "epics/e05-projects/c009-detail.md") {
    const parsed = parseCard(path, RAW.replace("status: in-progress", "status: done"));
    if (!parsed.ok) throw new Error("fixture must parse");
    return parsed.card;
  }

  it("offers Archive on a done card", () => {
    const onArchive = vi.fn();
    renderDetail({ card: doneCard(), onArchive });

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchive).toHaveBeenCalledWith(true);
  });

  it("does not offer it on a card that is not done", () => {
    renderDetail({ onArchive: vi.fn() }); // fixture is in-progress
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("offers Unarchive on an archived card", () => {
    const onArchive = vi.fn();
    renderDetail({
      card: doneCard("epics/e05-projects/archive/c009-detail.md"),
      onArchive,
    });

    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unarchive" }));
    expect(onArchive).toHaveBeenCalledWith(false);
  });
});
