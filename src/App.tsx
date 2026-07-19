import { useEffect, useRef, useState } from "react";
import { Board } from "./components/Board";
import { CaptureForm } from "./components/CaptureForm";
import { CardDetail, type MilestoneOption } from "./components/CardDetail";
import { QuickCapture } from "./components/QuickCapture";
import {
  applyFileChanges,
  findCardById,
  nextCardId,
  nextIssueId,
  openIssuesFor,
  withCardTriaged,
  withNewEpic,
  withNewStandaloneCard,
  withoutCard,
  withUpdatedCard,
  type BoardModel,
} from "./lib/board";
import {
  createIssueFor,
  createCard,
  createEpic,
  deleteCard,
  moveCard,
  nowIsoDateTime,
  renumberCards,
  reorderCard,
  saveCardBody,
  saveCardEdit,
  saveCardFields,
  todayIsoDate,
  triageCard,
  type MoveResult,
} from "./lib/board-actions";
import type { CardEdit } from "./components/CardDetail";
import {
  appFlagGet,
  appFlagSet,
  detectSkillDirs,
  gitBranch,
  imageDataUrl,
  initBoard,
  gitBoardChanges,
  gitCommitBoard,
  gitWorktreeStatus,
  loadBoardAt,
  loadBoardFromDisk,
  migrateLegacyBoard,
  pickFolder,
  type WorktreeStatus,
  pickImageFile,
  readFileRaw,
  removeFile,
  setBoardImage,
  watchBoard,
  watchGitHead,
  writeAsset,
  writeNewFiles,
  type LoadedBoard,
} from "./lib/board-io";
import { readCompanionState, type CompanionState } from "./lib/companion";
import {
  assetLinkPrefix,
  bytesToBase64,
  resolveFromCard,
  suggestedAssetName,
} from "./lib/assets";
import { addRecent, normalizeRecent, parseRecent, serializeRecent } from "./lib/recent";
import { backgroundCss, classifyBackground } from "./lib/background";
import { removeBoardKey, setBoardKey } from "./lib/boardyaml";
import { ProjectMenu } from "./components/ProjectMenu";
import { BackgroundPicker } from "./components/BackgroundPicker";
import { ContextMenu } from "./components/ContextMenu";
import { MilestonePicker } from "./components/MilestonePicker";
import { projectFolder } from "./lib/status";
import {
  ALL_SKILLS,
  dirsNeedingInstall,
  installDecision,
  managedSkillFile,
  resolveInstallTargets,
  skillFilePath,
} from "./lib/skills";
import { TitleBar } from "./components/TitleBar";
import { SkillPrompt } from "./components/SkillPrompt";
import { MigrationGate } from "./components/MigrationGate";
import { EpicDetail } from "./components/EpicDetail";

// i0010: the "don't ask about skills" choice is per-project, not global —
// a global flag bled the decision across every project.
const skillsDismissedKey = (projectPath: string) =>
  `skills-prompt-dismissed:${projectPath}`;
const RECENT_FLAG = "recent-projects";
const THUMBNAILS_FLAG = "show-thumbnails"; // c0063: board thumbnail toggle
const THEME_FLAG = "theme"; // c0068: "system" | "light" | "dark"
// c0083: per-project auto-commit — off by default, keyed by project path
const autoCommitKey = (projectPath: string) => `auto-commit:${projectPath}`;
const autoCommitWindowKey = (projectPath: string) => `auto-commit-window:${projectPath}`;
const AUTO_COMMIT_DEFAULT_MS = 30_000;

type Theme = "system" | "light" | "dark";
import {
  collapseDuplicateFrontmatterKeys,
  parseCard,
  type Card,
  type CardFieldChanges,
} from "./lib/cards";
import { writeFileAtomic } from "./lib/fs";
import type { InvalidFile } from "./lib/cards";
import { rebaseCard } from "./lib/conflict";
import { buildCommitMessage, type BoardChange } from "./lib/commit-message";
import { toggleTaskItem } from "./lib/markdown";
import type { SaveBodyResult } from "./components/CardDetail";
import "./App.css";

/** Find a card and its milestone display label in the current model. */
function findCard(
  model: BoardModel,
  path: string,
): { card: Card; milestoneLabel: string | null } | null {
  const standalone = model.cards.find((c) => c.path === path);
  if (standalone) return { card: standalone, milestoneLabel: null };
  for (const group of model.epics) {
    const card = group.cards.find((c) => c.path === path);
    if (card) {
      return { card, milestoneLabel: group.epic?.title ?? group.folder };
    }
  }
  return null;
}

function App() {
  const [board, setBoard] = useState<LoadedBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // c0079: legacy-board migration state
  const [migrating, setMigrating] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  // report-issue draft target (c037): the form is open, nothing on disk yet
  const [issueSource, setIssueSource] = useState<Card | null>(null);
  // board background (c047): data URL for an image config.background
  const [backgroundUrl, setBackgroundUrl] = useState<string | undefined>(undefined);
  // c0060: live preview override (color/gradient) + picker position
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgMenu, setBgMenu] = useState<{ x: number; y: number } | null>(null);
  // i0011: right-click background menu (Reload / Background… / room to grow)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  // i0013: an id reserved when an image is pasted into a quick-create draft
  // before the card exists, so the asset folder and the eventual card agree.
  const reservedCreate = useRef<{ type: "task" | "issue"; id: string } | null>(null);
  // i0022: id reserved when an image is pasted into a report-issue draft
  const reservedIssue = useRef<string | null>(null);
  // i0005: a milestone-less inbox card dropped on a triage column, awaiting a
  // milestone pick (or dismissal → apply status only, stay in inbox).
  const [pendingTriage, setPendingTriage] = useState<{
    card: Card;
    status: string;
    order?: number;
  } | null>(null);
  // git branch for the status bar (c0057); null = not a git repo
  const [branch, setBranch] = useState<string | null>(null);
  // c032: skill dirs to offer installation into (empty = no prompt)
  const [skillDirs, setSkillDirs] = useState<string[]>([]);
  // c016: recent project folders (app-local, most-recent first)
  const [recent, setRecent] = useState<string[]>([]);
  // c0063: show first-image thumbnails on board cards (default on, off = "0")
  const [showThumbnails, setShowThumbnails] = useState(true);
  // c0068: theme override — "system" follows the OS (default), else forced
  const [theme, setTheme] = useState<Theme>("system");
  // c0083: per-project auto-commit of board changes (off by default) + window
  const [autoCommit, setAutoCommit] = useState(false);
  const [autoCommitWindowMs, setAutoCommitWindowMs] = useState(AUTO_COMMIT_DEFAULT_MS);
  const [dirty, setDirty] = useState<WorktreeStatus | null>(null);
  // c0100: companion runner state for the title-bar indicator (null = not running)
  const [runner, setRunner] = useState<CompanionState | null>(null);
  // i0028: epic creation + minimal-view selection. openEpicSignal opens the
  // capture form in epic mode from the filter / create-on-triage; epicAssign is
  // the card to assign to the epic once created (create-on-triage).
  const [selectedEpicFolder, setSelectedEpicFolder] = useState<string | null>(null);
  const [openEpicSignal, setOpenEpicSignal] = useState(0);
  const epicAssign = useRef<{ card: Card; status?: string; order?: number } | null>(null);
  // c0066: fulltext search now lives in the top bar; the board filters by it
  const [query, setQuery] = useState("");
  // c017: a picked folder with no .gello — offer to initialize one
  const [initCandidate, setInitCandidate] = useState<string | null>(null);

  const rememberProject = async (boardRoot: string) => {
    const path = projectFolder(boardRoot).path;
    // i0020: normalize so any legacy `.gello` entries in the store collapse
    // onto their project path rather than lingering in the picker.
    const next = normalizeRecent(addRecent(parseRecent(await appFlagGet(RECENT_FLAG)), path));
    setRecent(next);
    await appFlagSet(RECENT_FLAG, serializeRecent(next));
  };

  useEffect(() => {
    let cancelled = false;
    void appFlagGet(RECENT_FLAG).then((r) => {
      if (cancelled) return;
      // i0020: heal legacy `.gello` entries in the store on load, and persist
      // the cleaned list back so the picker shows project folders, not ".gello".
      const normalized = normalizeRecent(parseRecent(r));
      setRecent(normalized);
      void appFlagSet(RECENT_FLAG, serializeRecent(normalized));
    });
    void appFlagGet(THUMBNAILS_FLAG).then((v) => {
      if (!cancelled) setShowThumbnails(v !== "0");
    });
    void appFlagGet(THEME_FLAG).then((v) => {
      if (!cancelled && (v === "light" || v === "dark")) setTheme(v);
    });
    void loadBoardFromDisk()
      .then((loaded) => {
        if (cancelled) return;
        setBoard(loaded);
        if (loaded) void rememberProject(loaded.root);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // i0030: macOS exits *native* fullscreen on an unhandled Escape (the app uses
  // no browser Fullscreen API, so JS can win). Swallow the default action for
  // every Escape in the CAPTURE phase — it runs before any overlay handler that
  // calls stopPropagation (e.g. the capture form), and preventDefault cancels
  // only the default, so the overlays' own Escape-to-dismiss still fires.
  // Leaving fullscreen stays an OS gesture (green button / ⌃⌘F).
  useEffect(() => {
    const swallowEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") event.preventDefault();
    };
    window.addEventListener("keydown", swallowEscape, true);
    return () => window.removeEventListener("keydown", swallowEscape, true);
  }, []);

  // c0068: apply the theme override to the document — "light"/"dark" force the
  // scheme, "system" falls back to following the OS (prefers-color-scheme)
  useEffect(() => {
    document.documentElement.style.colorScheme =
      theme === "system" ? "light dark" : theme;
  }, [theme]);

  // c016: open a different project (folder picker or a recent entry). A folder
  // without .gello yields null → the "no board" placeholder (init = c017).
  const openProject = async (folder: string) => {
    setSelectedPath(null);
    const loaded = await loadBoardAt(folder);
    if (loaded) {
      setBoard(loaded);
      setInitCandidate(null);
      await rememberProject(loaded.root);
    } else {
      // c017: no .gello here — offer to initialize one
      setInitCandidate(folder);
    }
  };
  const pickAndOpen = async () => {
    const folder = await pickFolder();
    if (folder) await openProject(folder);
  };
  const initAndOpen = async (folder: string) => {
    await initBoard(folder);
    setInitCandidate(null);
    await openProject(folder);
  };

  // c0079: convert a legacy milestone-format board, then reload it fresh so it
  // renders in the new epic format. On failure the old tree is untouched (the
  // rewrite writes new before removing old), so the gate simply shows the error.
  const handleMigrate = async () => {
    if (!board) return;
    setMigrating(true);
    setMigrateError(null);
    try {
      await migrateLegacyBoard(board.root);
      const reloaded = await loadBoardAt(board.root);
      if (reloaded) setBoard(reloaded);
    } catch (failure: unknown) {
      setMigrateError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setMigrating(false);
    }
  };

  // Live sync: watch the board directory, coalesce event bursts, re-read
  // only the changed files, and reconcile through applyFileChanges — which
  // returns the same model reference for self-write echoes (no re-render).
  const root = board?.root ?? null;

  // c0057/c0059: load the git branch for the title bar, and refresh it live
  // when .git/HEAD changes
  useEffect(() => {
    if (!root) return;
    let stopped = false;
    const refresh = () => {
      void gitBranch(root).then((b) => {
        if (!stopped) setBranch(b);
      });
      // c0083: a .git change (commit/checkout) can flip code-side dirtiness —
      // refresh the indicator on the same cadence as the branch
      void refreshDirtyRef.current();
    };
    refresh();
    const stopPromise = watchGitHead(root, refresh).catch(() => () => {});
    return () => {
      stopped = true;
      void stopPromise.then((stop) => stop());
    };
  }, [root]);

  // c032: on board open, offer to install the discuss skill into detected
  // agent-skill dirs — once, unless the user has said "don't ask".
  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    void (async () => {
      const projectRoot = projectFolder(root).path;
      if ((await appFlagGet(skillsDismissedKey(projectRoot))) !== null) return;
      const targets = resolveInstallTargets(await detectSkillDirs(projectRoot));
      // i0009: only prompt when a skill is actually missing/outdated —
      // otherwise the prompt reappeared on every reload with skills present
      const entries = await Promise.all(
        targets.flatMap((dir) =>
          ALL_SKILLS.map(async (skill) => ({
            dir,
            skill,
            existing: await readFileRaw(skillFilePath(dir, skill)).catch(() => null),
          })),
        ),
      );
      const need = dirsNeedingInstall(entries);
      if (!cancelled && need.length > 0) setSkillDirs(need);
    })();
    return () => {
      cancelled = true;
    };
  }, [root]);

  const handleInstallSkills = async () => {
    const files: Array<{ path: string; content: string }> = [];
    for (const dir of skillDirs) {
      for (const skill of ALL_SKILLS) {
        const path = skillFilePath(dir, skill);
        const existing = await readFileRaw(path).catch(() => null);
        if (installDecision(existing, skill) !== "skip") {
          files.push({ path, content: managedSkillFile(skill) });
        }
      }
    }
    if (files.length > 0) await writeNewFiles(files); // creates skills/ if new
    setSkillDirs([]);
  };

  // c047/c0060: load the image data URL only when the saved background is an
  // image (colors/gradients need no file); previews are color/gradient.
  const savedBackground = board?.model.config.background ?? null;
  const backgroundImagePath =
    savedBackground && classifyBackground(savedBackground) === "image"
      ? savedBackground
      : null;
  useEffect(() => {
    if (!root || !backgroundImagePath) {
      setBackgroundUrl(undefined);
      return;
    }
    let cancelled = false;
    void imageDataUrl(`${root}/${backgroundImagePath}`)
      .then((url) => {
        if (!cancelled) setBackgroundUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBackgroundUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [root, backgroundImagePath]);

  // the CSS background to render: live preview override, else the saved value
  const effectiveBackground =
    backgroundCss(bgPreview ?? savedBackground, backgroundUrl) ?? undefined;

  // c0060: persist a background value via a surgical board.yaml edit
  const writeBoardYaml = async (newRaw: string) => {
    if (!board) return;
    try {
      await writeNewFiles([{ path: `${board.root}/board.yaml`, content: newRaw }]);
      setBgPreview(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };
  const commitBackground = (value: string) => {
    if (!board) return;
    void writeBoardYaml(setBoardKey(board.model.configRaw, "background", value));
  };
  const removeBackground = () => {
    if (!board) return;
    if (savedBackground && classifyBackground(savedBackground) === "image") {
      void removeFile(`${board.root}/${savedBackground}`).catch(() => {});
    }
    void writeBoardYaml(removeBoardKey(board.model.configRaw, "background"));
  };
  const pickBackgroundImage = async () => {
    if (!board) return;
    const source = await pickImageFile();
    if (!source) return;
    const rel = await setBoardImage(board.root, source);
    commitBackground(rel);
    setBgMenu(null);
  };
  // c0083: auto-commit orchestration. Refs keep the debounce timer and the
  // latest settings/handlers stable so the long-lived file watcher can (re)arm
  // the commit without re-subscribing on every settings change.
  const autoCommitRef = useRef(false);
  const windowRef = useRef(AUTO_COMMIT_DEFAULT_MS);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushed = useRef(false);
  autoCommitRef.current = autoCommit;
  windowRef.current = autoCommitWindowMs;

  /** c0083: parse a changed board file into a Card, or null (non-card files
   *  like board.yaml/epic.md aren't itemised in the commit message). */
  const parseChangedCard = (path: string, content: string | null): Card | null => {
    if (!board || content === null) return null;
    const parsed = parseCard(path, content, board.model.config);
    return parsed.ok ? parsed.card : null;
  };

  /** c0083: refresh the title-bar dirty indicator from git. */
  const refreshDirty = async () => {
    if (!board) return;
    setDirty(await gitWorktreeStatus(board.root));
  };
  const refreshDirtyRef = useRef(refreshDirty);
  refreshDirtyRef.current = refreshDirty;

  /** c0100: refresh the title-bar companion indicator from its state file. */
  const refreshCompanion = async () => {
    if (!board) return;
    setRunner(await readCompanionState(board.root));
  };
  const refreshCompanionRef = useRef(refreshCompanion);
  refreshCompanionRef.current = refreshCompanion;

  /** c0083: commit pending `.gello/` changes with a per-card message. The Rust
   *  side skips non-repos, mid-merge states, and a clean board; failure is
   *  surfaced non-fatally and never blocks the board. */
  const runAutoCommit = async () => {
    if (!board) return;
    const raw = await gitBoardChanges(board.root);
    if (!raw) return; // not a git repo
    const changes: BoardChange[] = [];
    for (const change of raw) {
      const before = parseChangedCard(change.path, change.head);
      const after = parseChangedCard(change.path, change.work);
      const card = after ?? before;
      if (card) changes.push({ id: card.id, title: card.title, before, after });
    }
    const message = buildCommitMessage(changes) ?? "board: update";
    const outcome = await gitCommitBoard(board.root, message);
    if (outcome.kind === "failed") {
      setError(`auto-commit failed: ${outcome.message}`);
    }
    await refreshDirty();
  };
  const runAutoCommitRef = useRef(runAutoCommit);
  runAutoCommitRef.current = runAutoCommit;

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
      // c0083: a board change → refresh the dirty indicator and (re)arm the
      // auto-commit debounce so a burst of writes collapses into one commit
      void refreshDirtyRef.current();
      // c0100: a companion run mutates cards, so a board change is a good moment
      // to refresh the runner indicator too (the poll below covers state-only
      // transitions like idle → running before any card is touched)
      void refreshCompanionRef.current();
      if (autoCommitRef.current) {
        clearTimeout(commitTimer.current);
        commitTimer.current = setTimeout(
          () => void runAutoCommitRef.current(),
          windowRef.current,
        );
      }
    }).catch(() => () => {});

    return () => {
      clearTimeout(commitTimer.current);
      stopped = true;
      clearTimeout(timer);
      void stopPromise.then((stop) => stop());
    };
  }, [root]);

  // c0083: load the per-project auto-commit settings + initial dirty state
  // whenever the open project changes (app-local flags keyed by project path).
  useEffect(() => {
    if (!board) {
      setDirty(null);
      return;
    }
    const path = projectFolder(board.root).path;
    let cancelled = false;
    flushed.current = false;
    void appFlagGet(autoCommitKey(path)).then((v) => {
      if (!cancelled) setAutoCommit(v === "1");
    });
    void appFlagGet(autoCommitWindowKey(path)).then((v) => {
      const ms = v ? Number(v) : NaN;
      if (!cancelled) {
        setAutoCommitWindowMs(Number.isFinite(ms) && ms > 0 ? ms : AUTO_COMMIT_DEFAULT_MS);
      }
    });
    void refreshDirty();
    return () => {
      cancelled = true;
    };
  }, [root]);

  // c0100: poll the companion state file for the title-bar runner indicator.
  // The companion is a separate process; its state file appears when it starts
  // and vanishes when it stops, so a light 2s poll (plus the reconcile-time
  // refresh above) is simpler and more robust than an OS watch that would have
  // to track the .companion dir coming and going.
  useEffect(() => {
    if (!board) {
      setRunner(null);
      return;
    }
    void refreshCompanionRef.current();
    const id = setInterval(() => void refreshCompanionRef.current(), 2000);
    return () => clearInterval(id);
  }, [root]);

  // c0083: flush any pending (debounced) board commit before the window closes,
  // so the last batch is never left uncommitted. Best-effort; no-op outside Tauri.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        unlisten = await win.onCloseRequested(async (event) => {
          if (!autoCommitRef.current || flushed.current) return;
          flushed.current = true;
          event.preventDefault();
          clearTimeout(commitTimer.current);
          await runAutoCommitRef.current();
          void win.destroy();
        });
      } catch {
        // outside Tauri — nothing to flush
      }
    })();
    return () => unlisten?.();
  }, []);

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

  /**
   * c015: rebase a card on the current disk bytes before a surgical write, so a
   * status/field/task edit merges with an unrelated external change (e.g. an
   * agent rewriting the body while the user drags the card) instead of clobbering
   * it. A read-before-write; the merge itself is the pure `rebaseCard`. Unchanged
   * disk (the common case) returns the same card — nothing to merge.
   */
  const rebaseOnDisk = async (card: Card): Promise<Card> => {
    if (!board) return card;
    let diskRaw: unknown = null;
    try {
      diskRaw = await readFileRaw(`${board.root}/${card.path}`);
    } catch {
      diskRaw = null; // unreadable / just deleted — nothing external to merge
    }
    return rebaseCard(card, typeof diskRaw === "string" ? diskRaw : null, board.model.config);
  };

  const handleMove = async (card: Card, status: string, order?: number) => {
    if (!board || card.status === status) return;
    const fresh = await rebaseOnDisk(card);
    applyAction(() =>
      moveCard(board.root, fresh, status, board.model.config, nowIsoDateTime(), order),
    );
  };

  /** Same-column reposition in a manual column (c056). */
  const handleReorder = async (card: Card, order: number) => {
    if (!board) return;
    const fresh = await rebaseOnDisk(card);
    applyAction(() =>
      reorderCard(board.root, fresh, order, board.model.config, nowIsoDateTime()),
    );
  };

  /** Bulk re-rank when one write can't express the drop position (c056). */
  const handleRenumber = async (ranks: Array<{ card: Card; order: number }>) => {
    if (!board) return;
    const before = board.model;
    // c015: rebase each card on disk so a rank write can't clobber an external edit
    const fresh = await Promise.all(
      ranks.map(async ({ card, order }) => ({ card: await rebaseOnDisk(card), order })),
    );
    try {
      const results = renumberCards(
        board.root,
        fresh,
        board.model.config,
        nowIsoDateTime(),
      );
      setBoard((current) =>
        current
          ? {
              ...current,
              model: results.reduce((m, r) => withUpdatedCard(m, r.card), current.model),
            }
          : current,
      );
      setError(null);
      for (const result of results) {
        result.persisted.catch((failure: unknown) => {
          setBoard((current) => (current ? { ...current, model: before } : current));
          setError(failure instanceof Error ? failure.message : String(failure));
        });
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const handleFieldChanges = async (card: Card, changes: CardFieldChanges) => {
    if (!board) return;
    // c015: merge onto current disk content — a field edit must not clobber an
    // unrelated external change to the same card.
    const fresh = await rebaseOnDisk(card);
    // full datetime so a status change from the detail view stamps
    // status-changed correctly (c056)
    applyAction(() =>
      saveCardFields(board.root, fresh, changes, board.model.config, nowIsoDateTime()),
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

  // i0034: repair a needs-attention card with duplicate frontmatter keys —
  // collapse them (last value wins) and write the file back; the watcher then
  // reloads it as a valid card. Reads current disk bytes so the fix is exact.
  const handleRepairDuplicates = async (entry: InvalidFile) => {
    if (!board) return;
    const path = `${board.root}/${entry.path}`;
    const current = await readFileRaw(path).catch(() => entry.raw);
    const fixed = collapseDuplicateFrontmatterKeys(current);
    if (fixed === null) return;
    try {
      await writeFileAtomic(path, fixed);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const handleToggleTask = async (card: Card, index: number) => {
    if (!board) return;
    // c015: toggle the checkbox on the current disk body, not a stale copy
    const fresh = await rebaseOnDisk(card);
    applyAction(() =>
      saveCardBody(
        board.root,
        fresh,
        toggleTaskItem(fresh.body, index),
        board.model.config,
        todayIsoDate(),
      ),
    );
  };

  const handleCreate = (title: string, body: string, type: "task" | "issue") => {
    if (!board) return;
    // i0013: if an image was pasted into this draft, an id was already reserved
    // for it — create the card under that same id so the asset link resolves.
    const reserved = reservedCreate.current;
    const id = reserved && reserved.type === type ? reserved.id : undefined;
    reservedCreate.current = null;
    applyAction(
      () =>
        createCard(
          board.root,
          board.model,
          { title, body, type: type === "task" ? undefined : type, id },
          todayIsoDate(),
        ),
      withNewStandaloneCard,
    );
  };

  // i0028: create an epic (from ⌘E capture, the epic filter, or create-on-
  // triage), open its minimal detail view, and — for create-on-triage — assign
  // the remembered card to it once the epic file has landed.
  const handleCreateEpic = (title: string, goal: string) => {
    if (!board) return;
    const before = board.model;
    const assign = epicAssign.current;
    epicAssign.current = null;
    try {
      const { epic, folder, persisted } = createEpic(board.root, board.model, {
        title,
        goal,
      });
      setBoard((current) =>
        current ? { ...current, model: withNewEpic(current.model, epic, folder) } : current,
      );
      setSelectedEpicFolder(folder);
      setError(null);
      persisted
        .then(() => {
          if (assign) handleTriage(assign.card, folder, epic.id, assign.status, assign.order);
        })
        .catch((failure: unknown) => {
          setBoard((current) => (current ? { ...current, model: before } : current));
          setSelectedEpicFolder(null);
          setError(failure instanceof Error ? failure.message : String(failure));
        });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  // i0013: persist an image pasted into a quick-create draft. The card has no
  // id yet, so reserve the next one (once per draft) and save under it; new
  // cards land in the inbox, hence the `../` link prefix.
  const handleCaptureImage = async (
    type: "task" | "issue",
    file: File,
  ): Promise<string> => {
    if (!board) throw new Error("no board loaded");
    const existing = reservedCreate.current;
    const id =
      existing && existing.type === type
        ? existing.id
        : type === "issue"
          ? nextIssueId(board.model)
          : nextCardId(board.model);
    reservedCreate.current = { type, id };
    return `../${await persistImage(id, file)}`;
  };

  // c0068: set the theme override and persist it app-locally
  const chooseTheme = (next: Theme) => {
    setTheme(next);
    void appFlagSet(THEME_FLAG, next);
  };

  // c0063: flip the board thumbnail preference and persist it app-locally
  const toggleThumbnails = () => {
    setShowThumbnails((current) => {
      const next = !current;
      void appFlagSet(THUMBNAILS_FLAG, next ? "1" : "0");
      return next;
    });
  };

  // c0083: flip / configure per-project auto-commit (keyed by project path)
  const toggleAutoCommit = () => {
    if (!board) return;
    const path = projectFolder(board.root).path;
    setAutoCommit((current) => {
      const next = !current;
      void appFlagSet(autoCommitKey(path), next ? "1" : "0");
      return next;
    });
  };
  const chooseAutoCommitWindow = (ms: number) => {
    if (!board) return;
    setAutoCommitWindowMs(ms);
    void appFlagSet(autoCommitWindowKey(projectFolder(board.root).path), String(ms));
  };

  const handleDiscardDraft = () => {
    // a reserved id is only consumed on create; abandon it (its asset dir, if
    // any, is a harmless orphan — same as cancelling a card-detail image edit)
    reservedCreate.current = null;
  };

  // i0022: pasting an image into a report-issue draft. The issue has no file
  // yet (c037), so reserve its id once and save under it; the issue is born in
  // the source card's folder, so the link depth follows the source's path.
  const handleIssueImage = async (source: Card, file: File): Promise<string> => {
    if (!board) throw new Error("no board loaded");
    const id = reservedIssue.current ?? nextIssueId(board.model);
    reservedIssue.current = id;
    return `${assetLinkPrefix(source.path)}${await persistImage(id, file)}`;
  };
  const handleDiscardIssueDraft = () => {
    reservedIssue.current = null;
  };

  /** Draft submitted (c037) — only now does the issue come into existence. */
  const submitIssueDraft = (title: string, body: string) => {
    if (!board || !issueSource) return;
    // i0022: create under the id reserved for any pasted image, so its link resolves
    const id = reservedIssue.current ?? undefined;
    reservedIssue.current = null;
    let created: Card | null = null;
    applyAction(
      () => {
        const result = createIssueFor(
          board.root,
          board.model,
          issueSource,
          { title, body, id },
          todayIsoDate(),
        );
        created = result.card;
        return result;
      },
      (model, card) =>
        card.path.startsWith("cards/")
          ? withNewStandaloneCard(model, card)
          : {
              ...model,
              epics: model.epics.map((group) =>
                card.path.includes(`/${group.folder}/`)
                  ? { ...group, cards: [...group.cards, card] }
                  : group,
              ),
            },
    );
    setIssueSource(null);
    if (created !== null) setSelectedPath((created as Card).path);
  };

  const handleTriage = (
    card: Card,
    folder: string,
    epicId: string | null,
    status?: string,
    order?: number,
  ) => {
    if (!board) return;
    const oldPath = card.path;
    applyAction(
      () =>
        triageCard(
          board.root,
          card,
          { folder, epicId },
          board.model.config,
          nowIsoDateTime(),
          status,
          order,
        ),
      (model, moved) => withCardTriaged(model, oldPath, moved, folder),
    );
    // if the detail was open on this card, follow it to its new location —
    // but never open a dialog as a side effect (drag-triage, c028). c0078:
    // standalone (no epic) lands in cards/, an epic in its folder.
    const base = oldPath.slice(oldPath.lastIndexOf("/") + 1);
    // i0029: an epic lands in epics/<folder>/ (was the pre-migration milestones/)
    const newPath = epicId === null ? `cards/${base}` : `epics/${folder}/${base}`;
    setSelectedPath((current) => (current === oldPath ? newPath : current));
  };

  // c0062: permanently delete a card (file + asset folder). Optimistically
  // drops it from the board and closes the detail; reverts on write failure.
  const handleDelete = (card: Card) => {
    if (!board) return;
    const before = board.model;
    const { persisted } = deleteCard(board.root, card);
    setBoard((current) =>
      current ? { ...current, model: withoutCard(current.model, card.path) } : current,
    );
    setSelectedPath((current) => (current === card.path ? null : current));
    setError(null);
    persisted.catch((failure: unknown) => {
      setBoard((current) => (current ? { ...current, model: before } : current));
      setError(failure instanceof Error ? failure.message : String(failure));
    });
  };

  // c011: write image bytes into a card's asset dir; the Rust side dedupes the
  // filename and returns the board-relative path (`assets/<id>/<file>`).
  const persistImage = async (cardId: string, file: File): Promise<string> => {
    if (!board) throw new Error("no board loaded");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const now = nowIsoDateTime(); // 2026-07-17T12:03:01
    const stamp = `${now.slice(0, 10).replace(/-/g, "")}-${now.slice(11).replace(/:/g, "")}`;
    const name = suggestedAssetName(file.name || null, file.type, stamp);
    return writeAsset(board.root, cardId, name, bytesToBase64(bytes));
  };

  // c011: persist an image pasted into an existing card, returning the caret-
  // ready relative link (prefix depends on the card's folder depth).
  const handleSaveImage = async (card: Card, file: File): Promise<string> => {
    return `${assetLinkPrefix(card.path)}${await persistImage(card.id, file)}`;
  };

  // c011: resolve a body image's (card-relative) src to a data URL the webview
  // can display; remote/data URLs pass through, unreadable paths render nothing.
  const handleLoadImage = async (
    card: Card,
    src: string,
  ): Promise<string | null> => {
    if (!board) return null;
    const rel = resolveFromCard(card.path, src);
    if (/^(https?:|data:)/i.test(rel)) return rel;
    try {
      return await imageDataUrl(`${board.root}/${rel}`);
    } catch {
      return null;
    }
  };

  if (loading) return null;

  const initPrompt = initCandidate && (
    <div className="init-prompt" role="dialog" aria-label="initialize board">
      <p className="init-prompt-text">
        No gello board in <code>{initCandidate}</code>. Create one?
      </p>
      <div className="init-prompt-actions">
        <button type="button" onClick={() => void initAndOpen(initCandidate)}>
          Initialize board
        </button>
        <button type="button" onClick={() => setInitCandidate(null)}>
          Cancel
        </button>
      </div>
    </div>
  );

  // c0079: a pre-epic milestone-format board is gated until migrated — the
  // board never renders in the old format.
  if (board && board.legacy) {
    return (
      <div className="app-shell app-shell-frameless">
        <TitleBar root={board.root} branch={branch} dirty={dirty} search={query} onSearch={setQuery} />
        <MigrationGate
          onMigrate={() => void handleMigrate()}
          busy={migrating}
          error={migrateError}
        />
      </div>
    );
  }

  if (board) {
    const selected = selectedPath ? findCard(board.model, selectedPath) : null;
    const milestoneOptions: MilestoneOption[] = [
      ...board.model.epics
        .filter((group) => group.epic !== null)
        .map((group) => ({
          folder: group.folder,
          milestoneId: group.epic!.id as string | null,
          label: group.epic!.title,
        })),
      // c0078: triage to standalone (no epic) → .gello/cards/
      { folder: "cards", milestoneId: null, label: "No epic" },
    ];
    return (
      <div className="app-shell app-shell-frameless">
        <TitleBar
          root={board.root}
          branch={branch}
          dirty={dirty}
          runner={runner}
          search={query}
          onSearch={setQuery}
        />
        {initPrompt}
        {skillDirs.length > 0 && (
          <SkillPrompt
            dirs={skillDirs}
            onInstall={() => void handleInstallSkills()}
            onNotNow={() => setSkillDirs([])}
            onDontAsk={() => {
              void appFlagSet(
                skillsDismissedKey(projectFolder(board.root).path),
                "1",
              );
              setSkillDirs([]);
            }}
          />
        )}
        {error && (
          <div role="alert" className="board-error">
            {error}
          </div>
        )}
        <QuickCapture
          onCreate={handleCreate}
          onCreateEpic={handleCreateEpic}
          onSaveImage={handleCaptureImage}
          onDiscard={handleDiscardDraft}
          openEpicSignal={openEpicSignal}
        />
        <Board
          background={effectiveBackground}
          onBackgroundContextMenu={(x, y) => setCtxMenu({ x, y })}
          model={board.model}
          onNewEpic={() => setOpenEpicSignal((n) => n + 1)}
          onRepairDuplicates={(entry) => void handleRepairDuplicates(entry)}
          toolbarLeading={
            <ProjectMenu
              currentPath={projectFolder(board.root).path}
              recent={recent}
              onOpenRecent={(path) => void openProject(path)}
              onPickFolder={() => void pickAndOpen()}
            />
          }
          onMoveCard={handleMove}
          onSelectCard={(card) => setSelectedPath(card.path)}
          query={query}
          loadImage={showThumbnails ? handleLoadImage : undefined}
          onInboxStatusDrop={(card, status, order) =>
            setPendingTriage({ card, status, order })
          }
          onReorderCard={handleReorder}
          onRenumber={handleRenumber}
        />
        {issueSource && (
          <div className="issue-draft-overlay">
            <CaptureForm
              heading={`New issue for ${issueSource.id}`}
              onSubmit={submitIssueDraft}
              onCancel={() => {
                handleDiscardIssueDraft();
                setIssueSource(null);
              }}
              onSaveImage={(file) => handleIssueImage(issueSource, file)}
            />
          </div>
        )}
        {pendingTriage && (
          <MilestonePicker
            options={milestoneOptions}
            status={pendingTriage.status}
            onPick={(folder, milestoneId) => {
              // c0090: leaving inbox — "No epic" (milestoneId null) just applies
              // the dropped status (the card stays standalone in cards/); an epic
              // pick moves the file into the epic folder + applies the status.
              if (milestoneId === null) {
                handleMove(pendingTriage.card, pendingTriage.status, pendingTriage.order);
              } else {
                handleTriage(
                  pendingTriage.card,
                  folder,
                  milestoneId,
                  pendingTriage.status,
                  pendingTriage.order,
                );
              }
              setPendingTriage(null);
            }}
            onDismiss={() => {
              // c0085: dismiss = cancel the whole drop. No status applied, the
              // card keeps its status and stays in the inbox column; nothing is
              // written. (The dishonest "Stay in inbox" gesture is gone.)
              setPendingTriage(null);
            }}
            onNewEpic={() => {
              // i0028: create a new epic and assign this card to it, keeping the
              // dropped status/slot
              epicAssign.current = {
                card: pendingTriage.card,
                status: pendingTriage.status,
                order: pendingTriage.order,
              };
              setPendingTriage(null);
              setOpenEpicSignal((n) => n + 1);
            }}
          />
        )}
        {ctxMenu && (
          <ContextMenu
            position={ctxMenu}
            onClose={() => setCtxMenu(null)}
            items={[
              { label: "Reload", onSelect: () => window.location.reload() },
              {
                label: "Background…",
                // hand the menu's anchor point to the picker
                onSelect: () => setBgMenu(ctxMenu),
              },
              {
                label: "Theme",
                items: [
                  {
                    label: "Follow OS",
                    checked: theme === "system",
                    onSelect: () => chooseTheme("system"),
                  },
                  {
                    label: "Light",
                    checked: theme === "light",
                    onSelect: () => chooseTheme("light"),
                  },
                  {
                    label: "Dark",
                    checked: theme === "dark",
                    onSelect: () => chooseTheme("dark"),
                  },
                ],
              },
              {
                label: "Settings",
                items: [
                  {
                    label: "Show thumbnails",
                    checked: showThumbnails,
                    onSelect: toggleThumbnails,
                  },
                  {
                    label: "Auto-commit board changes",
                    checked: autoCommit,
                    onSelect: toggleAutoCommit,
                  },
                  {
                    label: "Auto-commit delay",
                    items: [10, 30, 60].map((seconds) => ({
                      label: `${seconds}s`,
                      checked: autoCommitWindowMs === seconds * 1000,
                      onSelect: () => chooseAutoCommitWindow(seconds * 1000),
                    })),
                  },
                ],
              },
            ]}
          />
        )}
        {bgMenu && (
          <BackgroundPicker
            current={savedBackground}
            position={bgMenu}
            onPreview={setBgPreview}
            onCommit={commitBackground}
            onRemove={removeBackground}
            onPickImage={() => void pickBackgroundImage()}
            onClose={() => setBgMenu(null)}
          />
        )}
        {selected && (
          <CardDetail
            // remount per card: navigation resets edit state and drafts
            key={selected.card.path}
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
            onSaveImage={(file) => handleSaveImage(selected.card, file)}
            loadImage={(src) => handleLoadImage(selected.card, src)}
            onDelete={() => handleDelete(selected.card)}
            onReportIssue={() => setIssueSource(selected.card)}
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
            openIssues={openIssuesFor(board.model, selected.card.id)}
            onClose={() => setSelectedPath(null)}
          />
        )}
        {selectedEpicFolder &&
          (() => {
            // i0028: minimal epic view for the selected epic group
            const group = board.model.epics.find((g) => g.folder === selectedEpicFolder);
            if (!group?.epic) return null;
            return (
              <EpicDetail
                epic={group.epic}
                cards={group.cards}
                onClose={() => setSelectedEpicFolder(null)}
                onSelectCard={(card) => {
                  setSelectedEpicFolder(null);
                  setSelectedPath(card.path);
                }}
              />
            );
          })()}
      </div>
    );
  }

  return (
    <main className="app">
      {initPrompt}
      <h1>gello</h1>
      <p className="empty-state">No board loaded.</p>
      <button type="button" className="empty-open" onClick={() => void pickAndOpen()}>
        Open folder…
      </button>
      {recent.length > 0 && (
        <ul className="empty-recent">
          {recent.map((path) => (
            <li key={path}>
              <button type="button" title={path} onClick={() => void openProject(path)}>
                {path.replace(/\/+$/, "").split("/").pop()}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
