import { useMemo, useState } from "react";
import type { BoardModel } from "../lib/board";
import type { Card } from "../lib/cards";
import "./Board.css";

const CARD_DRAG_TYPE = "application/x-gello-card-path";

/** A card plus its display context on the board. */
interface BoardCard {
  card: Card;
  /** Milestone title (or folder as fallback); null = inbox. */
  milestoneLabel: string | null;
  /** Filter key: milestone folder, or "inbox". */
  filterKey: string;
}

export type MoveCardHandler = (card: Card, status: string) => void;

function collectCards(model: BoardModel): BoardCard[] {
  const inbox: BoardCard[] = model.inbox.map((card) => ({
    card,
    milestoneLabel: null,
    filterKey: "inbox",
  }));
  const milestoneCards: BoardCard[] = model.milestones.flatMap((group) =>
    group.cards.map((card) => ({
      card,
      milestoneLabel: group.milestone?.title ?? group.folder,
      filterKey: group.folder,
    })),
  );
  return [...inbox, ...milestoneCards];
}

export function Board({
  model,
  onMoveCard,
}: {
  model: BoardModel;
  onMoveCard?: MoveCardHandler;
}) {
  const [filter, setFilter] = useState("all");
  const allCards = useMemo(() => collectCards(model), [model]);
  const visible =
    filter === "all" ? allCards : allCards.filter((c) => c.filterKey === filter);

  const columns = model.config.columns;

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
          <option value="inbox">Inbox</option>
          {model.milestones.map((group) => (
            <option key={group.folder} value={group.folder}>
              {group.milestone?.title ?? group.folder}
            </option>
          ))}
        </select>
      </header>
      <div className="board-columns">
        {columns.map((column) => (
          <Column
            key={column}
            name={column}
            cards={visible.filter((c) => c.card.status === column)}
            onDropCard={(path) => dropOnColumn(column, path)}
            onMoveByKey={moveByKey}
          />
        ))}
      </div>
    </div>
  );
}

function Column({
  name,
  cards,
  onDropCard,
  onMoveByKey,
}: {
  name: string;
  cards: BoardCard[];
  onDropCard: (cardPath: string) => void;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
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
          <CardFront key={entry.card.path} entry={entry} onMoveByKey={onMoveByKey} />
        ))}
      </div>
    </section>
  );
}

function CardFront({
  entry,
  onMoveByKey,
}: {
  entry: BoardCard;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
}) {
  const { card, milestoneLabel } = entry;
  return (
    <article
      className="card-front"
      draggable
      tabIndex={0}
      aria-label={`${card.id}: ${card.title}`}
      onDragStart={(event) => {
        event.dataTransfer.setData(CARD_DRAG_TYPE, card.path);
        event.dataTransfer.effectAllowed = "move";
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onMoveByKey(card, 1);
        if (event.key === "ArrowLeft") onMoveByKey(card, -1);
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
