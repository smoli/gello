// Board loader: turns the files under .gello/ into one typed BoardModel.
// Pure — no filesystem access; callers (Tauri layer, tests) supply the files.

import {
  parseBoardConfig,
  parseCard,
  parseMilestone,
  type BoardConfig,
  type Card,
  type InvalidFile,
  type Milestone,
} from "./cards";

export interface BoardFile {
  /** Path relative to the .gello/ root, forward slashes. */
  path: string;
  content: string;
}

export interface MilestoneGroup {
  /** Folder name under milestones/, e.g. "m01-foundation". */
  folder: string;
  /** Parsed milestone.md, or null if the folder has none. */
  milestone: Milestone | null;
  cards: Card[];
}

export interface BoardModel {
  config: BoardConfig;
  configError: string | null;
  /** Raw board.yaml content ("" if absent) — kept so the model can be
   *  reconstructed into files for incremental reconciliation. */
  configRaw: string;
  milestones: MilestoneGroup[];
  inbox: Card[];
  invalid: InvalidFile[];
}

/**
 * Compare ids numerically within a namespace (c044): mixed-width ids
 * (c055 vs c0056) must order by number, not by string.
 */
function compareIds(a: string, b: string): number {
  const idRe = /^([a-z]+)(\d+)$/i;
  const ma = idRe.exec(a);
  const mb = idRe.exec(b);
  if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
  return a.localeCompare(b);
}

// --- per-column sorting (c056) ---------------------------------------------------
//
// Priority is display-only: no column sorts by it. ISO dates and datetimes
// compare lexicographically, so day-only and timed values mix fine.

/** Capture order: created ascending, sequential ids as the tiebreaker. */
export function byCreatedThenId(a: Card, b: Card): number {
  const created = (a.created ?? "").localeCompare(b.created ?? "");
  if (created !== 0) return created;
  return compareIds(a.id, b.id);
}

/** Workflow order: when the status was assigned, earliest first. Cards
 *  without `status-changed` fall back to updated → created → id. */
function byStatusChanged(a: Card, b: Card): number {
  const key = (c: Card) => c.statusChanged ?? c.updated ?? c.created ?? "";
  const cmp = key(a).localeCompare(key(b));
  if (cmp !== 0) return cmp;
  return compareIds(a.id, b.id);
}

/** Manual order: rank ascending; unranked cards last, by created/id. */
function byManualOrder(a: Card, b: Card): number {
  if (a.order !== null && b.order !== null && a.order !== b.order) {
    return a.order - b.order;
  }
  if (a.order !== null && b.order === null) return -1;
  if (a.order === null && b.order !== null) return 1;
  return byCreatedThenId(a, b);
}

/** Columns the user can rearrange by hand (c056). */
export const MANUAL_COLUMNS: ReadonlySet<string> = new Set(["backlog", "ready"]);

/** The c056 per-column sort rule. Unknown custom columns are treated as
 *  workflow stages (status-changed rule). */
export function columnComparator(column: string): (a: Card, b: Card) => number {
  if (MANUAL_COLUMNS.has(column)) return byManualOrder;
  if (column === "discuss") return byCreatedThenId;
  return byStatusChanged;
}

const RANK_STEP = 10;

export interface ManualInsertPlan {
  /** Rank for the dragged card. */
  order: number;
  /** Present only when neighbors must be re-ranked to express the position
   *  (unranked neighbors, exhausted midpoint gap). Rare by design. */
  renumber?: Array<{ card: Card; order: number }>;
}

/**
 * Plan a drop at `index` into a manual column (cards in display order,
 * WITHOUT the dragged card). Prefers a single write to the dragged card;
 * falls back to renumbering the whole column when ranks can't express the
 * position.
 */
export function planManualInsert(cards: Card[], index: number): ManualInsertPlan {
  const above = index > 0 ? cards[index - 1] : null;
  const below = index < cards.length ? cards[index] : null;

  // Ranked cards sort before unranked ones, so a single new rank works
  // exactly when everything above the slot is ranked.
  if (above === null || above.order !== null) {
    const a = above?.order ?? null;
    const b = below?.order ?? null;
    if (a === null && b === null) return { order: RANK_STEP };
    if (a === null) return { order: b! - RANK_STEP };
    if (b === null) return { order: a + RANK_STEP };
    const mid = (a + b) / 2;
    if (mid > a && mid < b) return { order: mid };
  }

  // Renumber the display sequence with the dragged card in place.
  const order = (index + 1) * RANK_STEP;
  const renumber = cards
    .map((card, i) => ({ card, order: (i < index ? i + 1 : i + 2) * RANK_STEP }))
    .filter(({ card, order: rank }) => card.order !== rank);
  return { order, renumber };
}

export function loadBoard(files: BoardFile[]): BoardModel {
  const configFile = files.find((f) => f.path === "board.yaml");
  const configRaw = configFile?.content ?? "";
  const { config, error: configError } = parseBoardConfig(configRaw);

  const inbox: Card[] = [];
  const invalid: InvalidFile[] = [];
  const groups = new Map<string, MilestoneGroup>();

  const groupFor = (folder: string): MilestoneGroup => {
    let group = groups.get(folder);
    if (!group) {
      group = { folder, milestone: null, cards: [] };
      groups.set(folder, group);
    }
    return group;
  };

  for (const { path, content } of files) {
    if (!path.endsWith(".md")) continue;
    const segments = path.split("/");

    if (segments.length === 2 && segments[0] === "inbox") {
      const result = parseCard(path, content, config);
      if (result.ok) inbox.push(result.card);
      else invalid.push(result.invalid);
    } else if (segments.length === 3 && segments[0] === "milestones") {
      const folder = segments[1];
      if (segments[2] === "milestone.md") {
        const result = parseMilestone(path, content);
        if (result.ok) groupFor(folder).milestone = result.milestone;
        else invalid.push(result.invalid);
      } else {
        const result = parseCard(path, content, config);
        if (result.ok) groupFor(folder).cards.push(result.card);
        else invalid.push(result.invalid);
      }
    }
    // everything else (concept.md, assets, deeper nesting) is not board data
  }

  // c031: duplicate card IDs — the first occurrence (by path order) owns the
  // id; every other copy goes to the needs-attention lane. This also fails
  // the dogfood test, so a duplicate can never sit silently on the board.
  const owner = new Map<string, string>();
  const duplicate = new Map<string, string>(); // path → reason
  const everyCard = [...inbox, ...[...groups.values()].flatMap((g) => g.cards)];
  everyCard.sort((a, b) => a.path.localeCompare(b.path));
  for (const card of everyCard) {
    const ownerPath = owner.get(card.id);
    if (ownerPath === undefined) {
      owner.set(card.id, card.path);
    } else {
      duplicate.set(card.path, `duplicate id ${card.id}, also used by ${ownerPath}`);
    }
  }
  const dedup = (cards: Card[]): Card[] =>
    cards.filter((card) => {
      const reason = duplicate.get(card.path);
      if (reason === undefined) return true;
      invalid.push({ path: card.path, raw: card.raw, reason });
      return false;
    });

  const dedupedInbox = dedup(inbox);
  dedupedInbox.sort(byCreatedThenId);
  const milestones = [...groups.values()].sort((a, b) =>
    a.folder.localeCompare(b.folder),
  );
  for (const group of milestones) {
    group.cards = dedup(group.cards);
    group.cards.sort(byCreatedThenId);
  }
  invalid.sort((a, b) => a.path.localeCompare(b.path));

  return { config, configError, configRaw, milestones, inbox: dedupedInbox, invalid };
}

// --- incremental reconciliation -------------------------------------------------

export interface FileChange {
  /** Path relative to .gello root. */
  path: string;
  /** New content, or null when the file was deleted. */
  content: string | null;
}

/** Reconstruct the BoardFile list a model was built from. */
function modelToFiles(model: BoardModel): Map<string, string> {
  const files = new Map<string, string>();
  if (model.configRaw !== "") files.set("board.yaml", model.configRaw);
  for (const card of model.inbox) files.set(card.path, card.raw);
  for (const group of model.milestones) {
    if (group.milestone) files.set(group.milestone.path, group.milestone.raw);
    for (const card of group.cards) files.set(card.path, card.raw);
  }
  for (const entry of model.invalid) files.set(entry.path, entry.raw);
  return files;
}

/**
 * Apply external file changes (from the watcher) to a model. Rebuilds via
 * loadBoard so every rule — validation, grouping, ordering, config — applies
 * identically to watched changes and fresh loads.
 *
 * Returns the SAME model reference when no change has an effect (e.g. our
 * own atomic writes echoing back), so callers can skip re-rendering.
 */
export function applyFileChanges(
  model: BoardModel,
  changes: FileChange[],
): BoardModel {
  const files = modelToFiles(model);
  let dirty = false;
  for (const { path, content } of changes) {
    const existing = files.get(path);
    if (content === null) {
      if (existing !== undefined) {
        files.delete(path);
        dirty = true;
      }
    } else if (existing !== content) {
      files.set(path, content);
      dirty = true;
    }
  }
  if (!dirty) return model;
  return loadBoard([...files].map(([path, content]) => ({ path, content })));
}

/** All cards on the board, inbox and milestones alike. */
function allCards(model: BoardModel): Card[] {
  return [...model.inbox, ...model.milestones.flatMap((g) => g.cards)];
}

/** Find a card by id anywhere on the board; null when absent (dangling ref). */
export function findCardById(model: BoardModel, id: string): Card | null {
  return allCards(model).find((card) => card.id === id) ?? null;
}

/**
 * Issues pointing at `id` via ref that are not done — computed at render time,
 * never written into the referenced card (c024).
 */
export function openIssuesFor(model: BoardModel, id: string): Card[] {
  return allCards(model).filter(
    (card) => card.type === "issue" && card.ref === id && card.status !== "done",
  );
}

/** Immutably add a freshly captured card to the inbox, keeping sort order. */
export function withNewInboxCard(model: BoardModel, card: Card): BoardModel {
  return { ...model, inbox: [...model.inbox, card].sort(byCreatedThenId) };
}

/**
 * Immutably move a triaged card out of the inbox (matched by its old path)
 * into a milestone group, keeping sort order.
 */
export function withCardTriaged(
  model: BoardModel,
  oldPath: string,
  moved: Card,
  targetFolder: string,
): BoardModel {
  return {
    ...model,
    inbox: model.inbox.filter((c) => c.path !== oldPath),
    milestones: model.milestones.map((group) =>
      group.folder === targetFolder
        ? { ...group, cards: [...group.cards, moved].sort(byCreatedThenId) }
        : group,
    ),
  };
}

/**
 * Immutably replace one card (matched by path) with an updated version —
 * used for optimistic UI updates after a status change.
 */
export function withUpdatedCard(model: BoardModel, updated: Card): BoardModel {
  const replace = (card: Card): Card =>
    card.path === updated.path ? updated : card;
  return {
    ...model,
    inbox: model.inbox.map(replace),
    milestones: model.milestones.map((group) => ({
      ...group,
      cards: group.cards.map(replace),
    })),
  };
}

// --- ID derivation -------------------------------------------------------------

function maxIdNumber(candidates: string[], prefix: string): number {
  const re = new RegExp(`^${prefix}(\\d+)`);
  let max = 0;
  for (const candidate of candidates) {
    const match = re.exec(candidate);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function nextIdInNamespace(model: BoardModel, prefix: string): string {
  const candidates = [
    ...model.inbox.map((c) => c.id),
    ...model.milestones.flatMap((g) => g.cards.map((c) => c.id)),
    ...model.invalid.map((entry) => basename(entry.path)),
  ];
  const next = maxIdNumber(candidates, prefix) + 1;
  // c044: new ids pad to 4 digits; existing shorter ids are never renumbered
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/**
 * Next free task ID (c-namespace). Invalid files reserve their
 * filename-derived ID too, so a broken card never gets its ID handed out
 * twice.
 */
export function nextCardId(model: BoardModel): string {
  return nextIdInNamespace(model, "c");
}

/** Next free issue ID — issues live in their own i-namespace (c043). */
export function nextIssueId(model: BoardModel): string {
  return nextIdInNamespace(model, "i");
}

export function nextMilestoneId(model: BoardModel): string {
  const candidates = model.milestones.flatMap((g) => [
    g.folder,
    ...(g.milestone ? [g.milestone.id] : []),
  ]);
  const next = maxIdNumber(candidates, "m") + 1;
  return `m${String(next).padStart(2, "0")}`;
}
