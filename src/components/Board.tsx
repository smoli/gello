import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  columnComparator,
  MANUAL_COLUMNS,
  planManualInsert,
  type BoardModel,
} from "../lib/board";
import type { Card, InvalidFile } from "../lib/cards";
import { cardMatchesQuery } from "../lib/search";
import { startWindowDrag } from "../lib/window";
import "./Board.css";

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
  /** Milestone title (or folder as fallback); null = inbox. */
  milestoneLabel: string | null;
  /** Filter key: milestone folder. */
  filterKey: string;
}

export type MoveCardHandler = (card: Card, status: string, order?: number) => void;
/** Same-column reposition in a manual column (c056). */
export type ReorderCardHandler = (card: Card, order: number) => void;
/** Bulk re-rank when a single write can't express the position (c056). */
export type RenumberHandler = (
  ranks: Array<{ card: Card; order: number }>,
) => void;

/**
 * Cards that live in the status columns: all milestone cards, plus inbox
 * cards whose status is not backlog (c030 — e.g. flagged for discussion
 * before any milestone is assigned). Backlog inbox cards stay in the inbox
 * column: it means "unprocessed ideas", precisely.
 */
function collectStatusCards(model: BoardModel): BoardCard[] {
  const flaggedInbox: BoardCard[] = model.inbox
    .filter((card) => card.status !== "backlog")
    .map((card) => ({ card, milestoneLabel: null, filterKey: "inbox" }));
  const milestoneCards: BoardCard[] = model.milestones.flatMap((group) =>
    group.cards.map((card) => ({
      card,
      milestoneLabel: group.milestone?.title ?? group.folder,
      filterKey: group.folder,
    })),
  );
  return [...flaggedInbox, ...milestoneCards];
}

/**
 * i0005: columns that are real inbox-triage destinations. Dropping a
 * milestone-less inbox card here prompts for a milestone (status comes from
 * the column); in-progress/review/done aren't where raw ideas land, so they
 * move without prompting.
 */
const TRIAGE_DROP_COLUMNS = new Set(["discuss", "backlog", "ready"]);

export function Board({
  model,
  onMoveCard,
  onSelectCard,
  onInboxStatusDrop,
  onReorderCard,
  onRenumber,
  background,
  toolbarLeading,
  onBackgroundContextMenu,
}: {
  model: BoardModel;
  onMoveCard?: MoveCardHandler;
  /** c016: a control rendered at the start of the toolbar (project menu). */
  toolbarLeading?: React.ReactNode;
  /** c0060: right-click on empty board background (not a card). */
  onBackgroundContextMenu?: (x: number, y: number) => void;
  onSelectCard?: (card: Card) => void;
  /**
   * i0005: a milestone-less inbox card was dropped on a triage column. The
   * host opens an inline milestone picker; the status is the dropped-on
   * column.
   */
  onInboxStatusDrop?: (card: Card, status: string) => void;
  onReorderCard?: ReorderCardHandler;
  onRenumber?: RenumberHandler;
  /** Data URL of the board background (c047). */
  /** c0060: full CSS background value (url(...), #hex, or gradient). */
  background?: string;
}) {
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<Card | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // c022: Cmd/Ctrl+F focuses search, suppressing the webview's native find
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const statusCards = useMemo(() => collectStatusCards(model), [model]);
  const inboxUnprocessed = useMemo(
    () =>
      model.inbox.filter(
        (card) =>
          card.status === "backlog" &&
          (typeFilter === "all" || card.type === typeFilter) &&
          cardMatchesQuery(card, query),
      ),
    [model, typeFilter, query],
  );
  const byMilestone =
    filter === "all"
      ? statusCards
      : statusCards.filter((c) => c.filterKey === filter || c.filterKey === "inbox");
  const visible = byMilestone.filter(
    (c) =>
      (typeFilter === "all" || c.card.type === typeFilter) &&
      cardMatchesQuery(c.card, query),
  );

  const columns = model.config.columns;

  const allCards = useMemo(
    () => [
      ...statusCards,
      ...inboxUnprocessed.map((card) => ({
        card,
        milestoneLabel: null,
        filterKey: "inbox",
      })),
    ],
    [statusCards, inboxUnprocessed],
  );

  /**
   * i0005: a milestone-less inbox card dropped on a triage column should
   * prompt for a milestone rather than move silently. Only when a picker
   * host is wired and the board actually has milestones to offer.
   */
  const promptsForMilestone = (card: Card, column: string): boolean =>
    onInboxStatusDrop != null &&
    card.path.startsWith("inbox/") &&
    card.milestone === null &&
    TRIAGE_DROP_COLUMNS.has(column) &&
    model.milestones.some((g) => g.milestone !== null);

  const dropOnColumn = (column: string, cardPath: string) => {
    const entry = allCards.find((c) => c.card.path === cardPath);
    if (!entry || entry.card.status === column) return;
    if (promptsForMilestone(entry.card, column)) {
      onInboxStatusDrop?.(entry.card, column);
      return;
    }
    onMoveCard?.(entry.card, column);
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
    // i0005: a milestone-less inbox card lands via the picker, not a ranked
    // insert — the milestone move relocates it anyway
    if (entry.card.status !== column && promptsForMilestone(entry.card, column)) {
      onInboxStatusDrop?.(entry.card, column);
      return;
    }
    // plan against the column WITHOUT the dragged card; zones are rendered
    // around the full list, so slots below the card's own shift down by one
    const draggedAt = columnEntries.findIndex((c) => c.card.path === cardPath);
    const index = draggedAt !== -1 && zoneIndex > draggedAt ? zoneIndex - 1 : zoneIndex;
    const others = columnEntries
      .filter((c) => c.card.path !== cardPath)
      .map((c) => c.card);
    const plan = planManualInsert(others, index);
    if (plan.renumber && plan.renumber.length > 0) onRenumber?.(plan.renumber);
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
            aria-label="Milestone filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All milestones</option>
            {model.milestones.map((group) => (
              <option key={group.folder} value={group.folder}>
                {group.milestone?.title ?? group.folder}
              </option>
            ))}
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
        </div>
        <input
          ref={searchRef}
          type="search"
          className="board-search"
          aria-label="Search cards"
          placeholder="Search…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
        />
        {/* symmetry cell so the search sits at the true center */}
        <div className="toolbar-spacer" aria-hidden="true" />
      </header>
      <div
        className="board-columns"
        onMouseDown={backgroundDrag}
        onContextMenu={bgContext}
      >
        {inboxUnprocessed.length > 0 && (
          <div
            className="column-track column-track-inbox"
            onContextMenu={bgContext}
          >
            <section className="column column-inbox" aria-label="inbox">
            <div className="column-header">
              <h2>inbox</h2>
              <span className="column-count">{inboxUnprocessed.length}</span>
            </div>
            <div className="column-cards">
              {inboxUnprocessed.map((card) => (
                <CardFront
                  key={card.path}
                  entry={{ card, milestoneLabel: null, filterKey: "inbox" }}
                  isOrigin={dragging?.path === card.path}
                  onMoveByKey={moveByKey}
                  onSelect={onSelectCard}
                  onDragState={setDragging}
                />
              ))}
            </div>
          </section>
          </div>
        )}
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
              draggingPath={dragging?.path ?? null}
              showInsertZones={MANUAL_COLUMNS.has(column)}
              onDropCard={(path) => dropOnColumn(column, path)}
              onDropAt={(path, zoneIndex) =>
                dropAtIndex(column, entries, path, zoneIndex)
              }
              onMoveByKey={moveByKey}
              onSelect={onSelectCard}
              onDragState={setDragging}
              onBgContextMenu={bgContext}
            />
          );
        })}
      </div>
      {model.invalid.length > 0 && <NeedsAttentionLane entries={model.invalid} />}
    </div>
  );
}

function NeedsAttentionLane({ entries }: { entries: InvalidFile[] }) {
  return (
    <section className="needs-attention" aria-label="needs attention">
      <div className="column-header">
        <h2>needs attention</h2>
        <span className="column-count">{entries.length}</span>
      </div>
      <div className="needs-attention-entries">
        {entries.map((entry) => (
          <InvalidFileEntry key={entry.path} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function InvalidFileEntry({ entry }: { entry: InvalidFile }) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <article className="invalid-entry">
      <div className="invalid-entry-header">
        <div>
          <p className="invalid-path">{entry.path}</p>
          <p className="invalid-reason">{entry.reason}</p>
        </div>
        <button type="button" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? "hide file" : "show file"}
        </button>
      </div>
      {showRaw && <pre className="invalid-raw">{entry.raw}</pre>}
    </article>
  );
}

function Column({
  name,
  cards,
  draggingPath,
  showInsertZones,
  onDropCard,
  onDropAt,
  onMoveByKey,
  onSelect,
  onDragState,
  onBgContextMenu,
}: {
  name: string;
  cards: BoardCard[];
  /** Path of the card currently being dragged, for origin marking (i0004). */
  draggingPath: string | null;
  /** c056: render positioned drop targets (manual columns during a drag). */
  /** c056: render positioned drop targets for manual columns. Always mounted
   *  (i0003) — inert until a drag; appearance driven by the board-dragging
   *  class, never by mounting/unmounting (which aborts WKWebView drags). */
  showInsertZones: boolean;
  onDropCard: (cardPath: string) => void;
  onDropAt: (cardPath: string, zoneIndex: number) => void;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
  onSelect?: (card: Card) => void;
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
      className="column-track"
      onMouseDown={backgroundDrag}
      onContextMenu={onBgContextMenu}
      onDragOver={(event) => event.preventDefault()}
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
          <span className="column-count">{cards.length}</span>
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
                onDragState={onDragState}
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
  onDragState,
}: {
  entry: BoardCard;
  /** True while this card is the one being dragged (i0004 origin marker). */
  isOrigin?: boolean;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
  onSelect?: (card: Card) => void;
  onDragState: (card: Card | null) => void;
}) {
  const { card, milestoneLabel } = entry;
  return (
    <article
      className={isOrigin ? "card-front card-origin" : "card-front"}
      draggable
      tabIndex={0}
      aria-label={`${card.id}: ${card.title}`}
      onClick={() => onSelect?.(card)}
      onDragStart={(event) => {
        event.dataTransfer.setData(CARD_DRAG_TYPE, card.path);
        event.dataTransfer.effectAllowed = "move";
        onDragState(card);
      }}
      onDragEnd={() => onDragState(null)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onMoveByKey(card, 1);
        if (event.key === "ArrowLeft") onMoveByKey(card, -1);
        if (event.key === "Enter") onSelect?.(card);
      }}
    >
      <div className="card-meta">
        <span className="card-id">{card.id}</span>
        <span className="card-meta-badges">
          {card.type !== "task" && (
            <span className={`card-type type-${card.type}`}>{card.type}</span>
          )}
          <span className={`card-priority priority-${card.priority}`}>
            {card.priority}
          </span>
        </span>
      </div>
      <p className="card-title">{card.title}</p>
      <div className="card-meta">
        <span className="card-milestone">{milestoneLabel ?? "inbox"}</span>
      </div>
    </article>
  );
}
