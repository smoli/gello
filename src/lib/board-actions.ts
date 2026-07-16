// Board mutations: pure planning via cards.ts, persistence via fs.ts.

import { nextCardId, type BoardModel } from "./board";
import { removeFile } from "./board-io";
import {
  newCardRaw,
  parseCard,
  replaceCardBody,
  updateCardFields,
  type BoardConfig,
  type Card,
  type CardFieldChanges,
} from "./cards";
import { writeFileAtomic } from "./fs";
import { appendLogLine, retargetAssetLinks } from "./markdown";

export interface MoveResult {
  /** The card with new status/updated — available synchronously for
   *  optimistic UI. */
  card: Card;
  /** Resolves when the file write has landed; rejects on failure so the
   *  caller can roll back. */
  persisted: Promise<void>;
}

/**
 * Persist frontmatter field changes: computes the surgical edit synchronously
 * and starts the atomic write immediately (no debounce). Throws synchronously
 * on changes that would produce an invalid card, before anything is written.
 */
export function saveCardFields(
  root: string,
  card: Card,
  changes: CardFieldChanges,
  config: BoardConfig,
  today: string,
): MoveResult {
  let { card: updated, raw } = updateCardFields(card, changes, today, config);
  // c042: the app journals status changes into the card's Log, like agents do
  if (changes.status !== undefined && changes.status !== card.status) {
    ({ card: updated, raw } = replaceCardBody(
      updated,
      appendLogLine(updated.body, `${today} status → ${changes.status} (app)`),
      today,
      config,
    ));
  }
  const persisted = writeFileAtomic(`${root}/${card.path}`, raw);
  return { card: updated, persisted };
}

/** Move a card to a new status (drag & drop / keyboard move). */
export function moveCard(
  root: string,
  card: Card,
  status: string,
  config: BoardConfig,
  today: string,
): MoveResult {
  return saveCardFields(root, card, { status }, config, today);
}

/** Replace the card body (checkbox toggles). */
export function saveCardBody(
  root: string,
  card: Card,
  newBody: string,
  config: BoardConfig,
  today: string,
): MoveResult {
  const { card: updated, raw } = replaceCardBody(card, newBody, today, config);
  const persisted = writeFileAtomic(`${root}/${card.path}`, raw);
  return { card: updated, persisted };
}

/**
 * Persist an inline edit (title + body) as ONE atomic write: the title is a
 * surgical frontmatter edit, the body a replacement, composed before writing.
 */
export function saveCardEdit(
  root: string,
  card: Card,
  edit: { title: string; body: string },
  config: BoardConfig,
  today: string,
): MoveResult {
  let current = card;
  if (edit.title !== card.title) {
    current = updateCardFields(current, { title: edit.title }, today, config).card;
  }
  const { card: updated, raw } = replaceCardBody(current, edit.body, today, config);
  const persisted = writeFileAtomic(`${root}/${card.path}`, raw);
  return { card: updated, persisted };
}

/** Filename-safe slug from a card title. */
function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug || "idea";
}

/** Quick capture: create a new inbox card with the next free ID. */
export function createCard(
  root: string,
  model: BoardModel,
  input: { title: string; body: string; type?: string },
  today: string,
): MoveResult {
  const id = nextCardId(model);
  const path = `inbox/${id}-${slugify(input.title)}.md`;
  const raw = newCardRaw(id, input.title, input.body, today, { type: input.type });
  const parsed = parseCard(path, raw, model.config);
  if (!parsed.ok) {
    // internal invariant: newCardRaw output must always parse
    throw new Error(`new card would be invalid: ${parsed.invalid.reason}`);
  }
  const persisted = writeFileAtomic(`${root}/${path}`, raw);
  return { card: parsed.card, persisted };
}

/**
 * Report a issue against a card (c024/c037): the issue is born next to its
 * source — same folder, source's milestone, `ref` pre-filled, status
 * backlog. Called only on draft submit; escaping the draft creates nothing.
 */
export function createIssueFor(
  root: string,
  model: BoardModel,
  source: Card,
  input: { title: string; body: string },
  today: string,
): MoveResult {
  const id = nextCardId(model);
  const folder = source.path.slice(0, source.path.lastIndexOf("/"));
  const path = `${folder}/${id}-${slugify(input.title)}.md`;
  const raw = newCardRaw(id, input.title, input.body, today, {
    type: "issue",
    ref: source.id,
    milestone: source.milestone ?? undefined,
  });
  const parsed = parseCard(path, raw, model.config);
  if (!parsed.ok) {
    throw new Error(`new issue would be invalid: ${parsed.invalid.reason}`);
  }
  const persisted = writeFileAtomic(`${root}/${path}`, raw);
  return { card: parsed.card, persisted };
}

/**
 * Triage: move an inbox card into a milestone folder. Sets the `milestone`
 * field, rewrites relative asset links for the new folder depth, writes the
 * new file, and only then deletes the old one — a failure in between leaves
 * a visible duplicate, never a lost card.
 */
export function triageCard(
  root: string,
  card: Card,
  target: { folder: string; milestoneId: string },
  config: BoardConfig,
  today: string,
): MoveResult {
  const withMilestone = updateCardFields(
    card,
    { milestone: target.milestoneId },
    today,
    config,
  );
  const newRaw = retargetAssetLinks(withMilestone.raw, "../assets/", "../../assets/");
  const newPath = `milestones/${target.folder}/${basename(card.path)}`;
  const parsed = parseCard(newPath, newRaw, config);
  if (!parsed.ok) {
    throw new Error(`triaged card would be invalid: ${parsed.invalid.reason}`);
  }

  const persisted = writeFileAtomic(`${root}/${newPath}`, newRaw).then(() =>
    removeFile(`${root}/${card.path}`),
  );
  return { card: parsed.card, persisted };
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Today as an ISO date (YYYY-MM-DD) for `updated` bumps. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
