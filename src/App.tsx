import { useEffect, useState } from "react";
import { Board } from "./components/Board";
import { CardDetail } from "./components/CardDetail";
import { withUpdatedCard, type BoardModel } from "./lib/board";
import {
  moveCard,
  saveCardBody,
  saveCardFields,
  todayIsoDate,
  type MoveResult,
} from "./lib/board-actions";
import { loadBoardFromDisk, type LoadedBoard } from "./lib/board-io";
import type { Card, CardFieldChanges } from "./lib/cards";
import { toggleTaskItem } from "./lib/markdown";
import "./App.css";

/** Find a card and its milestone display label in the current model. */
function findCard(
  model: BoardModel,
  path: string,
): { card: Card; milestoneLabel: string | null } | null {
  const inboxCard = model.inbox.find((c) => c.path === path);
  if (inboxCard) return { card: inboxCard, milestoneLabel: null };
  for (const group of model.milestones) {
    const card = group.cards.find((c) => c.path === path);
    if (card) {
      return { card, milestoneLabel: group.milestone?.title ?? group.folder };
    }
  }
  return null;
}

function App() {
  const [board, setBoard] = useState<LoadedBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadBoardFromDisk()
      .then((loaded) => {
        if (!cancelled) setBoard(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Optimistic update + rollback around any card-writing action. */
  const applyAction = (action: () => MoveResult) => {
    if (!board) return;
    const before = board.model;
    try {
      const { card: updated, persisted } = action();
      setBoard((current) =>
        current ? { ...current, model: withUpdatedCard(current.model, updated) } : current,
      );
      setError(null);
      persisted.catch((failure: unknown) => {
        setBoard((current) => (current ? { ...current, model: before } : current));
        setError(failure instanceof Error ? failure.message : String(failure));
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const handleMove = (card: Card, status: string) => {
    if (!board || card.status === status) return;
    applyAction(() =>
      moveCard(board.root, card, status, board.model.config, todayIsoDate()),
    );
  };

  const handleFieldChanges = (card: Card, changes: CardFieldChanges) => {
    if (!board) return;
    applyAction(() =>
      saveCardFields(board.root, card, changes, board.model.config, todayIsoDate()),
    );
  };

  const handleToggleTask = (card: Card, index: number) => {
    if (!board) return;
    applyAction(() =>
      saveCardBody(board.root, card, toggleTaskItem(card.body, index), todayIsoDate()),
    );
  };

  if (loading) return null;

  if (board) {
    const selected = selectedPath ? findCard(board.model, selectedPath) : null;
    return (
      <>
        {error && (
          <div role="alert" className="board-error">
            {error}
          </div>
        )}
        <Board
          model={board.model}
          onMoveCard={handleMove}
          onSelectCard={(card) => setSelectedPath(card.path)}
        />
        {selected && (
          <CardDetail
            card={selected.card}
            milestoneLabel={selected.milestoneLabel}
            columns={board.model.config.columns}
            onChangeFields={(changes) => handleFieldChanges(selected.card, changes)}
            onToggleTask={(index) => handleToggleTask(selected.card, index)}
            onClose={() => setSelectedPath(null)}
          />
        )}
      </>
    );
  }

  return (
    <main className="app">
      <h1>gello</h1>
      <p className="empty-state">No board loaded.</p>
    </main>
  );
}

export default App;
