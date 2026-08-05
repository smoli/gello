import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { windowTitle } from "../lib/status";
import { isMacOS } from "../lib/platform";
import type { GitStatus } from "../lib/board-io";
import { isCompanionLive, type CompanionState } from "../lib/companion";
import { WindowControls } from "./WindowControls";
import "./TitleBar.css";

const RUNNER_GLYPH: Record<CompanionState["status"], string> = {
  idle: "○",
  running: "▶",
  waiting: "?",
};

function runnerLabel(runner: CompanionState): string {
  if (runner.status === "running") {
    return `Companion: running (${runner.runs.length} active)`;
  }
  if (runner.status === "waiting") return "Companion: waiting for input";
  return "Companion: idle";
}

/** Phases a run can still be stopped in (c0119) — it is live. A done/error/
 *  aborted run has already ended, so it gets no stop control. */
const STOPPABLE: ReadonlySet<CompanionState["runs"][number]["phase"]> = new Set([
  "running",
  "waiting-for-input",
]);

/** The click-through popover listing the companion's active runs (c0100). c0119
 *  adds a per-run stop when `onStopRun` is provided. */
function RunnerRuns({
  runner,
  onStopRun,
}: {
  runner: CompanionState;
  onStopRun?: (cardId: string) => void;
}) {
  if (runner.runs.length === 0) {
    return <p className="titlebar-runner-empty">No active runs</p>;
  }
  return (
    <ul className="titlebar-runner-list">
      {runner.runs.map((run) => (
        <li key={run.cardId}>
          <span className="titlebar-runner-card">{run.cardId}</span>
          <span className={`titlebar-runner-phase phase-${run.phase}`}>{run.phase}</span>
          {onStopRun && STOPPABLE.has(run.phase) && (
            <button
              type="button"
              className="titlebar-runner-stop"
              aria-label={`Stop run ${run.cardId}`}
              title="Stop this run"
              onClick={() => onStopRun(run.cardId)}
            >
              Stop
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Frameless custom top bar (c0059): a draggable window-chrome strip showing
 * `gello: <folder> (<branch>)`, with the board search box on the right (c0066).
 * The board background bleeds up behind it; on macOS the native traffic lights
 * float over its left inset. Only the caption + filler are drag regions — the
 * search input stays interactive.
 */
export function TitleBar({
  root,
  branch,
  git,
  runner,
  onStartCompanion,
  onStopRun,
  search,
  onSearch,
}: {
  root: string;
  branch: string | null;
  /** c0083/i0131: what git can say — dirtiness, or why it can't answer. */
  git?: GitStatus | null;
  /** c0100: companion runner state (null = companion not running → no icon). */
  runner?: CompanionState | null;
  /** c0110: launch the companion for the open board. Omitted → no Start action. */
  onStartCompanion?: () => void;
  /** c0119: stop a live run from the popover. Omitted → no stop control. */
  onStopRun?: (cardId: string) => void;
  /** c0066: current fulltext query (owned by the app, applied by the board). */
  search?: string;
  onSearch?: (query: string) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const runnerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [runsOpen, setRunsOpen] = useState(false);
  // i0037: fixed-position anchor for the portaled popover (below the glyph).
  const [runsPos, setRunsPos] = useState({ top: 0, left: 0 });

  // i0037: the popover renders in a portal (below), so `.titlebar-left`'s
  // overflow:hidden caption clip can't hide it. Anchor it under the glyph.
  const toggleRuns = () => {
    setRunsOpen((open) => {
      if (!open && runnerRef.current) {
        const rect = runnerRef.current.getBoundingClientRect();
        setRunsPos({ top: rect.bottom + 4, left: rect.left });
      }
      return !open;
    });
  };

  // i0108: dismiss the runs popover on a click anywhere outside it or its
  // toggle button. The popover is portaled to <body>, so a plain onBlur or an
  // ancestor click won't catch it — listen on the document while it's open.
  useEffect(() => {
    if (!runsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (runnerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setRunsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [runsOpen]);

  // c022: Cmd/Ctrl+F focuses search, suppressing the webview's native find
  useEffect(() => {
    if (!onSearch) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSearch]);

  // i0017: macOS keeps native traffic lights (left inset, no custom controls);
  // Windows/Linux run frameless with our own controls on the right.
  const mac = isMacOS();

  // c0110: the runner corner is "status" when a companion is live, "start"
  // otherwise (no state file, or a stale one) — one place, never both.
  const live = isCompanionLive(runner ?? null, Date.now());

  return (
    // grid: [title | search | filler] — search sits in the bar's true centre;
    // the title keeps its own column and truncates rather than crowding it
    <div className={mac ? "titlebar titlebar-mac" : "titlebar titlebar-win"}>
      <div className="titlebar-left" data-tauri-drag-region>
        <span className="titlebar-caption">{windowTitle(root, branch)}</span>
        {/* c0083: uncommitted-changes dot — hollow when only .gello/ is dirty,
            filled/distinct when the dirtiness includes code; nothing when clean */}
        {git?.kind === "status" && (git.board_dirty || git.code_dirty) && (
          <span
            className={
              git.code_dirty
                ? "titlebar-dirty titlebar-dirty-code"
                : "titlebar-dirty titlebar-dirty-board"
            }
            role="status"
            aria-label={
              git.code_dirty
                ? "Uncommitted changes (includes code)"
                : "Uncommitted board changes"
            }
            title={
              git.code_dirty
                ? "Uncommitted changes (includes code)"
                : "Uncommitted board changes"
            }
          >
            {git.code_dirty ? "●" : "○"}
          </span>
        )}
        {/* i0131: git is installed-or-not, willing-or-not — say so in the dot's
            corner rather than rendering a broken integration as "clean" */}
        {git?.kind === "unavailable" && (
          <span
            className="titlebar-dirty titlebar-git-unavailable"
            role="status"
            aria-label={`Git unavailable: ${git.message}`}
            title={`Git unavailable: ${git.message}`}
          >
            ⚠
          </span>
        )}
        {/* c0110: no live companion → offer Start (the same corner as the
            c0100 indicator, so it is start or status, never both). */}
        {!live && onStartCompanion && (
          <button
            type="button"
            className="titlebar-runner titlebar-runner-start"
            aria-label="Start companion"
            title="Start companion — opens a terminal running gello-companion"
            onClick={onStartCompanion}
          >
            ▷
          </button>
        )}
        {/* c0100: companion runner indicator — present only while the companion
            is running (its state file is fresh). Click for the active runs. */}
        {live && runner && (
          <span className="titlebar-runner-wrap">
            <button
              ref={runnerRef}
              type="button"
              className={`titlebar-runner titlebar-runner-${runner.status}`}
              aria-label={runnerLabel(runner)}
              aria-expanded={runsOpen}
              title={runnerLabel(runner)}
              onClick={toggleRuns}
            >
              {RUNNER_GLYPH[runner.status]}
            </button>
            {runsOpen &&
              createPortal(
                <div
                  ref={popoverRef}
                  className="titlebar-runner-popover"
                  role="dialog"
                  aria-label="Companion runs"
                  style={{ top: runsPos.top, left: runsPos.left }}
                >
                  <RunnerRuns runner={runner} onStopRun={onStopRun} />
                </div>,
                document.body,
              )}
          </span>
        )}
      </div>
      {onSearch && (
        <input
          ref={searchRef}
          type="search"
          className="titlebar-search"
          aria-label="Search cards"
          placeholder="Search…"
          value={search ?? ""}
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onSearch("");
          }}
        />
      )}
      <div className="titlebar-right">
        <div className="titlebar-drag" data-tauri-drag-region />
        {!mac && <WindowControls />}
      </div>
    </div>
  );
}
