import { useCallback, useEffect, useState } from "react";
import {
  MULTI_COLUMNS,
  PROJECT_PALETTE,
  autoProjectColor,
  cardKey,
  columnCards,
  findProjectCard,
  projectColor,
  projectName,
  type ProjectBoard,
  type ProjectCard,
} from "../lib/multi";
import {
  applyFileChanges,
  blockingCards,
  dependenciesOf,
  dependencyOptions,
  findCardById,
  openFollowUpsFor,
  openIssuesFor,
  withUpdatedCard,
  type BoardModel,
} from "../lib/board";
import {
  answerGelloQuestion,
  moveCard,
  nowIsoDateTime,
  rebaseOnDisk,
  saveCardEdit,
  saveCardFields,
  todayIsoDate,
  triageCard,
  type MoveResult,
} from "../lib/board-actions";
import {
  imageDataUrl,
  loadBoardAt,
  readFileRaw,
  watchBoard,
  writeNewFiles,
} from "../lib/board-io";
import { readRawOrNull } from "../lib/safe-read";
import { setBoardKey } from "../lib/boardyaml";
import type { Card, CardFieldChanges } from "../lib/cards";
import {
  parseGelloQuestion,
  unfenceWithAnswer,
  type GelloAnswer,
} from "../lib/gello-question";
import { resolveFromCard } from "../lib/assets";
import { tagChipStyle } from "../lib/tags";
import { BoardError } from "./BoardError";
import { CardDetail, type CardEdit, type MilestoneOption, type SaveBodyResult } from "./CardDetail";
import { QuestionModal } from "./QuestionModal";
import "./MultiProject.css";

/** Drag payload: the (project, id) key, since ids repeat between boards. */
const CARD_DRAG_TYPE = "application/x-gello-project-card";

/**
 * c0138: loads and watches one selected project, and renders nothing. Mounted
 * per project and keyed by its path, so adding a project loads only that one and
 * removing it stops only its watcher — React's own lifecycle does the
 * bookkeeping the generalisation to N boards would otherwise need.
 */
function ProjectFeed({
  path,
  onLoaded,
  onMissing,
  onDropped,
  onChanged,
}: {
  path: string;
  onLoaded: (board: ProjectBoard) => void;
  onMissing: (path: string) => void;
  onDropped: (path: string) => void;
  onChanged: (path: string, root: string, paths: string[]) => void;
}) {
  useEffect(() => {
    let stopped = false;
    let stop: (() => void) | null = null;
    void (async () => {
      const loaded = await loadBoardAt(path);
      if (stopped) return;
      if (!loaded) {
        onMissing(path);
        return;
      }
      onLoaded({ path, root: loaded.root, model: loaded.model });
      const off = await watchBoard(loaded.root, (paths) =>
        onChanged(path, loaded.root, paths),
      );
      // the project may have left the selection while the board was loading
      if (stopped) off();
      else stop = off;
    })();
    return () => {
      stopped = true;
      stop?.();
      onDropped(path);
    };
    // the handlers are stable (functional setState); the path is the identity
  }, [path]);
  return null;
}

/**
 * c0138: the cross-project activity view — the ready / in-progress / review
 * cards of several projects on one screen, with the things needing you (a card
 * to accept, a parked question) actionable without opening that project.
 *
 * Board-derived: it reads each project's `.gello/`, never its companion state.
 * Every card carries its project along, so a write goes to the root that owns
 * it, through the same atomic write and conflict rebase the open board uses.
 */
export function MultiProject({
  projects,
  known,
  onChangeProjects,
  onClose,
  darkChips = false,
}: {
  /** Selected project folders, in display order. */
  projects: string[];
  /** Known/recent projects, the pool the picker offers. */
  known: string[];
  onChangeProjects: (next: string[]) => void;
  onClose: () => void;
  /** i0114: shade the project chips dark in dark mode. */
  darkChips?: boolean;
}) {
  const [boards, setBoards] = useState<Record<string, ProjectBoard>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** The open card's (project, id) key. */
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /** The card whose parked question is being answered from its front. */
  const [answeringKey, setAnsweringKey] = useState<string | null>(null);
  /** The project whose colour picker is open. */
  const [colouring, setColouring] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);

  const onLoaded = useCallback((board: ProjectBoard) => {
    setBoards((current) => ({ ...current, [board.path]: board }));
    setMissing((current) => current.filter((path) => path !== board.path));
  }, []);

  const onMissing = useCallback((path: string) => {
    setMissing((current) => (current.includes(path) ? current : [...current, path]));
  }, []);

  const onDropped = useCallback((path: string) => {
    setBoards((current) => {
      if (!(path in current)) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
    setMissing((current) => current.filter((entry) => entry !== path));
  }, []);

  /**
   * A watched change: re-read the named files and reconcile that project's model
   * through the same `applyFileChanges` a single board uses — which returns the
   * same model reference for a no-op (our own write echoing back), so a repeat
   * costs a read and no render. No debounce: unlike the board view's reconcile,
   * this does nothing per burst beyond the reads.
   */
  const onChanged = useCallback(
    async (path: string, root: string, paths: string[]) => {
      const changes = await Promise.all(
        paths.map(async (relative) => ({
          path: relative,
          content: await readRawOrNull(readFileRaw, `${root}/${relative}`),
        })),
      );
      setBoards((current) => {
        const board = current[path];
        if (!board) return current;
        const model = applyFileChanges(board.model, changes);
        return model === board.model ? current : { ...current, [path]: { ...board, model } };
      });
    },
    [],
  );
  const onChangedRef = useCallback(
    (path: string, root: string, paths: string[]) => void onChanged(path, root, paths),
    [onChanged],
  );

  /** The loaded boards, in the selection's order. */
  const ordered = projects
    .map((path) => boards[path])
    .filter((board): board is ProjectBoard => board !== undefined);

  const entryFor = (key: string | null): ProjectCard | null =>
    key === null ? null : findProjectCard(ordered, key);

  /** Replace one project's model in place (an optimistic update or a rollback). */
  const withModel = (path: string, model: BoardModel) =>
    setBoards((current) => {
      const board = current[path];
      return board ? { ...current, [path]: { ...board, model } } : current;
    });

  /**
   * A card write against the project that owns the card: rebase on that
   * project's disk bytes (c015), apply optimistically, roll back if the atomic
   * write fails. The single-board path in App.tsx does exactly this.
   */
  const applyWrite = async (entry: ProjectCard, act: (fresh: Card) => MoveResult) => {
    const before = entry.board.model;
    try {
      const fresh = await rebaseOnDisk(entry.board.root, entry.card, before.config);
      const { card: updated, persisted } = act(fresh);
      withModel(entry.board.path, withUpdatedCard(before, updated));
      setError(null);
      await persisted;
    } catch (failure) {
      withModel(entry.board.path, before);
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  /** Accept finished work: `done` in its own project, stamped like any move. */
  const accept = (entry: ProjectCard) => {
    // the done area accepts work waiting on review; nothing else is "accepted"
    if (entry.card.status !== "review") return;
    void applyWrite(entry, (fresh) =>
      moveCard(entry.board.root, fresh, "done", entry.board.model.config, nowIsoDateTime()),
    );
  };

  /** Answer a parked question — un-fenced in place, marker set (c0101/c0102). */
  const answer = (entry: ProjectCard, given: GelloAnswer) => {
    const newBody = unfenceWithAnswer(entry.card.body, given);
    if (newBody === null) return;
    void applyWrite(entry, (fresh) =>
      answerGelloQuestion(
        entry.board.root,
        fresh,
        newBody,
        entry.board.model.config,
        todayIsoDate(),
      ),
    );
  };

  /** Set a project's colour: a surgical `project_color` edit in its board.yaml,
   *  so the colour belongs to the repo rather than to this app's settings. */
  const chooseColour = async (board: ProjectBoard, colour: string) => {
    setColouring(null);
    try {
      await writeNewFiles([
        {
          path: `${board.root}/board.yaml`,
          content: setBoardKey(board.model.configRaw, "project_color", colour),
        },
      ]);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const entry = entryFor(event.dataTransfer.getData(CARD_DRAG_TYPE));
    if (entry) accept(entry);
  };

  const selected = entryFor(selectedKey);
  const answering = entryFor(answeringKey);
  const answeringQuestion = answering ? parseGelloQuestion(answering.card.body) : null;

  return (
    <section className="multi" aria-label="Activity across projects">
      {projects.map((path) => (
        <ProjectFeed
          key={path}
          path={path}
          onLoaded={onLoaded}
          onMissing={onMissing}
          onDropped={onDropped}
          onChanged={onChangedRef}
        />
      ))}

      <header className="multi-bar">
        <button type="button" className="multi-back" onClick={onClose}>
          ← Back to board
        </button>
        <ul className="multi-project-list">
          {projects.map((path) => {
            const board = boards[path];
            const colour = board ? projectColor(board) : autoProjectColor(path);
            const name = projectName(path);
            return (
              <li key={path} className="multi-project-chip" style={tagChipStyle(colour, darkChips)}>
                <button
                  type="button"
                  className="multi-swatch"
                  style={{ backgroundColor: colour }}
                  aria-label={`Colour for ${name}`}
                  title="Set this project's colour"
                  onClick={() => setColouring((current) => (current === path ? null : path))}
                />
                <span className="multi-project-name" title={path}>
                  {name}
                </span>
                <button
                  type="button"
                  className="multi-project-remove"
                  aria-label={`Remove ${name}`}
                  onClick={() => onChangeProjects(projects.filter((entry) => entry !== path))}
                >
                  ×
                </button>
                {colouring === path && board && (
                  <div className="multi-palette" role="group" aria-label={`Colours for ${name}`}>
                    {PROJECT_PALETTE.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        className="multi-palette-swatch"
                        style={{ backgroundColor: swatch }}
                        aria-label={`Colour ${swatch}`}
                        onClick={() => void chooseColour(board, swatch)}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="multi-add">
          <button type="button" onClick={() => setAdding((open) => !open)}>
            Add project
          </button>
          {adding && (
            <>
              <div className="multi-add-backdrop" onClick={() => setAdding(false)} />
              <ul className="multi-add-list" role="menu">
                {known
                  .filter((path) => !projects.includes(path))
                  .map((path) => (
                    <li key={path}>
                      <button
                        type="button"
                        role="menuitem"
                        title={path}
                        onClick={() => {
                          setAdding(false);
                          onChangeProjects([...projects, path]);
                        }}
                      >
                        {projectName(path)}
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      </header>

      {missing.map((path) => (
        <p key={path} className="multi-missing">
          No gello board at {path}
        </p>
      ))}

      <div className="multi-columns">
        {MULTI_COLUMNS.map((column) => {
          const entries = columnCards(ordered, column);
          return (
            <section className="multi-column" aria-label={column} key={column}>
              <div className="multi-column-header">
                <span className="multi-column-name">{column}</span>
                <span className="multi-column-count">{entries.length}</span>
              </div>
              <div className="multi-column-cards">
                {entries.map((entry) => (
                  <ProjectCardFront
                    key={entry.key}
                    entry={entry}
                    colour={projectColor(entry.board)}
                    darkChips={darkChips}
                    onOpen={() => setSelectedKey(entry.key)}
                    onAnswer={() => setAnsweringKey(entry.key)}
                    onDragState={setDragging}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Accepting is a deliberate drop, not a column: the view never fills
          with every project's done pile. */}
      <section
        className={dragging ? "multi-done multi-done-armed" : "multi-done"}
        aria-label="done"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        Drop a reviewed card here to accept it
      </section>

      {error && <BoardError message={error} onDismiss={() => setError(null)} />}

      {answering && answeringQuestion && (
        <QuestionModal
          cardId={answering.card.id}
          question={answeringQuestion}
          onAnswer={(given) => {
            setAnsweringKey(null);
            answer(answering, given);
          }}
          onCancel={() => setAnsweringKey(null)}
        />
      )}

      {selected && (
        <ProjectCardDetail
          key={selected.key}
          entry={selected}
          onWrite={applyWrite}
          onOpenKey={setSelectedKey}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </section>
  );
}

/** One aggregated card: its project's colour, its id, and what it needs. */
function ProjectCardFront({
  entry,
  colour,
  darkChips,
  onOpen,
  onAnswer,
  onDragState,
}: {
  entry: ProjectCard;
  colour: string;
  darkChips: boolean;
  onOpen: () => void;
  onAnswer: () => void;
  onDragState: (dragging: boolean) => void;
}) {
  const { card, board } = entry;
  const name = projectName(board.path);
  return (
    <article
      className="multi-card"
      draggable
      tabIndex={0}
      // the project qualifies the id: two boards both have a c001
      aria-label={`${name}/${card.id}: ${card.title}`}
      style={{ borderLeftColor: colour }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData(CARD_DRAG_TYPE, entry.key);
        event.dataTransfer.effectAllowed = "move";
        onDragState(true);
      }}
      onDragEnd={() => onDragState(false)}
    >
      <div className="multi-card-meta">
        <span className="multi-card-project" style={tagChipStyle(colour, darkChips)}>
          {name}
        </span>
        <span className="multi-card-id">{card.id}</span>
        {/* c0100: read from the card's own marker, so a parked question shows
            (and answers) with no companion process involved. */}
        {card.awaiting === "input" && (
          <button
            type="button"
            className="multi-card-needs-input"
            aria-label="Needs input"
            title="Needs input — answer the open question"
            onClick={(event) => {
              event.stopPropagation();
              onAnswer();
            }}
          >
            ?
          </button>
        )}
      </div>
      <p className="multi-card-title">{card.title}</p>
    </article>
  );
}

/** The card detail, scoped to the project that owns the card: every option it
 *  offers and every write it makes belongs to that board. */
function ProjectCardDetail({
  entry,
  onWrite,
  onOpenKey,
  onClose,
}: {
  entry: ProjectCard;
  onWrite: (entry: ProjectCard, act: (fresh: Card) => MoveResult) => Promise<void>;
  onOpenKey: (key: string) => void;
  onClose: () => void;
}) {
  const { board, card } = entry;
  const { model, root } = board;
  const group = model.epics.find((epic) => epic.cards.some((c) => c.path === card.path));
  const milestoneOptions: MilestoneOption[] = [
    ...model.epics
      .filter((epic) => epic.epic !== null)
      .map((epic) => ({
        folder: epic.folder,
        milestoneId: epic.epic!.id as string | null,
        label: epic.epic!.title,
      })),
    { folder: "cards", milestoneId: null, label: "No epic" },
  ];

  /** c015: a full-body edit can't be merged — refuse rather than clobber. */
  const saveEdit = async (edit: CardEdit, force: boolean): Promise<SaveBodyResult> => {
    if (!force) {
      const diskRaw = await readRawOrNull(readFileRaw, `${root}/${card.path}`);
      if (diskRaw === null || diskRaw !== card.raw) return "conflict";
    }
    await onWrite(entry, (fresh) =>
      saveCardEdit(root, fresh, edit, model.config, todayIsoDate()),
    );
    return "saved";
  };

  return (
    <CardDetail
      card={card}
      scopeLabel={projectName(board.path)}
      milestoneLabel={group?.epic?.title ?? group?.folder ?? null}
      columns={model.config.columns}
      milestoneOptions={milestoneOptions}
      onChangeFields={(changes: CardFieldChanges) =>
        void onWrite(entry, (fresh) =>
          saveCardFields(root, fresh, changes, model.config, nowIsoDateTime()),
        )
      }
      onSaveEdit={saveEdit}
      onTriage={(folder, epicId) =>
        void onWrite(entry, (fresh) =>
          triageCard(root, fresh, { folder, epicId }, model.config, nowIsoDateTime()),
        )
      }
      onAnswerQuestion={(newBody) =>
        void onWrite(entry, (fresh) =>
          answerGelloQuestion(root, fresh, newBody, model.config, todayIsoDate()),
        )
      }
      onOpenCardId={(id) => {
        const target = findCardById(model, id);
        if (target) onOpenKey(cardKey(board.path, target.id));
      }}
      loadImage={async (src) => {
        try {
          return await imageDataUrl(`${root}/${resolveFromCard(card.path, src)}`);
        } catch {
          return null;
        }
      }}
      refCard={
        card.ref
          ? {
              exists: findCardById(model, card.ref) !== null,
              title: findCardById(model, card.ref)?.title ?? null,
            }
          : null
      }
      openIssues={openIssuesFor(model, card.id)}
      followUps={openFollowUpsFor(model, card.id)}
      dependencies={dependenciesOf(model, card)}
      blocking={blockingCards(model, card.id)}
      dependencyOptions={dependencyOptions(model, card)}
      onClose={onClose}
    />
  );
}
