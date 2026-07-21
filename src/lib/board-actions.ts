// Board mutations: pure planning via cards.ts, persistence via fs.ts.

import { nextCardId, nextEpicId, nextIssueId, type BoardModel } from "./board";
import { removeDir, removeFile } from "./board-io";
import {
  newCardRaw,
  newEpicRaw,
  parseCard,
  parseEpic,
  replaceCardBody,
  updateCardFields,
  type BoardConfig,
  type Card,
  type CardFieldChanges,
  type Epic,
} from "./cards";
import { writeFileAtomic } from "./fs";
import { withAwaitingCleared, withQuestionAdded } from "./gello-question";
import { appendLogLine, retargetAssetLinks } from "./markdown";
import { planTagRename } from "./tags";

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
 * c0102: park a question on a card — the deterministic counterpart to
 * answering. Inserts the `gelloquestion` block and sets `awaiting: input` in one
 * atomic write. This is the only path that formats a question, so an agent
 * supplies content and never markup. Throws when the card already has an open
 * question (one turn at a time).
 */
export function addGelloQuestion(
  root: string,
  card: Card,
  markdown: string,
  config: BoardConfig,
  today: string,
): MoveResult {
  const result = withQuestionAdded(card, markdown, today, config);
  if (result === null) {
    throw new Error(`card ${card.id} already has an open question`);
  }
  const persisted = writeFileAtomic(`${root}/${card.path}`, result.raw);
  return { card: result.card, persisted };
}

/**
 * c0101: answer a parked `gelloquestion`. Un-fences the block in place (the
 * resolved Q&A becomes plain markdown, `newBody`) and moves the marker from
 * `awaiting: input` to `awaiting: answered` — one atomic write.
 *
 * c0102: the marker is *set*, not cleared, so the answered state is durable on
 * disk. A companion that was down while the human answered still sees it on
 * restart and resumes; it clears the marker when it does.
 */
export function answerGelloQuestion(
  root: string,
  card: Card,
  newBody: string,
  config: BoardConfig,
  today: string,
): MoveResult {
  const { card: withBody } = replaceCardBody(card, newBody, today, config);
  const { card: updated, raw } = updateCardFields(
    withBody,
    { awaiting: "answered" },
    today,
    config,
  );
  const persisted = writeFileAtomic(`${root}/${card.path}`, raw);
  return { card: updated, persisted };
}

/** c0102: clear the `awaiting` marker (app-side counterpart of the companion's
 *  clear-on-resume). */
export function clearAwaitingMarker(
  root: string,
  card: Card,
  config: BoardConfig,
  today: string,
): MoveResult {
  const { card: updated, raw } = withAwaitingCleared(card, today, config);
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

/**
 * c0058: rename a tag everywhere it appears. One surgical `tags:` edit per
 * card carrying `from`, each an atomic write; a card already carrying `to`
 * merges (dedups). Cards without `from` are left untouched. The board.yaml
 * colour key follows separately (App-side). Returns one MoveResult per written
 * card for the optimistic model update and rollback.
 */
export function renameTag(
  root: string,
  model: BoardModel,
  from: string,
  to: string,
  config: BoardConfig,
  now: string,
): MoveResult[] {
  const today = now.slice(0, 10);
  return planTagRename(model, from, to).map(({ card, tags }) => {
    const { card: updated, raw } = updateCardFields(card, { tags }, today, config);
    const persisted = writeFileAtomic(`${root}/${card.path}`, raw);
    return { card: updated, persisted };
  });
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

/**
 * Quick capture (c0089): create a new unassigned card in `.gello/cards/` with
 * `status: inbox` (was `inbox/` + `status: backlog`). Inbox is a status now,
 * not a folder — the card lands in the inbox column.
 */
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
  const path = `cards/${id}-${slugify(input.title)}.md`;
  const raw = newCardRaw(id, input.title, input.body, today, {
    type: input.type,
    status: "inbox",
  });
  const parsed = parseCard(path, raw, model.config);
  if (!parsed.ok) {
    // internal invariant: newCardRaw output must always parse
    throw new Error(`new card would be invalid: ${parsed.invalid.reason}`);
  }
  const persisted = writeFileAtomic(`${root}/${path}`, raw);
  return { card: parsed.card, persisted };
}

/** i0028: a newly created epic and the folder it lives in. */
export interface NewEpicResult {
  epic: Epic;
  /** Folder name under epics/ (e.g. "e07-dark-mode"), = the epic group key. */
  folder: string;
  persisted: Promise<void>;
}

/**
 * i0028: create a new epic — allocate the next e-namespace id, scaffold
 * `epics/eNN-<slug>/epic.md` (id, title, `status: backlog`, `## Goal` from
 * input, empty `## Definition of done`) and write it atomically (the write
 * creates the folder, c0076/i0026). Ids are never reused (nextEpicId).
 */
export function createEpic(
  root: string,
  model: BoardModel,
  input: { title: string; goal: string },
): NewEpicResult {
  const id = nextEpicId(model);
  const folder = `${id}-${slugify(input.title)}`;
  const path = `epics/${folder}/epic.md`;
  const raw = newEpicRaw(id, input.title, input.goal);
  const parsed = parseEpic(path, raw);
  if (!parsed.ok) {
    // internal invariant: newEpicRaw output must always parse
    throw new Error(`new epic would be invalid: ${parsed.invalid.reason}`);
  }
  const persisted = writeFileAtomic(`${root}/${path}`, raw);
  return { epic: parsed.epic, folder, persisted };
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
  input: { title: string; body: string; id?: string },
  today: string,
): MoveResult {
  // i0022: reuse the id reserved when an image was pasted into the draft, so
  // the issue file and that image's asset folder match; else allocate fresh.
  const id = input.id ?? nextIssueId(model); // c043: i-namespace
  const folder = source.path.slice(0, source.path.lastIndexOf("/"));
  const path = `${folder}/${id}-${slugify(input.title)}.md`;
  const raw = newCardRaw(id, input.title, input.body, today, {
    type: "issue",
    ref: source.id,
    epic: source.epic ?? undefined,
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
  target: { folder: string; epicId: string | null },
  config: BoardConfig,
  now: string,
  status?: string,
  order?: number,
): MoveResult {
  const today = now.slice(0, 10);
  const statusChanges = status !== undefined && status !== card.status;
  // c0078: epicId null → standalone card under `.gello/cards/` (epic cleared)
  let changes: CardFieldChanges = { epic: target.epicId };
  if (statusChanges) {
    // mirror saveCardFields' c056 bookkeeping: stamp when the status was assigned
    changes = { statusChanged: now, status, ...changes };
  }
  // i0015: a positioned triage keeps the dropped slot; otherwise a status
  // change drops a manual rank that belonged to the old column
  if (order !== undefined) {
    changes = { ...changes, order };
  } else if (statusChanges && card.order !== null) {
    changes = { ...changes, order: null };
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
  // c0078: destination folder — an epic (`epics/<folder>/`) or the flat
  // `cards/` home for standalone (i0029: was the pre-migration `milestones/`)
  const destFolder =
    target.epicId === null ? "cards" : `epics/${target.folder}`;
  // rewrite relative asset links from the source depth to the destination
  // depth (inbox & cards/ are depth 1, an epic folder is depth 2)
  const srcDepth = card.path.split("/").length - 1;
  const destDepth = destFolder.split("/").length;
  const newRaw =
    srcDepth === destDepth
      ? raw
      : retargetAssetLinks(
          raw,
          `${"../".repeat(srcDepth)}assets/`,
          `${"../".repeat(destDepth)}assets/`,
        );
  const newPath = `${destFolder}/${basename(card.path)}`;
  const parsed = parseCard(newPath, newRaw, config);
  if (!parsed.ok) {
    throw new Error(`triaged card would be invalid: ${parsed.invalid.reason}`);
  }

  // i0026: a card can be triaged to where it already lives (e.g. clearing the
  // epic on a card that is already standalone → cards/). Source and dest are
  // then the same file, so write-then-delete-old would delete what we just
  // wrote. Only remove the old file when the move actually relocates it.
  const persisted =
    newPath === card.path
      ? writeFileAtomic(`${root}/${newPath}`, newRaw)
      : writeFileAtomic(`${root}/${newPath}`, newRaw).then(() =>
          removeFile(`${root}/${card.path}`),
        );
  return { card: parsed.card, persisted };
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function dirname(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

/**
 * c018: move a card between its home folder and that folder's `archive/`.
 * Archiving keeps the card where it belongs (its epic, or `cards/`) — only one
 * folder level deeper — so epic membership, ids, and search are unaffected.
 * Relative asset links are rewritten for the new depth; the new file is written
 * before the old one is removed, so an interruption leaves a duplicate rather
 * than a lost card. A dated Log line records the move.
 */
function moveArchive(
  root: string,
  card: Card,
  archived: boolean,
  config: BoardConfig,
  today: string,
): MoveResult {
  const from = dirname(card.path);
  const destFolder = archived ? `${from}/archive` : dirname(from);
  const { raw } = replaceCardBody(
    card,
    appendLogLine(card.body, `${today} ${archived ? "archived" : "unarchived"} (app)`),
    today,
    config,
  );
  const srcDepth = card.path.split("/").length - 1;
  const destDepth = destFolder.split("/").length;
  const newRaw = retargetAssetLinks(
    raw,
    `${"../".repeat(srcDepth)}assets/`,
    `${"../".repeat(destDepth)}assets/`,
  );
  const newPath = `${destFolder}/${basename(card.path)}`;
  const parsed = parseCard(newPath, newRaw, config);
  if (!parsed.ok) {
    throw new Error(`archived card would be invalid: ${parsed.invalid.reason}`);
  }
  const persisted = writeFileAtomic(`${root}/${newPath}`, newRaw).then(() =>
    removeFile(`${root}/${card.path}`),
  );
  return { card: parsed.card, persisted };
}

/** c018: archive a (long done) card into its folder's `archive/`. */
export function archiveCard(
  root: string,
  card: Card,
  config: BoardConfig,
  today: string,
): MoveResult {
  if (card.archived) throw new Error(`card ${card.id} is already archived`);
  return moveArchive(root, card, true, config, today);
}

/** c018: bring an archived card back onto the board. */
export function unarchiveCard(
  root: string,
  card: Card,
  config: BoardConfig,
  today: string,
): MoveResult {
  if (!card.archived) throw new Error(`card ${card.id} is not archived`);
  return moveArchive(root, card, false, config, today);
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

// Re-exported so existing callers keep their import site; the definitions moved
// to the pure dates module (c0102) so the Node companion can share them.
export { nowIsoDateTime, todayIsoDate } from "./dates";
