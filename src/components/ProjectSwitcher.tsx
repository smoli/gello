import "./ProjectSwitcher.css";
import { OVERVIEW } from "../lib/switcher";

// c0146: the MRU project-switcher overlay (Alt+Tab model). A view over the
// frozen `recent` snapshot: the App owns the keys and the selection state
// (openSwitcher/cycleSwitcher); this only renders the list and reports clicks.

/** Last path segment, separator-agnostic (Windows `\` and POSIX `/`). */
function baseName(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return trimmed.slice(cut + 1) || path;
}

export function ProjectSwitcher({
  items,
  selected,
  dead,
  onPick,
}: {
  /** Frozen MRU snapshot — current project first. */
  items: string[];
  /** Highlighted index. */
  selected: number;
  /** Paths whose board can no longer be found — shown greyed (c0146). */
  dead: ReadonlySet<string>;
  /** Commit a specific entry (click fallback for the release-to-commit gesture). */
  onPick: (index: number) => void;
}) {
  return (
    <div className="switcher-overlay" role="dialog" aria-label="Switch project">
      <div className="switcher-panel">
        <p className="switcher-heading">Switch project</p>
        <ul className="switcher-list" role="listbox" aria-label="Recent projects">
          {items.map((path, i) => {
            // i0158: the activity view is an entry too — named, never "dead"
            const isOverview = path === OVERVIEW;
            const isDead = dead.has(path);
            const className = [
              "switcher-item",
              i === selected ? "switcher-item-selected" : "",
              isDead ? "switcher-item-dead" : "",
              isOverview ? "switcher-item-overview" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={path}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === selected}
                  className={className}
                  title={isOverview ? "Activity across projects" : path}
                  onClick={() => onPick(i)}
                >
                  <span className="switcher-name">
                    {isOverview ? "Activity across projects" : baseName(path)}
                  </span>
                  {i === 0 && <span className="switcher-tag">current</span>}
                  {isDead && <span className="switcher-missing">not found</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
