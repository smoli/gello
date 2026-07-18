import { useEffect, useState } from "react";
import { CaptureForm } from "./CaptureForm";
import "./QuickCapture.css";

type CaptureMode = "task" | "issue" | "epic";

/**
 * The idea inbox: buttons (and global mod+N / mod+I / mod+E) opening a minimal
 * capture form. Title is the only required field — triage happens later, on the
 * board. Speed is the point. i0028: mod+E captures an **epic** (title + goal);
 * external entry points (epic filter, create-on-triage) open epic mode via
 * `openEpicSignal`.
 */
export function QuickCapture({
  onCreate,
  onCreateEpic,
  onSaveImage,
  onDiscard,
  openEpicSignal,
}: {
  onCreate: (title: string, body: string, type: "task" | "issue") => void;
  /** i0028: create an epic from a captured title + goal. */
  onCreateEpic: (title: string, goal: string) => void;
  /** i0013: persist an image pasted into the draft for a card of `type`. */
  onSaveImage?: (type: "task" | "issue", file: File) => Promise<string>;
  /** i0013: the draft was abandoned — drop any reserved id for it. */
  onDiscard?: () => void;
  /** i0028: bump to open the form in epic mode from elsewhere (filter/triage). */
  openEpicSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("task");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "n" || event.key === "i" || event.key === "e") {
        event.preventDefault();
        setMode(event.key === "i" ? "issue" : event.key === "e" ? "epic" : "task");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // i0028: an external trigger (epic filter / create-on-triage) opens epic mode.
  // Skip the initial mount (openEpicSignal starts at 0/undefined).
  const [seenSignal, setSeenSignal] = useState(openEpicSignal);
  useEffect(() => {
    if (openEpicSignal !== undefined && openEpicSignal !== seenSignal) {
      setSeenSignal(openEpicSignal);
      setMode("epic");
      setOpen(true);
    }
  }, [openEpicSignal, seenSignal]);

  const openAs = (nextMode: CaptureMode) => {
    setMode(nextMode);
    setOpen(true);
  };

  if (!open) {
    return (
      <div className="quick-capture-buttons">
        <button type="button" className="quick-capture-button" onClick={() => openAs("task")}>
          + New idea
        </button>
        <button
          type="button"
          className="quick-capture-button quick-capture-button-issue"
          onClick={() => openAs("issue")}
        >
          + New issue
        </button>
        <button
          type="button"
          className="quick-capture-button quick-capture-button-epic"
          onClick={() => openAs("epic")}
        >
          + New epic
        </button>
      </div>
    );
  }

  const heading = mode === "issue" ? "New issue" : mode === "epic" ? "New epic" : "New idea";

  return (
    <CaptureForm
      heading={heading}
      detailsLabel={mode === "epic" ? "Goal" : "Details"}
      onSubmit={(title, body) => {
        if (mode === "epic") onCreateEpic(title, body);
        else onCreate(title, body, mode);
        setOpen(false);
        setMode("task");
      }}
      onCancel={() => {
        onDiscard?.();
        setOpen(false);
        setMode("task");
      }}
      // epics have no per-id asset dir; image paste stays task/issue only
      onSaveImage={
        onSaveImage && mode !== "epic" ? (file) => onSaveImage(mode, file) : undefined
      }
    />
  );
}
