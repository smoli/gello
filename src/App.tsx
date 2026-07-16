import { useEffect, useState } from "react";
import { Board } from "./components/Board";
import { CardDetail, type MilestoneOption } from "./components/CardDetail";
import { QuickCapture } from "./components/QuickCapture";
import {
  applyFileChanges,
  findCardById,
  openBugsFor,
  withCardTriaged,
  withNewInboxCard,
  withUpdatedCard,
  type BoardModel,
} from "./lib/board";
import {
  createBugFor,
  createCard,
  moveCard,
  saveCardBody,
  saveCardEdit,
  saveCardFields,
  todayIsoDate,
  triageCard,
  type MoveResult,
} from "./lib/board-actions";
import type { CardEdit } from "./components/CardDetail";
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
   * Save an inline edit (title + body). Pre-watcher conflict policy (full
   * policy = c015): compare the file's current disk content against the raw
   * this edit was based on; a mismatch is surfaced as a conflict — never
   * silently clobbered. The model is refreshed from disk so "discard" shows
   * the newer version.
   */
  const handleSaveEdit = async (
    card: Card,
    edit: CardEdit,
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
    applyAction(() =>
      saveCardEdit(board.root, card, edit, board.model.config, todayIsoDate()),
    );
    return "saved";
  };

  const handleToggleTask = (card: Card, index: number) => {
    if (!board) return;
    applyAction(() =>
      saveCardBody(
        board.root,
        card,
        toggleTaskItem(card.body, index),
        board.model.config,
        todayIsoDate(),
      ),
    );
  };

  const handleCreate = (title: string, body: string, type: "task" | "bug") => {
    if (!board) return;
    applyAction(
      () =>
        createCard(
          board.root,
          board.model,
          { title, body, type: type === "task" ? undefined : type },
          todayIsoDate(),
        ),
      withNewInboxCard,
    );
  };

  const handleReportBug = (source: Card) => {
    if (!board) return;
    let created: Card | null = null;
    applyAction(
      () => {
        const result = createBugFor(board.root, board.model, source, todayIsoDate());
        created = result.card;
        return result;
      },
      (model, card) =>
        card.path.startsWith("inbox/")
          ? withNewInboxCard(model, card)
          : {
              ...model,
              milestones: model.milestones.map((group) =>
                card.path.startsWith(`milestones/${group.folder}/`)
                  ? { ...group, cards: [...group.cards, card] }
                  : group,
              ),
            },
    );
    // the criterion: report-bug opens the fresh bug for editing
    if (created !== null) setSelectedPath((created as Card).path);
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
    // if the detail was open on this card, follow it to its new location —
    // but never open a dialog as a side effect (drag-triage, c028)
    const newPath = `milestones/${folder}/${oldPath.slice(oldPath.lastIndexOf("/") + 1)}`;
    setSelectedPath((current) => (current === oldPath ? newPath : current));
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
          onTriageCard={handleTriage}
        />
        {selected && (
          <CardDetail
            card={selected.card}
            milestoneLabel={selected.milestoneLabel}
            columns={board.model.config.columns}
            milestoneOptions={milestoneOptions}
            onChangeFields={(changes) => handleFieldChanges(selected.card, changes)}
            onToggleTask={(index) => handleToggleTask(selected.card, index)}
            onSaveEdit={(edit, force) => handleSaveEdit(selected.card, edit, force)}
            onTriage={(folder, milestoneId) =>
              handleTriage(selected.card, folder, milestoneId)
            }
            onReportBug={() => handleReportBug(selected.card)}
            onOpenCardId={(id) => {
              const target = findCardById(board.model, id);
              if (target) setSelectedPath(target.path);
            }}
            refCard={
              selected.card.ref
                ? {
                    exists: findCardById(board.model, selected.card.ref) !== null,
                    title: findCardById(board.model, selected.card.ref)?.title ?? null,
                  }
                : null
            }
            openBugs={openBugsFor(board.model, selected.card.id)}
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
