import { useEffect, useState } from "react";
import { Board } from "./components/Board";
import { withUpdatedCard } from "./lib/board";
import { moveCard, todayIsoDate } from "./lib/board-actions";
import { loadBoardFromDisk, type LoadedBoard } from "./lib/board-io";
import type { Card } from "./lib/cards";
import "./App.css";

function App() {
  const [board, setBoard] = useState<LoadedBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleMove = (card: Card, status: string) => {
    if (!board || card.status === status) return;
    const before = board.model;
    try {
      const { card: updated, persisted } = moveCard(
        board.root,
        card,
        status,
        board.model.config,
        todayIsoDate(),
      );
      // optimistic: show the move immediately, roll back if the write fails
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

  if (loading) return null;

  if (board) {
    return (
      <>
        {error && (
          <div role="alert" className="board-error">
            {error}
          </div>
        )}
        <Board model={board.model} onMoveCard={handleMove} />
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
