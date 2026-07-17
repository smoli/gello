import { useEffect, useState } from "react";
import { CaptureForm } from "./CaptureForm";
import "./QuickCapture.css";

type CaptureMode = "task" | "issue";

/**
 * The idea inbox: buttons (and global mod+N / mod+I) opening a minimal
 * capture form. Title is the only required field — triage happens later,
 * on the board. Speed is the point.
 */
export function QuickCapture({
  onCreate,
  onSaveImage,
  onDiscard,
}: {
  onCreate: (title: string, body: string, type: CaptureMode) => void;
  /** i0013: persist an image pasted into the draft for a card of `type`. */
  onSaveImage?: (type: CaptureMode, file: File) => Promise<string>;
  /** i0013: the draft was abandoned — drop any reserved id for it. */
  onDiscard?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("task");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "n" || event.key === "i") {
        event.preventDefault();
        setMode(event.key === "i" ? "issue" : "task");
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
          className="quick-capture-button quick-capture-button-issue"
          onClick={() => openAs("issue")}
        >
          + New issue
        </button>
      </div>
    );
  }

  return (
    <CaptureForm
      heading={mode === "issue" ? "New issue" : "New idea"}
      onSubmit={(title, body) => {
        onCreate(title, body, mode);
        setOpen(false);
        setMode("task");
      }}
      onCancel={() => {
        onDiscard?.();
        setOpen(false);
        setMode("task");
      }}
      onSaveImage={onSaveImage ? (file) => onSaveImage(mode, file) : undefined}
    />
  );
}
