import { useEffect, useRef } from "react";
import { windowTitle } from "../lib/status";
import { isMacOS } from "../lib/platform";
import { WindowControls } from "./WindowControls";
import "./TitleBar.css";

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
  search,
  onSearch,
}: {
  root: string;
  branch: string | null;
  /** c0066: current fulltext query (owned by the app, applied by the board). */
  search?: string;
  onSearch?: (query: string) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

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

  return (
    // grid: [title | search | filler] — search sits in the bar's true centre;
    // the title keeps its own column and truncates rather than crowding it
    <div className={mac ? "titlebar titlebar-mac" : "titlebar titlebar-win"}>
      <div className="titlebar-left" data-tauri-drag-region>
        <span className="titlebar-caption">{windowTitle(root, branch)}</span>
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
