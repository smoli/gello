import type { BoardModel } from "../lib/board";
import { cardCounts, projectFolder } from "../lib/status";
import "./StatusBar.css";

/** Bottom status bar (c0057): project folder, git branch, card counts. */
export function StatusBar({
  root,
  model,
  branch,
}: {
  root: string;
  model: BoardModel;
  /** Current branch, or null when the project is not a git repo. */
  branch: string | null;
}) {
  const folder = projectFolder(root);
  const counts = cardCounts(model);

  return (
    <footer className="status-bar">
      <span className="status-folder" title={folder.path}>
        {folder.name}
      </span>
      <span className="status-branch">
        {branch === null ? "not a git repo" : branch}
      </span>
      <span className="status-counts" aria-label="card counts">
        {counts.map(({ column, count }) => `${column} ${count}`).join(" · ")}
      </span>
    </footer>
  );
}
