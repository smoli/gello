// Board loader: turns the files under .gello/ into one typed BoardModel.
// Pure — no filesystem access; callers (Tauri layer, tests) supply the files.

import {
  parseBoardConfig,
  parseCard,
  parseEpic,
  type BoardConfig,
  type Card,
  type InvalidFile,
  type Epic,
} from "./cards";

export interface BoardFile {
  /** Path relative to the .gello/ root, forward slashes. */
  path: string;
  content: string;
}

/** c0076: an epic folder (renamed from milestone) and the cards it contains. */
export interface EpicGroup {
  /** Folder name under epics/ (or legacy milestones/), e.g. "e01-foundation". */
  folder: string;
  /** Parsed epic.md (or legacy milestone.md), or null if the folder has none. */
  epic: Epic | null;
  cards: Card[];
}

export interface BoardModel {
  config: BoardConfig;
  configError: string | null;
  /** Raw board.yaml content ("" if absent) — kept so the model can be
   *  reconstructed into files for incremental reconciliation. */
  configRaw: string;
  epics: EpicGroup[];
  /** c0076: standalone cards under `.gello/cards/` — no epic membership.
   *  c0088: the inbox is no longer a folder — an unassigned card is just a
   *  standalone card with `status: inbox`. */
  cards: Card[];
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
// No column sorts by priority (removed in i0025). ISO dates and datetimes
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

// --- WIP limits (c008) ----------------------------------------------------------

export interface WipState {
  /** The configured limit for the column. */
  limit: number;
  /** Cards currently in the column. */
  count: number;
  /** More cards than the limit allows. Soft — nothing blocks a move. */
  over: boolean;
}

/**
 * WIP state for a column, or null when board.yaml configures no limit for it
 * (columns without a limit show no counter beyond the plain count). A limit of
 * 0 is a limit: any card in the column is an overrun.
 */
export function wipState(
  config: BoardConfig,
  column: string,
  count: number,
): WipState | null {
  const limit = config.wipLimits[column];
  if (limit === undefined) return null;
  return { limit, count, over: count > limit };
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

  const standalone: Card[] = [];
  const invalid: InvalidFile[] = [];
  const groups = new Map<string, EpicGroup>();

  const groupFor = (folder: string): EpicGroup => {
    let group = groups.get(folder);
    if (!group) {
      group = { folder, epic: null, cards: [] };
      groups.set(folder, group);
    }
    return group;
  };

  for (const { path, content } of files) {
    if (!path.endsWith(".md")) continue;
    const segments = path.split("/");

    // c018: an `archive/` folder holds long-done cards. They belong to the same
    // home as their live siblings (so ids stay reserved and search finds them);
    // the `archived` flag on the card keeps them off the board by default.
    const archived = segments[segments.length - 2] === "archive";
    const home = archived ? segments.slice(0, -2) : segments.slice(0, -1);

    if (home.length === 1 && home[0] === "cards") {
      // c0076: standalone cards — a flat home, no epic membership. c0088: an
      // unassigned card (incl. `status: inbox`) lives here; there is no inbox/.
      const result = parseCard(path, content, config);
      if (result.ok) standalone.push(result.card);
      else invalid.push(result.invalid);
    } else if (
      home.length === 2 &&
      (home[0] === "epics" || home[0] === "milestones") // legacy
    ) {
      const folder = home[1];
      const name = segments[segments.length - 1];
      if (!archived && (name === "epic.md" || name === "milestone.md")) {
        const result = parseEpic(path, content);
        if (result.ok) groupFor(folder).epic = result.epic;
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
  const everyCard = [
    ...standalone,
    ...[...groups.values()].flatMap((g) => g.cards),
  ];
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

  const dedupedStandalone = dedup(standalone);
  dedupedStandalone.sort(byCreatedThenId);
  const epics = [...groups.values()].sort((a, b) =>
    a.folder.localeCompare(b.folder),
  );
  for (const group of epics) {
    group.cards = dedup(group.cards);
    group.cards.sort(byCreatedThenId);
  }
  invalid.sort((a, b) => a.path.localeCompare(b.path));

  return {
    config,
    configError,
    configRaw,
    epics,
    cards: dedupedStandalone,
    invalid,
  };
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
  for (const card of model.cards) files.set(card.path, card.raw);
  for (const group of model.epics) {
    if (group.epic) files.set(group.epic.path, group.epic.raw);
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

/** All cards on the board — standalone and epic-grouped alike. */
function allCards(model: BoardModel): Card[] {
  return [...model.cards, ...model.epics.flatMap((g) => g.cards)];
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

/**
 * c0115: follow-up tasks pointing at `id` via ref that are not done. The
 * counterpart to openIssuesFor over the same backlinks: an issue is an
 * unresolved problem, a follow-up is planned extra work on finished work.
 */
export function openFollowUpsFor(model: BoardModel, id: string): Card[] {
  return allCards(model).filter(
    (card) => card.type !== "issue" && card.ref === id && card.status !== "done",
  );
}

/** An unfinished dependency, the reason a card will not be picked up (c0123). */
export interface Blocker {
  id: string;
  /** No card on the board carries this id — a typo or a deleted card. */
  missing: boolean;
}

/** Statuses where an unfinished dependency is worth flagging (c0123): in
 *  `ready` it costs a run, in `in-progress` it is an anomaly. Anywhere else an
 *  open dependency is just the plan. */
const BLOCKED_STATUSES: ReadonlySet<string> = new Set(["ready", "in-progress"]);

/**
 * The dependencies holding `card` back, in the order the card lists them.
 * Empty when nothing is holding it — including every status where an open
 * dependency means nothing — so a caller can render on a non-empty result.
 *
 * A board fact: `depends` plus those cards' statuses, no companion involved.
 */
export function blockersFor(model: BoardModel, card: Card): Blocker[] {
  if (!BLOCKED_STATUSES.has(card.status)) return [];
  return card.depends.flatMap((id): Blocker[] => {
    const dependency = findCardById(model, id);
    if (dependency === null) return [{ id, missing: true }];
    return dependency.status === "done" ? [] : [{ id, missing: false }];
  });
}

/**
 * c0088: immutably add a freshly captured card to the standalone `cards/` set,
 * keeping sort order. Capture gives it `status: inbox`, so it lands in the inbox
 * column; it has no epic. (Was withNewInboxCard, when the inbox was a folder.)
 */
export function withNewStandaloneCard(model: BoardModel, card: Card): BoardModel {
  return { ...model, cards: [...model.cards, card].sort(byCreatedThenId) };
}

/**
 * i0028: immutably add a freshly created epic (empty, no cards yet) to the
 * model, keeping epics sorted by folder. A no-op if the folder already exists.
 */
export function withNewEpic(
  model: BoardModel,
  epic: Epic,
  folder: string,
): BoardModel {
  if (model.epics.some((group) => group.folder === folder)) return model;
  const epics = [...model.epics, { folder, epic, cards: [] }].sort((a, b) =>
    a.folder.localeCompare(b.folder),
  );
  return { ...model, epics };
}

/**
 * Immutably move a triaged card (matched by its old path) into an epic group,
 * keeping sort order. The card is stripped from the inbox, from standalone,
 * and from every epic group first, so this also handles re-triage between
 * epics (i0005) without leaving a duplicate behind.
 */
export function withCardTriaged(
  model: BoardModel,
  oldPath: string,
  moved: Card,
  targetFolder: string,
): BoardModel {
  const strippedCards = model.cards.filter((c) => c.path !== oldPath);
  const strippedEpics = model.epics.map((group) => ({
    ...group,
    cards: group.cards.filter((c) => c.path !== oldPath),
  }));
  // c0078: a card triaged to standalone (no epic) joins model.cards; otherwise
  // it joins its epic group (matched by folder name)
  if (moved.epic === null) {
    return {
      ...model,
      cards: [...strippedCards, moved].sort(byCreatedThenId),
      epics: strippedEpics,
    };
  }
  return {
    ...model,
    cards: strippedCards,
    epics: strippedEpics.map((group) =>
      group.folder === targetFolder
        ? { ...group, cards: [...group.cards, moved].sort(byCreatedThenId) }
        : group,
    ),
  };
}

/** Immutably drop a card (matched by path) from the board — c0062 delete. */
export function withoutCard(model: BoardModel, path: string): BoardModel {
  return {
    ...model,
    cards: model.cards.filter((c) => c.path !== path),
    epics: model.epics.map((group) => ({
      ...group,
      cards: group.cards.filter((c) => c.path !== path),
    })),
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
    cards: model.cards.map(replace),
    epics: model.epics.map((group) => ({
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
    ...model.cards.map((c) => c.id),
    ...model.epics.flatMap((g) => g.cards.map((c) => c.id)),
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

/** c0076: next free epic id in the `e` namespace (legacy `m` folders/ids
 *  count too, so the sequence never collides during migration). */
export function nextEpicId(model: BoardModel): string {
  const candidates = model.epics.flatMap((g) => [
    g.folder,
    ...(g.epic ? [g.epic.id] : []),
  ]);
  // "[me]" so both legacy `m` and new `e` ids feed the sequence
  const next = maxIdNumber(candidates, "[me]") + 1;
  return `e${String(next).padStart(2, "0")}`;
}
