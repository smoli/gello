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
/** Hover-intent delay before a submenu closes or gives way to a sibling. */
const HOVER_INTENT_MS = 250;

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
      <MenuList
        items={items}
        onClose={onClose}
        className="context-menu"
        style={{ left: position.x, top: position.y }}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

/**
 * One level of the menu. It owns which of its items has its submenu open
 * (i0117) — the state has to sit here, not on each item, so opening one
 * closes the previous one in the same render. With per-item state, the
 * outgoing submenu was still waiting out its close delay while the next one
 * was already up, and both stood on screen for a moment.
 */
function MenuList({
  items,
  onClose,
  className,
  style,
  onClick,
  onMouseEnter,
}: {
  items: ContextMenuItem[];
  onClose: () => void;
  className: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent) => void;
  /** Flyouts use this to cancel the close their parent level scheduled. */
  onMouseEnter?: () => void;
}) {
  /** Label of the item whose submenu is open; null when none is. */
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const cancel = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  // hover-intent: pointing at another item doesn't take effect at once, so
  // travelling diagonally to the open flyout can clip the items it covers
  // (c0063 feedback). One timer per level, so close-this and open-that are a
  // single change — never a moment with two submenus up.
  const schedule = (label: string | null) => {
    cancel();
    timer.current = window.setTimeout(() => setOpenLabel(label), HOVER_INTENT_MS);
  };
  useEffect(() => cancel, []);

  const enter = (item: ContextMenuItem) => {
    const label = item.items ? item.label : null;
    // already showing what this item wants — just call off a pending change
    if (openLabel === label) return cancel();
    // nothing to swap out: open straight away, no waiting on a delay
    if (openLabel === null) {
      cancel();
      return setOpenLabel(label);
    }
    schedule(label);
  };

  return (
    <div
      className={className}
      role="menu"
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {items.map((item) => (
        <MenuItem
          key={item.label}
          item={item}
          onClose={onClose}
          open={openLabel === item.label}
          onEnter={() => enter(item)}
          onLeave={() => schedule(null)}
          onCancel={cancel}
          onToggle={() => {
            cancel();
            setOpenLabel((open) => (open === item.label ? null : item.label));
          }}
        />
      ))}
    </div>
  );
}

function MenuItem({
  item,
  onClose,
  open,
  onEnter,
  onLeave,
  onCancel,
  onToggle,
}: {
  item: ContextMenuItem;
  onClose: () => void;
  /** This item's submenu is the one open at its level. */
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onCancel: () => void;
  onToggle: () => void;
}) {
  if (item.items) {
    return (
      <div className="context-menu-sub" onMouseEnter={onEnter} onMouseLeave={onLeave}>
        <button
          type="button"
          role="menuitem"
          className="context-menu-item"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={onToggle}
        >
          <span>{item.label}</span>
          <span className="context-menu-caret" aria-hidden="true">
            ›
          </span>
        </button>
        {open && (
          <MenuList
            items={item.items}
            onClose={onClose}
            className="context-menu context-menu-submenu"
            onMouseEnter={onCancel}
          />
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
      onMouseEnter={onEnter}
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
