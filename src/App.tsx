import { useEffect, useState } from "react";
import { Board } from "./components/Board";
import type { BoardModel } from "./lib/board";
import { loadBoardFromDisk } from "./lib/board-io";
import "./App.css";

function App() {
  const [model, setModel] = useState<BoardModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadBoardFromDisk()
      .then((loaded) => {
        if (!cancelled) setModel(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  if (model) return <Board model={model} />;

  return (
    <main className="app">
      <h1>gello</h1>
      <p className="empty-state">No board loaded.</p>
    </main>
  );
}

export default App;
