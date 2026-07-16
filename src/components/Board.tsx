import { useMemo, useState } from "react";
import type { BoardModel } from "../lib/board";
import type { Card } from "../lib/cards";
import "./Board.css";

/** A card plus its display context on the board. */
interface BoardCard {
  card: Card;
  /** Milestone title (or folder as fallback); null = inbox. */
  milestoneLabel: string | null;
  /** Filter key: milestone folder, or "inbox". */
  filterKey: string;
}

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

export function Board({ model }: { model: BoardModel }) {
  const [filter, setFilter] = useState("all");
  const allCards = useMemo(() => collectCards(model), [model]);
  const visible =
    filter === "all" ? allCards : allCards.filter((c) => c.filterKey === filter);

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
        {model.config.columns.map((column) => (
          <Column
            key={column}
            name={column}
            cards={visible.filter((c) => c.card.status === column)}
          />
        ))}
      </div>
    </div>
  );
}

function Column({ name, cards }: { name: string; cards: BoardCard[] }) {
  return (
    <section className="column" aria-label={name}>
      <div className="column-header">
        <h2>{name}</h2>
        <span className="column-count">{cards.length}</span>
      </div>
      <div className="column-cards">
        {cards.map((entry) => (
          <CardFront key={entry.card.path} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function CardFront({ entry }: { entry: BoardCard }) {
  const { card, milestoneLabel } = entry;
  return (
    <article className="card-front">
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
