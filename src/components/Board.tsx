import { Fragment, useEffect, useMemo, useState } from "react";
import {
  blockersFor,
  openDependencies,
  columnComparator,
  duplicateIdOf,
  findCardById,
  MANUAL_COLUMNS,
  planManualInsert,
  wipState,
  type Blocker,
  type BoardModel,
  type WipState,
} from "../lib/board";
import { collapseDuplicateFrontmatterKeys } from "../lib/cards";
import type { Card, InvalidFile } from "../lib/cards";
import { cardMatchesQuery } from "../lib/search";
import { cardActivity, activityClassName, activityTreatment } from "../lib/activity";
import { pickupCountdown } from "../lib/pickup";
import type { CompanionState } from "../lib/companion";
import { collectTags, readableTextColor, tagChipStyle, tagColor } from "../lib/tags";
import { firstImageSrc } from "../lib/assets";
import { AssetImage } from "./AssetImage";
import { startWindowDrag } from "../lib/window";
import "./Board.css";

// i0028: sentinel value for the epic filter's "+ New epic" action option
const NEW_EPIC_OPTION = "__new_epic__";

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
  const epicCards: BoardCard[] = model.epics.flatMap((group) =>
    group.cards.map((card) => ({
      card,
      epicLabel: group.epic?.title ?? group.folder,
      filterKey: group.folder,
      blockers: blockersFor(model, card),
      blocked: openDependencies(model, card).length > 0,
    })),
  );
  const standaloneCards: BoardCard[] = model.cards.map((card) => ({
    card,
    epicLabel: null,
    filterKey: "no-epic",
    blockers: blockersFor(model, card),
    blocked: openDependencies(model, card).length > 0,
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
  runner,
}: {
  model: BoardModel;
  /** c0109: companion state, for a running card's live activity line. Null when
   *  the companion isn't running → no line. */
  runner?: CompanionState | null;
  onMoveCard?: MoveCardHandler;
  /** i0028: create a new epic from the filter's "+ New epic" option. */
  onNewEpic?: () => void;
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
  /** c012: resolve a card's first image to a data URL for its thumbnail. */
  loadImage?: (card: Card, src: string) => Promise<string | null>;
  /** c016: a control rendered at the start of the toolbar (project menu). */
  toolbarLeading?: React.ReactNode;
  /** c0060: right-click on empty board background (not a card). */
  onBackgroundContextMenu?: (x: number, y: number) => void;
  onSelectCard?: (card: Card) => void;
  /** c0118: start a follow-up straight from a finished card's front. Absent →
   *  no trigger is rendered. */
  onFollowUpCard?: (card: Card) => void;
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

  const toggleTag = (tag: string) =>
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const columns = model.config.columns;
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

  // c0060: use longhands so .board-with-bg's cover/center/no-repeat (c047)
  // still apply — the `background` shorthand would reset them (image would
  // render at full resolution). url()/gradients are background-images.
  const backgroundStyle: React.CSSProperties | undefined = background
    ? background.startsWith("url(") || background.startsWith("linear-gradient(")
      ? { backgroundImage: background }
      : { backgroundColor: background }
    : undefined;

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
      style={backgroundStyle}
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
        {columns.map((column) => {
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
  wip,
}: {
  name: string;
  cards: BoardCard[];
  /** c008: WIP state for this column; null when no limit is configured. */
  wip: WipState | null;
  /** c0109: companion state, forwarded to each card front for its activity line. */
  runner?: CompanionState | null;
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
  onFollowUp?: (card: Card) => void;
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
        if (path) onDropCard(path);
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
        if (muted) return;
        event.preventDefault();
        // the column track behind would treat this as an unpositioned drop
        event.stopPropagation();
        setActive(false);
        const path = event.dataTransfer.getData(CARD_DRAG_TYPE);
        if (path) onDropAt(path, index);
      }}
    />
  );
}

function CardFront({
  entry,
  isOrigin,
  onMoveByKey,
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
}: {
  entry: BoardCard;
  /** c0109: companion state, for this card's live activity line (null → none). */
  runner?: CompanionState | null;
  /** True while this card is the one being dragged (i0004 origin marker). */
  isOrigin?: boolean;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
  onSelect?: (card: Card) => void;
  /** c0123: open a card named on a front (a blocker) by its id. */
  onOpenCardId?: (id: string) => void;
  /** c0118: start a follow-up from this card's front (review/done only). */
  onFollowUp?: (card: Card) => void;
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
  const { card, epicLabel, blockers, blocked } = entry;
  // c012: thumbnail from the first body image (if any)
  const thumbSrc = firstImageSrc(card.body);
  // c0109: a live one-liner of what the agent is doing, while a run is running.
  const activity = cardActivity(runner ?? null, card.id, Date.now());
  // c0117: before that, the grace period the companion is still waiting out.
  // Mutually exclusive with the activity line — a card cannot be both queued
  // for pickup and already running.
  const countdown = pickupCountdown(
    runner ?? null,
    card.id,
    card.statusChanged,
    Date.now(),
    blocked,
  );
  // c018: an archived card is shown for reference — moving it would leave it
  // in `archive/` with a live status, so it stays put until it is unarchived.
  const archived = card.archived;
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
          {/* c0118: queue more work without opening the card first. Gated to
              review/done like the detail-view action (c0115), and it opens the
              same draft — it never creates a card outright, so the note about
              landing in ready still gets its say before any agent starts. */}
          {onFollowUp && (card.status === "review" || card.status === "done") && (
            <button
              type="button"
              className={`card-followup${revealFollowUp ? " card-followup-visible" : ""}`}
              aria-label={`Follow up on ${card.id}`}
              title="Follow up — creates a task in ready, which a running companion starts on"
              onClick={(event) => {
                // the whole front is clickable; keep this from opening the card
                event.stopPropagation();
                onFollowUp(card);
              }}
            >
              +
            </button>
          )}
        </span>
      </div>
      <p className="card-title">{card.title}</p>
      {/* c0109: the running agent's latest action, phrased app-side. A stale
          state file (companion crashed/wedged) marks the line rather than
          hiding it, so it doesn't stay pinned as if current.
          c0113: a live line also sweeps — the treatment is picked in activity.ts,
          so this stays presentation-only. */}
      {activity && (
        <p
          className={activityClassName(activityTreatment(activity))}
          role="status"
          title={
            activity.stale
              ? "Companion may be stalled — its state file is over 30s old"
              : undefined
          }
        >
          {activity.label}
        </p>
      )}
      {/* c0117: the pickup grace period, counting down. Shares the activity
          line's look so the two live elements read as one system. */}
      {countdown !== null && (
        <p
          className="card-activity card-activity-pending"
          role="status"
          title="Drag the card out of this column to cancel"
        >
          picking up in {countdown}s
        </p>
      )}
      {/* c0123: why this card is going nowhere — the dependencies that are not
          done yet, each opening that card. A board fact, so it shows with no
          companion attached. Last of the three treatments of this line: a live
          activity line and the pickup countdown are more immediate, and blocked
          is back the moment neither is running. */}
      {activity === null && countdown === null && blockers.length > 0 && (
        <p
          className="card-activity card-activity-blocked"
          role="status"
          title="Blocked — these dependencies are not done"
        >
          waiting on{" "}
          {blockers.map((blocker, i) => (
            <Fragment key={blocker.id}>
              {i > 0 && ", "}
              {blocker.missing ? (
                <span className="card-blocked-missing" title="No card with this id">
                  {blocker.id} (missing)
                </span>
              ) : (
                <button
                  type="button"
                  className="card-blocked-link"
                  onClick={(event) => {
                    // the whole front opens this card — don't do both (c0118)
                    event.stopPropagation();
                    onOpenCardId?.(blocker.id);
                  }}
                >
                  {blocker.id}
                </button>
              )}
            </Fragment>
          ))}
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
      {/* c0086: epic → its title; standalone (incl. inbox status) → no meta row */}
      {epicLabel && (
        <div className="card-meta">
          <span className="card-milestone">{epicLabel}</span>
        </div>
      )}
    </article>
  );
}
