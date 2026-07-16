import { useEffect, useState } from "react";
import { CaptureForm } from "./CaptureForm";
import "./QuickCapture.css";

type CaptureMode = "task" | "bug";

/**
 * The idea inbox: buttons (and global mod+N / mod+B) opening a minimal
 * capture form. Title is the only required field — triage happens later,
 * on the board. Speed is the point.
 */
export function QuickCapture({
  onCreate,
}: {
  onCreate: (title: string, body: string, type: CaptureMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("task");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "n" || event.key === "b") {
        event.preventDefault();
        setMode(event.key === "b" ? "bug" : "task");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openAs = (nextMode: CaptureMode) => {
    setMode(nextMode);
    setOpen(true);
  };

  if (!open) {
    return (
      <div className="quick-capture-buttons">
        <button
          type="button"
          className="quick-capture-button"
          onClick={() => openAs("task")}
        >
          + New idea
        </button>
        <button
          type="button"
          className="quick-capture-button quick-capture-button-bug"
          onClick={() => openAs("bug")}
        >
          + New bug
        </button>
      </div>
    );
  }

  return (
    <CaptureForm
      heading={mode === "bug" ? "New bug" : "New idea"}
      onSubmit={(title, body) => {
        onCreate(title, body, mode);
        setOpen(false);
        setMode("task");
      }}
      onCancel={() => {
        setOpen(false);
        setMode("task");
      }}
    />
  );
}
