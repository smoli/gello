import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { edgeScrollDelta } from "../lib/autoscroll";
import {
  blockersFor,
  canFollowUp,
  openDependencies,
  columnComparator,
  duplicateIdOf,
  findCardById,
  hasFreeWipSlot,
  isStartable,
  nextSlotWaiter,
  nextStartable,
  MANUAL_COLUMNS,
  planManualInsert,
  signoffMoves,
  SIGNOFF_STATUS,
  visibleColumns,
  wipState,
  type Blocker,
  type BoardModel,
  type SignoffMove,
  type WipState,
} from "../lib/board";
import { latestReview, type ReviewEntry } from "../lib/review";
import { backgroundStyle } from "../lib/background";
import { collapseDuplicateFrontmatterKeys, formatCardUsage } from "../lib/cards";
import type { Card, InvalidFile } from "../lib/cards";
import { cardMatchesQuery } from "../lib/search";
import { waitingForSlot } from "../lib/pickup";
import { cardStatusLine } from "../lib/card-status";
import { CardStatusLine } from "./CardStatusLine";
import { hasLiveRun, type CompanionState } from "../lib/companion";
import { collectTags, readableTextColor, tagChipStyle, tagColor } from "../lib/tags";
import { firstImageSrc } from "../lib/assets";
import { AssetImage } from "./AssetImage";
import { startWindowDrag } from "../lib/window";
import "./Board.css";

// i0028: sentinel value for the epic filter's "+ New epic" action option
const NEW_EPIC_OPTION = "__new_epic__";

// i0123: drag auto-scroll — how deep the edge band is and its top speed per
// frame. 60px is roughly a card's height, so the band is reachable without
// overshooting; 16px/frame (~960px/s at 60fps) crosses a long column briskly.
const EDGE_SCROLL = { zone: 60, maxSpeed: 16 };

// c0059: drag the window from a pure-background surface — only when the
// element's own area is clicked (target === currentTarget), so cards,
// columns, and controls (children) are never turned into a drag handle.
function backgroundDrag(event: React.MouseEvent) {
  if (event.button === 0 && event.target === event.currentTarget) {
    void startWindowDrag();
  }
}

const CARD_DRAG_TYPE = "application/x-gello-card-path";

/** A card plus its display context on the board. */
interface BoardCard {
  card: Card;
  /** Epic title (or folder fallback); null = inbox or standalone. */
  epicLabel: string | null;
  /** Filter key: epic folder, "inbox", or "no-epic" (standalone, c0077). */
  filterKey: string;
  /** c0123: the unfinished dependencies holding this card back; empty when
   *  nothing is. Resolved here, where the whole model is on hand. */
  blockers: Blocker[];
  /** c0125: whether any dependency is still open, *regardless of status*. The
   *  companion's dispatch gate is not status-scoped the way `blockers` is (its
   *  trigger is configurable), so the pickup countdown asks this instead. */
  blocked: boolean;
  /** c0139: a backlog card whose dependencies have all cleared — the inverse of
   *  `blockers`, marked so you pick from the workable set. */
  startable: boolean;
  /** c0137: whether a WIP slot is open board-wide. When it is not, a queued
   *  ready card shows "waiting on a slot" rather than a countdown that cannot
   *  come. Board-wide (the companion runs board-wide), so the same on every card. */
  slotFree: boolean;
}

export type MoveCardHandler = (card: Card, status: string, order?: number) => void;
/** Same-column reposition in a manual column (c056). */
export type ReorderCardHandler = (card: Card, order: number) => void;
/** Bulk re-rank when a single write can't express the position (c056). */
export type RenumberHandler = (
  ranks: Array<{ card: Card; order: number }>,
) => void;

/**
 * c0088: every card lands in a status column by its `status` (inbox is just the
 * first column). A card is either standalone (`cards/`, no epic label) or
 * epic-grouped (labelled with its epic). There is no separate inbox lane.
 */
function collectStatusCards(model: BoardModel): BoardCard[] {
  const slotFree = hasFreeWipSlot(model);
  const epicCards: BoardCard[] = model.epics.flatMap((group) =>
    group.cards.map((card) => ({
      card,
      epicLabel: group.epic?.title ?? group.folder,
      filterKey: group.folder,
      blockers: blockersFor(model, card),
      blocked: openDependencies(model, card).length > 0,
      startable: isStartable(model, card),
      slotFree,
    })),
  );
  const standaloneCards: BoardCard[] = model.cards.map((card) => ({
    card,
    epicLabel: null,
    filterKey: "no-epic",
    blockers: blockersFor(model, card),
    blocked: openDependencies(model, card).length > 0,
    startable: isStartable(model, card),
    slotFree,
  }));
  return [...standaloneCards, ...epicCards];
}

export function Board({
  model,
  onMoveCard,
  onSelectCard,
  onFollowUpCard,
  onInboxStatusDrop,
  onReorderCard,
  onRenumber,
  onNewEpic,
  onOpenEpic,
  onRepairDuplicates,
  onRepairDuplicateId,
  onManageTags,
  background,
  darkChips = false,
  toolbarLeading,
  onBackgroundContextMenu,
  loadImage,
  query = "",
  showArchived = false,
  afk = false,
  runner,
  onRestartCard,
  onStopRun,
}: {
  model: BoardModel;
  /** c0109: companion state, for a running card's live activity line. Null when
   *  the companion isn't running → no line. */
  runner?: CompanionState | null;
  /** c0141: restart a stopped card — offered on a companion-owned, in-progress
   *  card with no live run. */
  onRestartCard?: (cardId: string) => void;
  /** c0147: stop the in-flight run for a card — offered on its front (revealed
   *  on hover) when the card has a live run. */
  onStopRun?: (cardId: string) => void;
  onMoveCard?: MoveCardHandler;
  /** i0028: create a new epic from the filter's "+ New epic" option. */
  onNewEpic?: () => void;
  /** c0084: open the detail view of the epic the filter is narrowed to. */
  onOpenEpic?: (folder: string) => void;
  /** i0034: repair a needs-attention card with duplicate frontmatter keys. */
  onRepairDuplicates?: (entry: InvalidFile) => void;
  /** c0132: repair a needs-attention card that shares another card's id, by
   *  reassigning it a fresh one. */
  onRepairDuplicateId?: (entry: InvalidFile) => void;
  /** c0058: open the tag management surface (colours + rename). */
  onManageTags?: () => void;
  /** c0066: fulltext filter, now owned by the top bar's search box. */
  query?: string;
  /** c018: also show archived cards (`archive/` folders), which are off the
   *  board otherwise. A search still reaches them either way. */
  showArchived?: boolean;
  /** i0175: AFK state (c0162). While it is on, the sign-off column renders even
   *  empty — that is the lane the review agent fills. */
  afk?: boolean;
  /** c012: resolve a card's first image to a data URL for its thumbnail. */
  loadImage?: (card: Card, src: string) => Promise<string | null>;
  /** c016: a control rendered at the start of the toolbar (project menu). */
  toolbarLeading?: React.ReactNode;
  /** c0060: right-click on empty board background (not a card). */
  onBackgroundContextMenu?: (x: number, y: number) => void;
  onSelectCard?: (card: Card) => void;
  /** c0118: start a follow-up straight from a finished card's front. Absent →
   *  no trigger is rendered. */
  onFollowUpCard?: (card: Card, type: string) => void;
  /**
   * i0005: a milestone-less inbox card was dropped on a triage column. The
   * host opens an inline milestone picker; `status` is the dropped-on column.
   * `order` is the chosen slot when it was a positioned insert-zone drop
   * (i0015), so the pick/dismiss can place the card there.
   */
  onInboxStatusDrop?: (card: Card, status: string, order?: number) => void;
  onReorderCard?: ReorderCardHandler;
  onRenumber?: RenumberHandler;
  /** Data URL of the board background (c047). */
  /** c0060: full CSS background value (url(...), #hex, or gradient). */
  background?: string;
  /** i0114: shade chip fills dark when the effective scheme is dark. */
  darkChips?: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  // c0058: multi-select tag filter — a card matches if it carries any selected
  // tag (empty selection matches all), AND-composed with the other filters.
  const [selectedTags, setSelectedTags] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // c0121: which card's follow-up trigger is revealed, as one board-level value
  // rather than a boolean per card. WKWebView drops the mouseleave when the
  // pointer exits a card upward (Chrome delivers both), which stranded a
  // per-card flag lit forever. One shared value means the *enter* on the next
  // card evicts the previous one on its own — the leave is a bonus, not a
  // requirement, and two cards can never be lit at once.
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Card | null>(null);
  // c0108: name of the column the pointer is over during a drag, for its
  // stronger highlight. Cleared when the drag ends (setDragState(null)).
  const [overColumn, setOverColumn] = useState<string | null>(null);

  // c0117: the pickup countdown ticks client-side once a second. The key is
  // built from the queue rather than the state object, which the 2s poll
  // replaces wholesale — depending on that would restart the interval every
  // poll and make the countdown stutter. With no companion, no delay or an
  // empty queue there is nothing to tick, so nothing re-renders.
  const pickupKey =
    runner && runner.pickupDelay > 0 ? runner.ready.join(",") : "";
  const [, setPickupTick] = useState(0);
  useEffect(() => {
    if (pickupKey === "") return;
    const id = setInterval(() => setPickupTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [pickupKey]);

  const setDragState = (card: Card | null) => {
    setDragging(card);
    if (!card) setOverColumn(null);
  };

  // i0123: while a card is being dragged, auto-scroll the column under the
  // pointer when it nears the top/bottom edge. HTML5 dnd delivers `dragover`
  // only while the pointer moves, so a rAF loop keeps scrolling from the last
  // pointer position when it holds still at the edge. The pointer coordinates
  // ride in a ref so recording them never triggers a re-render.
  const dragPointer = useRef({ x: 0, y: 0, seen: false });
  const isDragging = dragging !== null;
  useEffect(() => {
    if (!isDragging) return;
    dragPointer.current.seen = false;
    const onDragOver = (event: DragEvent) => {
      dragPointer.current = { x: event.clientX, y: event.clientY, seen: true };
    };
    window.addEventListener("dragover", onDragOver);
    let raf = requestAnimationFrame(function tick() {
      raf = requestAnimationFrame(tick);
      const { x, y, seen } = dragPointer.current;
      if (!seen) return;
      const under = document.elementFromPoint(x, y);
      const container = under?.closest<HTMLElement>(".column-cards");
      if (!container) return;
      const delta = edgeScrollDelta(container.getBoundingClientRect(), y, EDGE_SCROLL);
      if (delta !== 0) container.scrollTop += delta;
    });
    return () => {
      window.removeEventListener("dragover", onDragOver);
      cancelAnimationFrame(raf);
    };
  }, [isDragging]);

  /** c0123: a blocker named on a card front opens that card. */
  const openBlocker = (id: string) => {
    const target = findCardById(model, id);
    if (target) onSelectCard?.(target);
  };

  /** Leave only clears the reveal if this card still owns it — a late leave
   *  from the card we just left must not unlight the one now hovered. */
  const endHover = (path: string) =>
    setHoveredPath((current) => (current === path ? null : current));

  const statusCards = useMemo(() => collectStatusCards(model), [model]);
  const tagsInUse = useMemo(() => collectTags(model), [model]);
  const tagColors = model.config.tagColors;
  // c0111: a per-project setting hides every board tag surface at once.
  const showTags = model.config.showTags;
  // c0088: epic filter — "all", a specific epic folder, or "no-epic" (standalone)
  const byEpic =
    filter === "all"
      ? statusCards
      : statusCards.filter((c) => c.filterKey === filter);
  // c018: archived cards are off the board unless the toggle is on — but a
  // search still reaches them, so nothing is lost by archiving.
  const searching = query.trim() !== "";
  const visible = byEpic.filter(
    (c) =>
      (!c.card.archived || showArchived || searching) &&
      (typeFilter === "all" || c.card.type === typeFilter) &&
      (selectedTags.size === 0 ||
        c.card.tags.some((tag) => selectedTags.has(tag))) &&
      cardMatchesQuery(c.card, query),
  );

  // c0140: "Start next" advances the top startable backlog card (c0139) to
  // ready in one click. Scope is the active epic filter (byEpic), not the type/
  // tag/search filters — advance the frontier of the whole epic you are on.
  const startNextCard = useMemo(
    () => (onMoveCard ? nextStartable(model, byEpic.map((c) => c.card)) : null),
    [model, byEpic, onMoveCard],
  );
  const backlogInScope = byEpic.some((c) => c.card.status === "backlog");
  const startNextTitle = startNextCard
    ? `Start next: ${startNextCard.id} — ${startNextCard.title}`
    : backlogInScope
      ? "No backlog card is startable — every one still has an unfinished dependency"
      : "The backlog is empty";

  // c0143: the one queued ready card genuinely next when a slot frees keeps the
  // honest "waiting on a slot" line; the rest get a funny queue line. Computed
  // board-wide (the companion dispatches board-wide), from all cards the c0137
  // `waitingForSlot` marks, taking the first in dispatch order.
  const slotWaiterTopId = useMemo(() => {
    const now = Date.now();
    const waiters = statusCards
      .filter((c) => waitingForSlot(runner ?? null, c.card.id, now, c.blocked, c.slotFree))
      .map((c) => c.card);
    return nextSlotWaiter(waiters);
  }, [statusCards, runner]);

  const toggleTag = (tag: string) =>
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const columns = model.config.columns;
  // i0175: what gets a lane. Moves still step through the configured `columns`
  // — a card can be sent to sign-off whether or not the column is on screen,
  // and it appears the moment one lands there.
  const shownColumns = useMemo(() => visibleColumns(model, afk), [model, afk]);
  const allCards = statusCards;

  /**
   * c0090: a no-epic card leaving the inbox column prompts for an epic
   * (pick / No epic / New epic / cancel). A card that already has an epic, or
   * one moving *into* inbox, just changes status — no prompt.
   */
  const promptsForExit = (card: Card, column: string): boolean =>
    onInboxStatusDrop != null &&
    card.status === "inbox" &&
    column !== "inbox" &&
    card.epic === null;

  const dropOnColumn = (column: string, cardPath: string) => {
    const entry = allCards.find((c) => c.card.path === cardPath);
    if (!entry) return;
    if (promptsForExit(entry.card, column)) {
      onInboxStatusDrop?.(entry.card, column);
      return;
    }
    if (entry.card.status !== column) onMoveCard?.(entry.card, column);
  };

  /** Positioned drop on an insert zone of a manual column (c056). */
  const dropAtIndex = (
    column: string,
    columnEntries: BoardCard[],
    cardPath: string,
    zoneIndex: number,
  ) => {
    const entry = allCards.find((c) => c.card.path === cardPath);
    if (!entry) return;
    // plan against the column WITHOUT the dragged card; zones are rendered
    // around the full list, so slots below the card's own shift down by one
    const draggedAt = columnEntries.findIndex((c) => c.card.path === cardPath);
    const index = draggedAt !== -1 && zoneIndex > draggedAt ? zoneIndex - 1 : zoneIndex;
    const others = columnEntries
      .filter((c) => c.card.path !== cardPath)
      .map((c) => c.card);
    const plan = planManualInsert(others, index);
    if (plan.renumber && plan.renumber.length > 0) onRenumber?.(plan.renumber);
    // i0005/i0015: a milestone-less inbox card still needs a milestone — open
    // the picker, but carry the chosen slot (order) so the pick/dismiss lands
    // the card exactly where it was dropped, not at the bottom.
    if (promptsForExit(entry.card, column)) {
      onInboxStatusDrop?.(entry.card, column, plan.order);
      return;
    }
    if (entry.card.status !== column) onMoveCard?.(entry.card, column, plan.order);
    else onReorderCard?.(entry.card, plan.order);
  };

  // c0170: the sign-off column is the human's check-list, so clearing it is one
  // click per card — accept the AI review (→ done) or send the work back
  // (→ in-progress). Both go through onMoveCard, like a drag; a board without
  // one of those columns is not offered that move.
  const checklistMoves = useMemo(
    () => (onMoveCard ? signoffMoves(columns) : []),
    [onMoveCard, columns],
  );

  const moveByKey = (card: Card, direction: -1 | 1) => {
    const target = columns[columns.indexOf(card.status) + direction];
    if (target) onMoveCard?.(card, target);
  };

  // c0060: right-click on a pure-background surface (its own area, not a card)
  const bgContext = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && onBackgroundContextMenu) {
      event.preventDefault();
      onBackgroundContextMenu(event.clientX, event.clientY);
    }
  };

  const boardClasses = [
    "board",
    background ? "board-with-bg" : "",
    dragging ? "board-dragging" : "", // c054: drop lanes render feedback
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={boardClasses}
      onMouseDown={backgroundDrag}
      onContextMenu={bgContext}
      style={backgroundStyle(background)}
    >
      <header className="board-toolbar" onMouseDown={backgroundDrag}>
        <div className="toolbar-filters">
          {toolbarLeading}
          <select
            aria-label="Epic filter"
            value={filter}
            onChange={(event) => {
              // i0028: "+ New epic" is an action, not a filter value — trigger
              // creation and leave the current filter unchanged
              if (event.target.value === NEW_EPIC_OPTION) {
                onNewEpic?.();
                return;
              }
              setFilter(event.target.value);
            }}
          >
            <option value="all">All epics</option>
            {model.epics.map((group) => (
              <option key={group.folder} value={group.folder}>
                {group.epic?.title ?? group.folder}
              </option>
            ))}
            {model.cards.length > 0 && <option value="no-epic">No epic</option>}
            {onNewEpic && <option value={NEW_EPIC_OPTION}>+ New epic…</option>}
          </select>
          {/* c0084: with one epic in focus, its detail (goal, definition of
              done, card rollup) is one click away. */}
          {onOpenEpic && model.epics.some((group) => group.folder === filter) && (
            <button
              type="button"
              className="toolbar-open-epic"
              aria-label="Open epic"
              title="Epic goal, definition of done and cards"
              onClick={() => onOpenEpic(filter)}
            >
              ⓘ
            </button>
          )}
          <select
            aria-label="Type filter"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            {model.config.types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {/* c0140: advance the top startable backlog card to ready in one
              click; disabled with the reason in its tooltip when none is. */}
          {onMoveCard && (
            <button
              type="button"
              className="start-next-button"
              disabled={startNextCard === null}
              title={startNextTitle}
              onClick={() => startNextCard && onMoveCard(startNextCard, "ready")}
            >
              Start next
            </button>
          )}
          {showTags && tagsInUse.length > 0 && (
            <div className="tag-filter" role="group" aria-label="Tag filter">
              {tagsInUse.map(({ tag }) => {
                const colour = tagColor(tag, tagColors);
                const selected = selectedTags.has(tag);
                // i0113: unselected is the shared resting chip look; i0110:
                // selected overrides the fill with the full tag colour, still
                // opaque so the label stays legible over any board background.
                const style = selected
                  ? { backgroundColor: colour, borderColor: colour, color: readableTextColor(colour) }
                  : tagChipStyle(colour, darkChips);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={selected ? "tag-chip tag-chip-on" : "tag-chip"}
                    aria-pressed={selected}
                    style={style}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
          {onManageTags && showTags && tagsInUse.length > 0 && (
            <button
              type="button"
              className="tag-manage-button"
              onClick={onManageTags}
            >
              Manage tags…
            </button>
          )}
        </div>
      </header>
      <div
        className="board-columns"
        onMouseDown={backgroundDrag}
        onContextMenu={bgContext}
      >
        {shownColumns.map((column) => {
          const entries = visible
            .filter((c) => c.card.status === column)
            // c056: per-column rules (global across milestones, c046) —
            // capture order, manual ranks, or status-changed time
            .sort((a, b) => columnComparator(column)(a.card, b.card));
          return (
            <Column
              key={column}
              name={column}
              cards={entries}
              wip={wipState(model.config, column, entries.length)}
              draggingPath={dragging?.path ?? null}
              isOver={dragging != null && overColumn === column}
              onOver={() => setOverColumn(column)}
              showInsertZones={MANUAL_COLUMNS.has(column)}
              onDropCard={(path) => dropOnColumn(column, path)}
              onDropAt={(path, zoneIndex) =>
                dropAtIndex(column, entries, path, zoneIndex)
              }
              onMoveByKey={moveByKey}
              onMoveTo={onMoveCard}
              signoffMoves={checklistMoves}
              onSelect={onSelectCard}
              onOpenCardId={openBlocker}
              onFollowUp={onFollowUpCard}
              hoveredPath={hoveredPath}
              onHover={setHoveredPath}
              onHoverEnd={endHover}
              onDragState={setDragState}
              onBgContextMenu={bgContext}
              loadImage={loadImage}
              tagColors={tagColors}
              showTags={showTags}
              darkChips={darkChips}
              runner={runner}
              slotWaiterTopId={slotWaiterTopId}
              onRestartCard={onRestartCard}
              onStopRun={onStopRun}
            />
          );
        })}
      </div>
      {model.invalid.length > 0 && (
        <NeedsAttentionLane
          entries={model.invalid}
          onRepairDuplicates={onRepairDuplicates}
          onRepairDuplicateId={onRepairDuplicateId}
        />
      )}
    </div>
  );
}

function NeedsAttentionLane({
  entries,
  onRepairDuplicates,
  onRepairDuplicateId,
}: {
  entries: InvalidFile[];
  onRepairDuplicates?: (entry: InvalidFile) => void;
  onRepairDuplicateId?: (entry: InvalidFile) => void;
}) {
  return (
    <section className="needs-attention" aria-label="needs attention">
      <div className="column-header">
        <h2>needs attention</h2>
        <span className="column-count">{entries.length}</span>
      </div>
      <div className="needs-attention-entries">
        {entries.map((entry) => (
          <InvalidFileEntry
            key={entry.path}
            entry={entry}
            onRepairDuplicates={onRepairDuplicates}
            onRepairDuplicateId={onRepairDuplicateId}
          />
        ))}
      </div>
    </section>
  );
}

function InvalidFileEntry({
  entry,
  onRepairDuplicates,
  onRepairDuplicateId,
}: {
  entry: InvalidFile;
  onRepairDuplicates?: (entry: InvalidFile) => void;
  onRepairDuplicateId?: (entry: InvalidFile) => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  // i0034: offer a one-click repair only when the file has collapsible
  // duplicate frontmatter keys (the "Map keys must be unique" case)
  const canRepair =
    onRepairDuplicates != null && collapseDuplicateFrontmatterKeys(entry.raw) !== null;
  // c0132: offer the id repair only on a duplicate-id entry (the two repair
  // cases are mutually exclusive — a dup-id file is otherwise valid YAML)
  const canRepairId = onRepairDuplicateId != null && duplicateIdOf(entry) !== null;
  return (
    <article className="invalid-entry">
      <div className="invalid-entry-header">
        <div>
          <p className="invalid-path">{entry.path}</p>
          <p className="invalid-reason">{entry.reason}</p>
        </div>
        <div className="invalid-entry-actions">
          {canRepair && (
            <button type="button" onClick={() => onRepairDuplicates?.(entry)}>
              Fix duplicate keys
            </button>
          )}
          {canRepairId && (
            <button type="button" onClick={() => onRepairDuplicateId?.(entry)}>
              Fix duplicate id
            </button>
          )}
          <button type="button" onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? "hide file" : "show file"}
          </button>
        </div>
      </div>
      {showRaw && <pre className="invalid-raw">{entry.raw}</pre>}
    </article>
  );
}

function Column({
  name,
  cards,
  draggingPath,
  isOver,
  onOver,
  showInsertZones,
  onDropCard,
  onDropAt,
  onMoveByKey,
  onMoveTo,
  signoffMoves,
  onSelect,
  onOpenCardId,
  onFollowUp,
  hoveredPath,
  onHover,
  onHoverEnd,
  onDragState,
  onBgContextMenu,
  loadImage,
  tagColors,
  showTags,
  darkChips,
  runner,
  slotWaiterTopId,
  onRestartCard,
  onStopRun,
  wip,
}: {
  name: string;
  cards: BoardCard[];
  /** c0170: the sign-off check-list's one-click moves, for signoff card fronts. */
  signoffMoves: SignoffMove[];
  /** c0170: move a card to a named column, as a drag would. */
  onMoveTo?: MoveCardHandler;
  /** c008: WIP state for this column; null when no limit is configured. */
  wip: WipState | null;
  /** c0109: companion state, forwarded to each card front for its activity line. */
  runner?: CompanionState | null;
  /** c0141: restart a stopped card, forwarded to each card front. */
  onRestartCard?: (cardId: string) => void;
  /** c0147: stop a card's live run, forwarded to each card front. */
  onStopRun?: (cardId: string) => void;
  /** c0143: id of the queued card next when a slot frees — it keeps the honest
   *  "waiting on a slot"; the rest get a funny queue line. */
  slotWaiterTopId?: string | null;
  /** c012: passed through to each card front for its thumbnail. */
  loadImage?: (card: Card, src: string) => Promise<string | null>;
  /** c0058: per-tag colour overrides, forwarded to each card front's chips. */
  tagColors: Record<string, string>;
  /** c0111: render card-front tag chips only when tag surfacing is on. */
  showTags: boolean;
  /** i0114: shade chip fills dark in dark mode, forwarded to each card front. */
  darkChips: boolean;
  /** Path of the card currently being dragged, for origin marking (i0004). */
  draggingPath: string | null;
  /** c0108: the pointer is over this column during a drag — stronger highlight. */
  isOver: boolean;
  /** c0108: the pointer entered this column's track during a drag. */
  onOver: () => void;
  /** c056: render positioned drop targets (manual columns during a drag). */
  /** c056: render positioned drop targets for manual columns. Always mounted
   *  (i0003) — inert until a drag; appearance driven by the board-dragging
   *  class, never by mounting/unmounting (which aborts WKWebView drags). */
  showInsertZones: boolean;
  onDropCard: (cardPath: string) => void;
  onDropAt: (cardPath: string, zoneIndex: number) => void;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
  onSelect?: (card: Card) => void;
  /** c0123: open a card named on a front (a blocker) by its id. */
  onOpenCardId?: (id: string) => void;
  /** c0118: forwarded to each card front's follow-up trigger. */
  onFollowUp?: (card: Card, type: string) => void;
  /** c0121: path of the one card whose trigger is revealed, board-wide. */
  hoveredPath: string | null;
  onHover: (path: string) => void;
  onHoverEnd: (path: string) => void;
  onDragState: (card: Card | null) => void;
  /** c0060: right-click on the track's own (background) area. */
  onBgContextMenu?: (event: React.MouseEvent) => void;
}) {
  const dropAt = (path: string, zoneIndex: number) => {
    onDropAt(path, zoneIndex);
    onDragState(null);
  };
  // zones flanking the dragged card (index and index+1) don't change its
  // position — mute them (i0006)
  const originIdx = cards.findIndex((e) => e.card.path === draggingPath);
  const isOriginAdjacent = (zoneIndex: number) =>
    originIdx !== -1 && (zoneIndex === originIdx || zoneIndex === originIdx + 1);
  return (
    // c052: the invisible full-height track is the drop target, so short
    // content-height columns (c049) still catch drops anywhere in the lane
    <div
      className={isOver ? "column-track column-track-over" : "column-track"}
      onMouseDown={backgroundDrag}
      onContextMenu={onBgContextMenu}
      onDragOver={(event) => {
        event.preventDefault();
        // c0108: dragover fires on whichever track is under the pointer, so
        // setting the over-column here keeps a single column highlighted and
        // moves it as the pointer crosses lanes.
        onOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const path = event.dataTransfer.getData(CARD_DRAG_TYPE);
        if (path) {
          // c0149: a drop in the empty ghost area of a manual column (below the
          // last card) means "put it at the bottom" — route it to the trailing
          // insert position, like the last insert zone. A bare status change
          // would leave a same-column ghost drop doing nothing at all. Other
          // columns keep the plain status move.
          if (showInsertZones) onDropAt(path, cards.length);
          else onDropCard(path);
        }
        onDragState(null);
      }}
    >
      <section className="column" aria-label={name}>
        <div className="column-header">
          <h2>{name}</h2>
          {/* c008: a configured WIP limit turns the count into count/limit and
              flags an overrun; unlimited columns keep the plain count. */}
          <span
            className={wip?.over ? "column-count column-count-over" : "column-count"}
            title={
              wip
                ? wip.over
                  ? `Over the WIP limit — ${wip.count} of ${wip.limit}`
                  : `WIP limit ${wip.count} of ${wip.limit}`
                : undefined
            }
          >
            {wip ? `${wip.count}/${wip.limit}` : cards.length}
          </span>
        </div>
        <div className="column-cards">
          {cards.map((entry, i) => (
            <Fragment key={entry.card.path}>
              {showInsertZones && (
                // i0006: the zones just above and below the dragged card are
                // no-op positions — mute them (kept mounted so dragstart never
                // unmounts a node next to the source, which aborts WebKit drags)
                <InsertZone index={i} muted={isOriginAdjacent(i)} onDropAt={dropAt} />
              )}
              <CardFront
                entry={entry}
                isOrigin={draggingPath === entry.card.path}
                onMoveByKey={onMoveByKey}
                onMoveTo={onMoveTo}
                signoffMoves={signoffMoves}
                onSelect={onSelect}
                onOpenCardId={onOpenCardId}
                onFollowUp={onFollowUp}
                revealFollowUp={hoveredPath === entry.card.path}
                onHover={onHover}
                onHoverEnd={onHoverEnd}
                onDragState={onDragState}
                loadImage={loadImage}
                tagColors={tagColors}
                showTags={showTags}
                darkChips={darkChips}
                runner={runner}
                slotWaiterTopId={slotWaiterTopId}
                onRestartCard={onRestartCard}
                onStopRun={onStopRun}
              />
            </Fragment>
          ))}
          {showInsertZones && (
            <InsertZone
              index={cards.length}
              muted={isOriginAdjacent(cards.length)}
              onDropAt={dropAt}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Positioned drop target between cards (c056). A plain element, not a
 * geometry computation, so drops are exact on any layout — the active
 * class renders the insertion indicator.
 */
function InsertZone({
  index,
  muted,
  onDropAt,
}: {
  index: number;
  /** i0006: no-op position (flanks the dragged card) — inert, no indicator. */
  muted?: boolean;
  onDropAt: (cardPath: string, zoneIndex: number) => void;
}) {
  const [active, setActive] = useState(false);
  const className = [
    "insert-zone",
    active && !muted ? "insert-zone-active" : "",
    muted ? "insert-zone-muted" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={className}
      aria-label={`insert at ${index}`}
      onDragOver={(event) => {
        if (muted) return;
        event.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(event) => {
        // i0139: a muted zone flanks the dragged card — dropping there means
        // "leave it where it was", a no-op. Still swallow the event, or it
        // bubbles to the track and c0149 sends the card to the bottom.
        event.preventDefault();
        event.stopPropagation();
        setActive(false);
        if (muted) return;
        const path = event.dataTransfer.getData(CARD_DRAG_TYPE);
        if (path) onDropAt(path, index);
      }}
    />
  );
}

/** c0170: the recorded verdict as a card front reads it — the outcome, plus
 *  when it was decided and what was checked in the tooltip. */
function reviewTitle(review: ReviewEntry): string {
  const verdict = review.verdict === "pass" ? "AI review passed" : "AI review failed";
  const head = review.stamp === "" ? verdict : `${verdict} ${review.stamp}`;
  return review.notes === "" ? head : `${head}\n\n${review.notes}`;
}

function CardFront({
  entry,
  isOrigin,
  onMoveByKey,
  onMoveTo,
  signoffMoves,
  onSelect,
  onOpenCardId,
  onFollowUp,
  revealFollowUp,
  onHover,
  onHoverEnd,
  onDragState,
  loadImage,
  tagColors,
  showTags,
  darkChips,
  runner,
  slotWaiterTopId,
  onRestartCard,
  onStopRun,
}: {
  entry: BoardCard;
  /** c0109: companion state, for this card's live activity line (null → none). */
  runner?: CompanionState | null;
  /** c0143: id of the card next when a slot frees — it keeps the honest line. */
  slotWaiterTopId?: string | null;
  /** c0141: restart a stopped card (companion-owned, in-progress, no live run). */
  onRestartCard?: (cardId: string) => void;
  /** c0147: stop the card's in-flight run — shown on the front when it has a
   *  live run, revealed on hover. */
  onStopRun?: (cardId: string) => void;
  /** True while this card is the one being dragged (i0004 origin marker). */
  isOrigin?: boolean;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
  /** c0170: the sign-off actions this board offers (empty → none). */
  signoffMoves: SignoffMove[];
  /** c0170: take one of them — an ordinary status move. */
  onMoveTo?: MoveCardHandler;
  onSelect?: (card: Card) => void;
  /** c0123: open a card named on a front (a blocker) by its id. */
  onOpenCardId?: (id: string) => void;
  /** c0118: start a follow-up from this card's front (review/done only). */
  onFollowUp?: (card: Card, type: string) => void;
  /** c0121: this card owns the board's single follow-up reveal. */
  revealFollowUp: boolean;
  onHover: (path: string) => void;
  onHoverEnd: (path: string) => void;
  onDragState: (card: Card | null) => void;
  /** c012: resolve this card's first image to a data URL for the thumbnail. */
  loadImage?: (card: Card, src: string) => Promise<string | null>;
  /** c0058: per-tag colour overrides for the chips. */
  tagColors: Record<string, string>;
  /** c0111: hide the chips when tag surfacing is off for the project. */
  showTags: boolean;
  /** i0114: shade the chip fills dark in dark mode. */
  darkChips: boolean;
}) {
  const { card, epicLabel, blockers, blocked, startable, slotFree } = entry;
  // c012: thumbnail from the first body image (if any)
  const thumbSrc = firstImageSrc(card.body);
  // c0150: the card's cumulative companion cost (null → never run, no figure).
  const usageLabel = formatCardUsage(card.usageTokens, card.usageCost);
  // c0148: the card's live status line — activity / countdown / waiting-on-a-
  // slot / stopped / blocked / startable — resolved once, so the card detail
  // shows the same line (CardStatusLine) and the two can't drift.
  const statusLine = cardStatusLine(
    runner ?? null,
    card,
    { blocked, slotFree, slotWaiterTopId: slotWaiterTopId ?? null, blockers, startable },
    Date.now(),
  );
  // c0147: a card with a live run can be stopped from its front.
  const liveRun = hasLiveRun(runner ?? null, card.id);
  // c018: an archived card is shown for reference — moving it would leave it
  // in `archive/` with a live status, so it stays put until it is unarchived.
  const archived = card.archived;
  // c0170: the verdict an AI review agent recorded on the card (c0166). Shown
  // wherever it exists — it is what a card in the sign-off column is waiting on,
  // and a failed round explains a card that came back.
  const review = latestReview(card.body);
  // c0170: the check-list actions, on the cards that are actually waiting.
  const checklist =
    card.status === SIGNOFF_STATUS && !archived && onMoveTo ? signoffMoves : [];
  const className = [
    "card-front",
    isOrigin ? "card-origin" : "",
    archived ? "card-archived" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <article
      className={className}
      draggable={!archived}
      tabIndex={0}
      aria-label={`${card.id}: ${card.title}`}
      onClick={() => onSelect?.(card)}
      onMouseEnter={() => onHover(card.path)}
      onMouseLeave={() => onHoverEnd(card.path)}
      onDragStart={(event) => {
        event.dataTransfer.setData(CARD_DRAG_TYPE, card.path);
        event.dataTransfer.effectAllowed = "move";
        // the card leaves the pointer without a mouseleave once it's dragging
        onHoverEnd(card.path);
        onDragState(card);
      }}
      onDragEnd={() => onDragState(null)}
      onDrop={
        // i0139: dropping a card back on its own (dimmed) origin means "leave it
        // where it was" — swallow it so it doesn't bubble to the track, which
        // c0149 would treat as a bottom-insert. Non-origin cards fall through.
        isOrigin
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
          : undefined
      }
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" && !archived) onMoveByKey(card, 1);
        if (event.key === "ArrowLeft" && !archived) onMoveByKey(card, -1);
        if (event.key === "Enter") onSelect?.(card);
      }}
    >
      <div className="card-meta">
        <span className="card-id">{card.id}</span>
        <span className="card-meta-badges">
          {/* c018: shown only when archived cards are on the board (toggle or
              search), so the front says why this one is here. */}
          {archived && <span className="card-archived-badge">archived</span>}
          {/* c0100: parked on a companion Q&A — read from the card's own
              `awaiting: input` marker, so it shows even when the companion
              process isn't running (title-bar aggregate reads the state file). */}
          {card.awaiting === "input" && (
            <span
              className="card-needs-input"
              role="status"
              aria-label="Needs input"
              title="Needs input — an open question is waiting for your answer"
            >
              ?
            </span>
          )}
          {card.type !== "task" && (
            <span className={`card-type type-${card.type}`}>{card.type}</span>
          )}
          {/* c0147: stop this card's in-flight run from the front, revealed on
              hover with the same mechanic as the follow-up trigger (the CSS
              `.card-front:hover` reveal, plus c0121's `revealFollowUp` so the
              WKWebView-safe pointer tracking keeps it in sync). */}
          {onStopRun && liveRun && (
            <button
              type="button"
              className={`card-stop${revealFollowUp ? " card-stop-revealed" : ""}`}
              aria-label={`Stop run ${card.id}`}
              title="Stop this run"
              onClick={(event) => {
                // the whole front is clickable; keep this from opening the card
                event.stopPropagation();
                onStopRun(card.id);
              }}
            >
              ✕
            </button>
          )}
          {/* c0118: queue more work without opening the card first. Gated to
              the finished-work statuses like the detail-view action (c0115),
              and it opens the same draft — it never creates a card outright, so
              the note about landing in ready still gets its say before any
              agent starts. */}
          {onFollowUp && canFollowUp(card.status) && (
            <span className="card-meta-badges-followups">
              {/* i0130: the two kinds read as "i" and "c" on screen, so the
                  label has to name the kind — otherwise both buttons announce
                  the same thing. */}
              <button
                type="button"
                className={`card-followup${revealFollowUp ? " card-followup-visible" : ""}`}
                aria-label={`Follow up on ${card.id} with an issue`}
                // c0131: the landing column is configurable, so the draft states
                // it; the tooltip stays generic rather than naming a column.
                title="Follow up — create an issue from this finished card"
                onClick={(event) => {
                  // the whole front is clickable; keep this from opening the card
                  event.stopPropagation();
                  onFollowUp(card, "i");
                }}
              >
                i
              </button>
              <button
                type="button"
                className={`card-followup${revealFollowUp ? " card-followup-visible" : ""}`}
                aria-label={`Follow up on ${card.id} with a task`}
                title="Follow up — create a task from this finished card"
                onClick={(event) => {
                  event.stopPropagation();
                  onFollowUp(card, "c");
                }}
              >
                c
              </button>
            </span>
          )}
        </span>
      </div>
      <p className="card-title">{card.title}</p>
      {/* c0148: the live status line (activity / countdown / waiting-on-a-slot /
          stopped / blocked / startable), resolved in card-status.ts. On the
          front it carries the interactive Restart button and blocked-dep links;
          the card detail renders the same line read-only. */}
      <CardStatusLine
        line={statusLine}
        onRestart={
          statusLine?.kind === "stopped" && onRestartCard
            ? () => onRestartCard(card.id)
            : undefined
        }
        onOpenBlocker={onOpenCardId}
      />
      {/* c0170: the recorded review verdict — what a card in the sign-off
          column is waiting on. The reasons are in the tooltip and, in full, in
          the card's own `## Review` section. */}
      {review && (
        <p className={`card-review card-review-${review.verdict}`} title={reviewTitle(review)}>
          {review.verdict === "pass" ? "✓ AI review passed" : "✗ AI review failed"}
        </p>
      )}
      {thumbSrc && loadImage && (
        <AssetImage
          src={thumbSrc}
          alt=""
          loadImage={(src) => loadImage(card, src)}
          className="card-thumb"
        />
      )}
      {/* c0058: the card's tags as coloured chips, in the card's own order.
          c0111: suppressed when the project turns tag surfacing off. */}
      {showTags && card.tags.length > 0 && (
        <div className="card-tags">
          {card.tags.map((tag) => (
            // i0113: the shared resting chip look, identical across every surface
            <span key={tag} className="tag-chip" style={tagChipStyle(tagColor(tag, tagColors), darkChips)}>
              {tag}
            </span>
          ))}
        </div>
      )}
      {/* c0170: clear the check-list one card at a time — accept the review, or
          send the work back. Always shown (not hover-revealed): on the sign-off
          column they are the point of the card, not an extra. */}
      {checklist.length > 0 && (
        <div className="card-signoff-actions" role="group" aria-label={`Sign-off ${card.id}`}>
          {checklist.map((move) => (
            <button
              key={move.status}
              type="button"
              className={`card-signoff-action card-signoff-${move.status}`}
              aria-label={`${move.label} ${card.id}`}
              title={move.title}
              onClick={(event) => {
                // the whole front is clickable; keep this from opening the card
                event.stopPropagation();
                onMoveTo?.(card, move.status);
              }}
            >
              {move.label}
            </button>
          ))}
        </div>
      )}
      {/* c0086: epic → its title; standalone (incl. inbox status) → no meta row.
          c0150: the cumulative companion cost rides the same foot row (right),
          or renders its own row when the card has no epic. */}
      {(epicLabel || usageLabel) && (
        <div className="card-meta card-meta-foot">
          {epicLabel ? (
            <span className="card-milestone">{epicLabel}</span>
          ) : (
            <span />
          )}
          {usageLabel && (
            <span
              className="card-usage"
              title={`Companion usage (lifetime): ${(card.usageTokens ?? 0).toLocaleString()} tokens, $${card.usageCost ?? 0} estimated cost`}
            >
              {usageLabel}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
