import { useEffect } from "react";
import "./ContextMenu.css";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
}

/**
 * i0011: a small positioned context menu for the board background. Replaces
 * the webview's native menu (which c0060 had to suppress) so we can offer
 * app actions — Reload, Background… — with room to grow. An invisible
 * full-window backdrop catches the outside click / right-click that
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
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="context-menu-item"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
