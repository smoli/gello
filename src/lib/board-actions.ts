// Board mutations: pure planning via cards.ts, persistence via fs.ts.

import { nextCardId, nextIssueId, type BoardModel } from "./board";
import { removeDir, removeFile } from "./board-io";
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
 *
 * `now` may be a date or a full ISO datetime; `updated` and Log lines always
 * use the date part, `status-changed` (c056) records the full value.
 */
export function saveCardFields(
  root: string,
  card: Card,
  changes: CardFieldChanges,
  config: BoardConfig,
  now: string,
): MoveResult {
  const today = now.slice(0, 10);
  const statusChanges = changes.status !== undefined && changes.status !== card.status;
  if (statusChanges) {
    // c056: stamp when the status was assigned; a manual rank belongs to
    // the column being left, so clear it unless the drop set a new one.
    changes = { statusChanged: now, ...changes };
    if (changes.order === undefined && card.order !== null) {
      changes = { ...changes, order: null };
    }
  }
  let { card: updated, raw } = updateCardFields(card, changes, today, config);
  // c042: the app journals status changes into the card's Log, like agents do
  if (statusChanges) {
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

/**
 * Move a card to a new status (drag & drop / keyboard move). A positioned
 * drop into a manual column passes `order` (c056); keyboard moves and plain
 * column drops omit it and land in the column's unranked tail.
 */
export function moveCard(
  root: string,
  card: Card,
  status: string,
  config: BoardConfig,
  now: string,
  order?: number,
): MoveResult {
  return saveCardFields(root, card, { status, order }, config, now);
}

/** Re-rank a card within its manual column (c056): order + updated only. */
export function reorderCard(
  root: string,
  card: Card,
  order: number,
  config: BoardConfig,
  now: string,
): MoveResult {
  return saveCardFields(root, card, { order }, config, now);
}

/** Apply a renumber plan (c056): one surgical rank write per card. */
export function renumberCards(
  root: string,
  ranks: Array<{ card: Card; order: number }>,
  config: BoardConfig,
  now: string,
): MoveResult[] {
  return ranks.map(({ card, order }) => reorderCard(root, card, order, config, now));
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
  input: { title: string; body: string; type?: string; id?: string },
  today: string,
): MoveResult {
  // c043: issues get their own i-namespace; everything else allocates c-ids.
  // i0013: an id may be pre-reserved when an image was pasted into the draft
  // before the card existed — reuse it so the asset folder/link line up.
  const id =
    input.id ?? (input.type === "issue" ? nextIssueId(model) : nextCardId(model));
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
  const id = nextIssueId(model); // c043: i-namespace
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
 * Triage: move a card into a milestone folder. Sets the `milestone` field,
 * rewrites relative asset links for the new folder depth (a no-op when the
 * source already sits at milestone depth — re-triage between milestones),
 * writes the new file, and only then deletes the old one — a failure in
 * between leaves a visible duplicate, never a lost card.
 *
 * When `status` is given and differs from the card's current status (i0005:
 * status-drop with an inline milestone pick), it is set in the same write and
 * stamped/logged exactly like a plain move (c056/c042).
 *
 * `now` may be a date or a full ISO datetime; `status-changed` records the
 * full value, `updated` and Log lines the date part.
 */
export function triageCard(
  root: string,
  card: Card,
  target: { folder: string; milestoneId: string },
  config: BoardConfig,
  now: string,
  status?: string,
): MoveResult {
  const today = now.slice(0, 10);
  const statusChanges = status !== undefined && status !== card.status;
  let changes: CardFieldChanges = { milestone: target.milestoneId };
  if (statusChanges) {
    // mirror saveCardFields' c056 bookkeeping: stamp when the status was
    // assigned and drop a manual rank that belonged to the old column
    changes = { statusChanged: now, status, ...changes };
    if (card.order !== null) changes = { ...changes, order: null };
  }
  let { card: updated, raw } = updateCardFields(card, changes, today, config);
  if (statusChanges) {
    ({ card: updated, raw } = replaceCardBody(
      updated,
      appendLogLine(updated.body, `${today} status → ${status} (app)`),
      today,
      config,
    ));
  }
  const newRaw = retargetAssetLinks(raw, "../assets/", "../../assets/");
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

/**
 * c0062: permanently delete a card — its Markdown file, then its asset folder
 * (`assets/<card-id>/`, keyed by id per concept §; a no-op if the card has no
 * attachments). The card file goes first so a failure never leaves a card
 * pointing at deleted assets; if the file is gone but the asset cleanup fails,
 * the card is still deleted (the folder is a harmless orphan).
 */
export function deleteCard(root: string, card: Card): { persisted: Promise<void> } {
  const persisted = removeFile(`${root}/${card.path}`).then(() =>
    removeDir(`${root}/assets/${card.id}`),
  );
  return { persisted };
}

/** Now as a local-time ISO datetime (c056) — lexicographically sortable,
 *  human-readable in the file, no timezone juggling for a local-first tool. */
export function nowIsoDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Today as a local ISO date (YYYY-MM-DD) for `updated` bumps. */
export function todayIsoDate(): string {
  return nowIsoDateTime().slice(0, 10);
}
