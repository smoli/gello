import { useState } from "react";
import "./ProjectMenu.css";

function baseName(path: string): string {
  return path.replace(/\/+$/, "").split("/").pop() ?? path;
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
        📁 {baseName(currentPath)} ▾
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
