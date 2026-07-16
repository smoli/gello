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

function collectMilestoneCards(model: BoardModel): BoardCard[] {
  return model.milestones.flatMap((group) =>
    group.cards.map((card) => ({
      card,
      milestoneLabel: group.milestone?.title ?? group.folder,
      filterKey: group.folder,
    })),
  );
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
  const milestoneCards = useMemo(() => collectMilestoneCards(model), [model]);
  const visible =
    filter === "all"
      ? milestoneCards
      : milestoneCards.filter((c) => c.filterKey === filter);

  const columns = model.config.columns;

  const dropOnColumn = (column: string, cardPath: string) => {
    const entry = milestoneCards.find((c) => c.card.path === cardPath);
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
        {model.inbox.length > 0 && (
          <section className="column column-inbox" aria-label="inbox">
            <div className="column-header">
              <h2>inbox</h2>
              <span className="column-count">{model.inbox.length}</span>
            </div>
            <div className="column-cards">
              {model.inbox.map((card) => (
                <CardFront
                  key={card.path}
                  entry={{ card, milestoneLabel: null, filterKey: "inbox" }}
                  interactive={false}
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
            interactive
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
  interactive,
  onMoveByKey,
  onSelect,
}: {
  entry: BoardCard;
  /** Inbox cards are selectable only — status moves don't apply to them. */
  interactive: boolean;
  onMoveByKey: (card: Card, direction: -1 | 1) => void;
  onSelect?: (card: Card) => void;
}) {
  const { card, milestoneLabel } = entry;
  return (
    <article
      className="card-front"
      draggable={interactive}
      tabIndex={0}
      aria-label={`${card.id}: ${card.title}`}
      onClick={() => onSelect?.(card)}
      onDragStart={(event) => {
        if (!interactive) return;
        event.dataTransfer.setData(CARD_DRAG_TYPE, card.path);
        event.dataTransfer.effectAllowed = "move";
      }}
      onKeyDown={(event) => {
        if (interactive && event.key === "ArrowRight") onMoveByKey(card, 1);
        if (interactive && event.key === "ArrowLeft") onMoveByKey(card, -1);
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
