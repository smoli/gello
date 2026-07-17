// Client-side fulltext card filtering (c022). Pure function of (card, query):
// case-insensitive substring, AND across space-separated terms, matched over
// the card's id, title, tags, and body.

import type { Card } from "./cards";

function haystack(card: Card): string {
  return [card.id, card.title, card.tags.join(" "), card.body]
    .join("\n")
    .toLowerCase();
}

/**
 * True when every space-separated term in `query` occurs (case-insensitive
 * substring) somewhere in the card. An empty/whitespace query matches all.
 */
export function cardMatchesQuery(card: Card, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = haystack(card);
  return terms.every((term) => text.includes(term));
}
