import { useEffect, useState } from "react";
import { Board } from "./components/Board";
import { CardDetail, type MilestoneOption } from "./components/CardDetail";
import { QuickCapture } from "./components/QuickCapture";
import {
  applyFileChanges,
  withCardTriaged,
  withNewInboxCard,
  withUpdatedCard,
  type BoardModel,
} from "./lib/board";
import {
  createCard,
  moveCard,
  saveCardBody,
  saveCardFields,
  todayIsoDate,
  triageCard,
  type MoveResult,
} from "./lib/board-actions";
import {
  loadBoardFromDisk,
  readFileRaw,
  watchBoard,
  type LoadedBoard,
} from "./lib/board-io";
import { parseCard, type Card, type CardFieldChanges } from "./lib/cards";
import { toggleTaskItem } from "./lib/markdown";
import type { SaveBodyResult } from "./components/CardDetail";
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

  // Live sync: watch the board directory, coalesce event bursts, re-read
  // only the changed files, and reconcile through applyFileChanges — which
  // returns the same model reference for self-write echoes (no re-render).
  const root = board?.root ?? null;
  useEffect(() => {
    if (!root) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();

    const reconcile = async () => {
      const paths = [...pending];
      pending.clear();
      const changes = await Promise.all(
        paths.map(async (path) => ({
          path,
          content: await readFileRaw(`${root}/${path}`).catch(() => null),
        })),
      );
      if (stopped) return;
      setBoard((current) => {
        if (!current) return current;
        const next = applyFileChanges(current.model, changes);
        return next === current.model ? current : { ...current, model: next };
      });
    };

    const stopPromise = watchBoard(root, (paths) => {
      for (const path of paths) pending.add(path);
      clearTimeout(timer);
      timer = setTimeout(() => void reconcile(), 150);
    }).catch(() => () => {});

    return () => {
      stopped = true;
      clearTimeout(timer);
      void stopPromise.then((stop) => stop());
    };
  }, [root]);

  /** Optimistic update + rollback around any card-writing action. */
  const applyAction = (
    action: () => MoveResult,
    apply: (model: BoardModel, card: Card) => BoardModel = withUpdatedCard,
  ) => {
    if (!board) return;
    const before = board.model;
    try {
      const { card: updated, persisted } = action();
      setBoard((current) =>
        current ? { ...current, model: apply(current.model, updated) } : current,
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

  /**
   * Save an edited body. Pre-watcher conflict policy (full policy = c015):
   * compare the file's current disk content against the raw this edit was
   * based on; a mismatch is surfaced as a conflict — never silently
   * clobbered. The model is refreshed from disk so "discard" shows the
   * newer version.
   */
  const handleSaveBody = async (
    card: Card,
    newBody: string,
    force: boolean,
  ): Promise<SaveBodyResult> => {
    if (!board) return "conflict";
    if (!force) {
      try {
        const diskRaw = await readFileRaw(`${board.root}/${card.path}`);
        if (diskRaw !== card.raw) {
          const parsed = parseCard(card.path, diskRaw, board.model.config);
          if (parsed.ok) {
            setBoard((current) =>
              current
                ? { ...current, model: withUpdatedCard(current.model, parsed.card) }
                : current,
            );
          }
          return "conflict";
        }
      } catch {
        return "conflict";
      }
    }
    applyAction(() => saveCardBody(board.root, card, newBody, todayIsoDate()));
    return "saved";
  };

  const handleToggleTask = (card: Card, index: number) => {
    if (!board) return;
    applyAction(() =>
      saveCardBody(board.root, card, toggleTaskItem(card.body, index), todayIsoDate()),
    );
  };

  const handleCreate = (title: string, body: string) => {
    if (!board) return;
    applyAction(
      () => createCard(board.root, board.model, { title, body }, todayIsoDate()),
      withNewInboxCard,
    );
  };

  const handleTriage = (card: Card, folder: string, milestoneId: string) => {
    if (!board) return;
    const oldPath = card.path;
    applyAction(
      () =>
        triageCard(
          board.root,
          card,
          { folder, milestoneId },
          board.model.config,
          todayIsoDate(),
        ),
      (model, moved) => withCardTriaged(model, oldPath, moved, folder),
    );
    // keep the detail open on the card's new location
    setSelectedPath(`milestones/${folder}/${oldPath.slice(oldPath.lastIndexOf("/") + 1)}`);
  };

  if (loading) return null;

  if (board) {
    const selected = selectedPath ? findCard(board.model, selectedPath) : null;
    const milestoneOptions: MilestoneOption[] = board.model.milestones
      .filter((group) => group.milestone !== null)
      .map((group) => ({
        folder: group.folder,
        milestoneId: group.milestone!.id,
        label: group.milestone!.title,
      }));
    return (
      <>
        {error && (
          <div role="alert" className="board-error">
            {error}
          </div>
        )}
        <QuickCapture onCreate={handleCreate} />
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
            milestoneOptions={milestoneOptions}
            onChangeFields={(changes) => handleFieldChanges(selected.card, changes)}
            onToggleTask={(index) => handleToggleTask(selected.card, index)}
            onSaveBody={(body, force) => handleSaveBody(selected.card, body, force)}
            onTriage={(folder, milestoneId) =>
              handleTriage(selected.card, folder, milestoneId)
            }
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
