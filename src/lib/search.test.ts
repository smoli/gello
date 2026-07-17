import { describe, expect, it } from "vitest";
import { parseCard, type Card } from "./cards";
import { cardMatchesQuery } from "./search";

function makeCard(fields: {
  id?: string;
  title?: string;
  tags?: string;
  body?: string;
}): Card {
  const { id = "c001", title = "A card", tags = "", body = "some body" } = fields;
  const tagsLine = tags ? `tags: [${tags}]\n` : "";
  const raw = `---\nid: ${id}\ntitle: ${title}\nstatus: backlog\n${tagsLine}---\n${body}\n`;
  const parsed = parseCard(`inbox/${id}.md`, raw);
  if (!parsed.ok) throw new Error("fixture must parse");
  return parsed.card;
}

describe("cardMatchesQuery", () => {
  const card = makeCard({
    id: "c042",
    title: "Kanban Drag and Drop",
    tags: "ui, core",
    body: "Persists the status field to frontmatter.",
  });

  it("matches a case-insensitive substring of the title", () => {
    expect(cardMatchesQuery(card, "kanban")).toBe(true);
    expect(cardMatchesQuery(card, "DRAG")).toBe(true);
  });

  it("matches the body", () => {
    expect(cardMatchesQuery(card, "frontmatter")).toBe(true);
  });

  it("matches a tag", () => {
    expect(cardMatchesQuery(card, "core")).toBe(true);
  });

  it("matches the id — typing a card number finds it", () => {
    expect(cardMatchesQuery(card, "c042")).toBe(true);
  });

  it("requires every space-separated term (AND)", () => {
    expect(cardMatchesQuery(card, "kanban frontmatter")).toBe(true);
    expect(cardMatchesQuery(card, "kanban nope")).toBe(false);
  });

  it("terms may match across different fields", () => {
    // "c042" (id) AND "core" (tag) AND "drop" (title)
    expect(cardMatchesQuery(card, "c042 core drop")).toBe(true);
  });

  it("an empty or whitespace-only query matches everything", () => {
    expect(cardMatchesQuery(card, "")).toBe(true);
    expect(cardMatchesQuery(card, "   ")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(cardMatchesQuery(card, "zzz")).toBe(false);
  });

  it("collapses extra whitespace between terms", () => {
    expect(cardMatchesQuery(card, "  kanban   drop  ")).toBe(true);
  });
});
