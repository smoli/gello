import { useState } from "react";
import "./ProjectMenu.css";

/** Last path segment, separator-agnostic (Windows `\` and POSIX `/`), cf.
 *  i0018/projectFolder — Windows project paths are backslash-separated. */
function baseName(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return trimmed.slice(cut + 1) || path;
}

/** Flat wireframe folder glyph (stroke = currentColor, no fill). */
function FolderIcon() {
  return (
    <svg
      className="project-menu-icon"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h7A1.5 1.5 0 0 1 19 8.5v9A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5z" />
    </svg>
  );
}

/** Flat wireframe chevron. */
function ChevronIcon() {
  return (
    <svg
      className="project-menu-chevron"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Project switcher (c016): current project + recent list + Open folder. */
export function ProjectMenu({
  currentPath,
  recent,
  onOpenRecent,
  onPickFolder,
}: {
  currentPath: string;
  recent: string[];
  onOpenRecent: (path: string) => void;
  onPickFolder: () => void;
}) {
  const [open, setOpen] = useState(false);
  const others = recent.filter((p) => p !== currentPath);

  return (
    <div className="project-menu">
      <button
        type="button"
        className="project-menu-button"
        onClick={() => setOpen((v) => !v)}
      >
        <FolderIcon />
        <span className="project-menu-name">{baseName(currentPath)}</span>
        <ChevronIcon />
      </button>
      {open && (
        <>
          <div className="project-menu-backdrop" onClick={() => setOpen(false)} />
          <ul className="project-menu-list" role="menu">
            {others.map((path) => (
              <li key={path}>
                <button
                  type="button"
                  role="menuitem"
                  title={path}
                  onClick={() => {
                    setOpen(false);
                    onOpenRecent(path);
                  }}
                >
                  {baseName(path)}
                </button>
              </li>
            ))}
            {others.length > 0 && <li className="project-menu-divider" />}
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onPickFolder();
                }}
              >
                Open folder…
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
