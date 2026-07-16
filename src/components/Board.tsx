import { useMemo, useState } from "react";
import type { BoardModel } from "../lib/board";
import type { Card, InvalidFile } from "../lib/cards";
import "./Board.css";

const CARD_DRAG_TYPE = "application/x-gello-card-path";

/** A card plus its display context on the board. */
interface BoardCard {
  card: Card;
  /** Milestone title (or folder as fallback); null = inbox. */
  milestoneLabel: string | null;
  /** Filter key: milestone folder. */
  filterKey: string;
}

export type MoveCardHandler = (card: Card, status: string) => void;

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

export function Board({
  model,
  onMoveCard,
  onSelectCard,
}: {
  model: BoardModel;
  onMoveCard?: MoveCardHandler;
  onSelectCard?: (card: Card) => void;
}) {
  const [filter, setFilter] = useState("all");
  const statusCards = useMemo(() => collectStatusCards(model), [model]);
  const inboxUnprocessed = useMemo(
    () => model.inbox.filter((card) => card.status === "backlog"),
    [model],
  );
  const visible =
    filter === "all"
      ? statusCards
      : statusCards.filter((c) => c.filterKey === filter || c.filterKey === "inbox");

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

  const dropOnColumn = (column: string, cardPath: string) => {
    const entry = allCards.find((c) => c.card.path === cardPath);
    if (entry && entry.card.status !== column) {
      onMoveCard?.(entry.card, column);
    }
  };

  const moveByKey = (card: Card, direction: -1 | 1) => {
    const target = columns[columns.indexOf(card.status) + direction];
    if (target) onMoveCard?.(card, target);
  };

  return (
    <div className="board">
      <header className="board-toolbar">
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
      </header>
      <div className="board-columns">
        {inboxUnprocessed.length > 0 && (
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
                  onMoveByKey={moveByKey}
                  onSelect={onSelectCard}
                />
              ))}
            </div>
          </section>
        )}
        {columns.map((column) => (
          <Column
            key={column}
            name={column}
            cards={visible.filter((c) => c.card.status === column)}
            onDropCard={(path) => dropOnColumn(column, path)}
            onMoveByKey={moveByKey}
            onSelect={onSelectCard}
          />
        ))}
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
  onDropCard,
  onMoveByKey,
  onSelect,
}: {
  name: string;
  cards: BoardCard[];
  onDropCard: (cardPath: string) => void;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
  onSelect?: (card: Card) => void;
}) {
  return (
    <section
      className="column"
      aria-label={name}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const path = event.dataTransfer.getData(CARD_DRAG_TYPE);
        if (path) onDropCard(path);
      }}
    >
      <div className="column-header">
        <h2>{name}</h2>
        <span className="column-count">{cards.length}</span>
      </div>
      <div className="column-cards">
        {cards.map((entry) => (
          <CardFront
            key={entry.card.path}
            entry={entry}
            onMoveByKey={onMoveByKey}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function CardFront({
  entry,
  onMoveByKey,
  onSelect,
}: {
  entry: BoardCard;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
  onSelect?: (card: Card) => void;
}) {
  const { card, milestoneLabel } = entry;
  return (
    <article
      className="card-front"
      draggable
      tabIndex={0}
      aria-label={`${card.id}: ${card.title}`}
      onClick={() => onSelect?.(card)}
      onDragStart={(event) => {
        event.dataTransfer.setData(CARD_DRAG_TYPE, card.path);
        event.dataTransfer.effectAllowed = "move";
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onMoveByKey(card, 1);
        if (event.key === "ArrowLeft") onMoveByKey(card, -1);
        if (event.key === "Enter") onSelect?.(card);
      }}
    >
      <div className="card-meta">
        <span className="card-id">{card.id}</span>
        <span className={`card-priority priority-${card.priority}`}>
          {card.priority}
        </span>
      </div>
      <p className="card-title">{card.title}</p>
      <div className="card-meta">
        <span className="card-milestone">{milestoneLabel ?? "inbox"}</span>
      </div>
    </article>
  );
}
