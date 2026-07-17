import { useEffect, useState } from "react";
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  onWindowResized,
  toggleMaximizeWindow,
} from "../lib/window";
import "./WindowControls.css";

/**
 * i0017: custom minimize / maximize-restore / close buttons for the frameless
 * Windows/Linux title bar (macOS keeps its native traffic lights, so these are
 * only rendered off-macOS by the TitleBar). Not a drag region, so clicks land.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten = () => {};
    void isWindowMaximized().then(setMaximized);
    void onWindowResized(() => {
      void isWindowMaximized().then(setMaximized);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten();
  }, []);

  return (
    <div className="window-controls">
      <button
        type="button"
        className="window-control"
        aria-label="Minimize"
        onClick={() => void minimizeWindow()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        type="button"
        className="window-control"
        aria-label={maximized ? "Restore" : "Maximize"}
        onClick={() => void toggleMaximizeWindow()}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1" y="2.5" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M3 2.5V1h6v6H7.5" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="window-control window-control-close"
        aria-label="Close"
        onClick={() => void closeWindow()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
}
