import { windowTitle } from "../lib/status";
import "./TitleBar.css";

/**
 * Frameless custom top bar (c0059): a draggable window-chrome strip showing
 * `gello: <folder> (<branch>)`. The board background bleeds up behind it; on
 * macOS the native traffic lights float over its left inset.
 */
export function TitleBar({
  root,
  branch,
}: {
  root: string;
  branch: string | null;
}) {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <span className="titlebar-caption">{windowTitle(root, branch)}</span>
    </div>
  );
}
