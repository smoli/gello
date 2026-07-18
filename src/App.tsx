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
  withNewInboxCard,
  withoutCard,
  withUpdatedCard,
  type BoardModel,
} from "./lib/board";
import {
  createIssueFor,
  createCard,
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
  loadBoardAt,
  loadBoardFromDisk,
  migrateLegacyBoard,
  pickFolder,
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

// i0010: the "don't ask about skills" choice is per-project, not global —
// a global flag bled the decision across every project.
const skillsDismissedKey = (projectPath: string) =>
  `skills-prompt-dismissed:${projectPath}`;
const RECENT_FLAG = "recent-projects";
const THUMBNAILS_FLAG = "show-thumbnails"; // c0063: board thumbnail toggle
const THEME_FLAG = "theme"; // c0068: "system" | "light" | "dark"

type Theme = "system" | "light" | "dark";
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

  const handleMove = (card: Card, status: string, order?: number) => {
    if (!board || card.status === status) return;
    applyAction(() =>
      moveCard(board.root, card, status, board.model.config, nowIsoDateTime(), order),
    );
  };

  /** Same-column reposition in a manual column (c056). */
  const handleReorder = (card: Card, order: number) => {
    if (!board) return;
    applyAction(() =>
      reorderCard(board.root, card, order, board.model.config, nowIsoDateTime()),
    );
  };

  /** Bulk re-rank when one write can't express the drop position (c056). */
  const handleRenumber = (ranks: Array<{ card: Card; order: number }>) => {
    if (!board) return;
    const before = board.model;
    try {
      const results = renumberCards(
        board.root,
        ranks,
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

  const handleFieldChanges = (card: Card, changes: CardFieldChanges) => {
    if (!board) return;
    // full datetime so a status change from the detail view stamps
    // status-changed correctly (c056)
    applyAction(() =>
      saveCardFields(board.root, card, changes, board.model.config, nowIsoDateTime()),
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
      withNewInboxCard,
    );
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
        card.path.startsWith("inbox/")
          ? withNewInboxCard(model, card)
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
    const newPath = epicId === null ? `cards/${base}` : `milestones/${folder}/${base}`;
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
        <TitleBar root={board.root} branch={branch} search={query} onSearch={setQuery} />
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
          onSaveImage={handleCaptureImage}
          onDiscard={handleDiscardDraft}
        />
        <Board
          background={effectiveBackground}
          onBackgroundContextMenu={(x, y) => setCtxMenu({ x, y })}
          model={board.model}
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
            fromStatus={pendingTriage.card.status}
            onPick={(folder, milestoneId) => {
              // i0015: triage into the chosen milestone at the dropped slot
              handleTriage(
                pendingTriage.card,
                folder,
                milestoneId,
                pendingTriage.status,
                pendingTriage.order,
              );
              setPendingTriage(null);
            }}
            onDismiss={() => {
              // Escape hatch, stay in the inbox. A raw backlog idea takes the
              // dropped-on status (c030 flag-it-forward); a card that already
              // carries a flag (e.g. discuss) returns to that status. Keep the
              // dropped slot (i0015) when the status actually changes.
              const from = pendingTriage.card.status;
              const target = from === "backlog" ? pendingTriage.status : from;
              handleMove(pendingTriage.card, target, pendingTriage.order);
              setPendingTriage(null);
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
