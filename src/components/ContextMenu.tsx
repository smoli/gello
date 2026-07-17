import { useEffect, useRef, useState } from "react";
import "./ContextMenu.css";

export interface ContextMenuItem {
  label: string;
  /** Leaf action. Omitted for a submenu parent. */
  onSelect?: () => void;
  /** c0063: nested items — renders as a hover/click submenu. */
  items?: ContextMenuItem[];
  /** c0063: when defined, the item is a toggle showing a check when true. */
  checked?: boolean;
}

/**
 * i0011: a small positioned context menu for the board background. Replaces
 * the webview's native menu (which c0060 had to suppress) so we can offer
 * app actions — Reload, Background…, Settings (c0063) — with room to grow. An
 * invisible full-window backdrop catches the outside click / right-click that
 * dismisses it; Escape does too.
 */
export function ContextMenu({
  position,
  items,
  onClose,
}: {
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="context-menu-backdrop"
      data-testid="context-menu-backdrop"
      onClick={onClose}
      onContextMenu={(event) => {
        // don't fall through to the native menu — just re-dismiss
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="context-menu"
        role="menu"
        style={{ left: position.x, top: position.y }}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => (
          <MenuItem key={item.label} item={item} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

function MenuItem({
  item,
  onClose,
}: {
  item: ContextMenuItem;
  onClose: () => void;
}) {
  const [openSub, setOpenSub] = useState(false);
  // hover-intent: a small delay before closing so moving the pointer from the
  // parent to the flyout doesn't dismiss it mid-crossing (c0063 feedback)
  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenSub(false), 250);
  };
  useEffect(() => cancelClose, []);

  if (item.items) {
    return (
      <div
        className="context-menu-sub"
        onMouseEnter={() => {
          cancelClose();
          setOpenSub(true);
        }}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          role="menuitem"
          className="context-menu-item"
          aria-haspopup="menu"
          aria-expanded={openSub}
          onClick={() => setOpenSub((open) => !open)}
        >
          <span>{item.label}</span>
          <span className="context-menu-caret" aria-hidden="true">
            ›
          </span>
        </button>
        {openSub && (
          <div
            className="context-menu context-menu-submenu"
            role="menu"
            onMouseEnter={cancelClose}
          >
            {item.items.map((sub) => (
              <MenuItem key={sub.label} item={sub} onClose={onClose} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isToggle = item.checked !== undefined;
  return (
    <button
      type="button"
      role={isToggle ? "menuitemcheckbox" : "menuitem"}
      aria-checked={isToggle ? item.checked : undefined}
      className="context-menu-item"
      onClick={() => {
        item.onSelect?.();
        onClose();
      }}
    >
      {isToggle && (
        <span className="context-menu-check" aria-hidden="true">
          {item.checked ? "✓" : ""}
        </span>
      )}
      <span>{item.label}</span>
    </button>
  );
}
