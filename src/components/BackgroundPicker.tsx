import { useEffect, useState } from "react";
import {
  classifyBackground,
  formatGradient,
  parseGradient,
  type Gradient,
} from "../lib/background";
import "./BackgroundPicker.css";

type Mode = "image" | "color" | "gradient";

const DEFAULT_COLOR = "#3355aa";
const DEFAULT_GRADIENT: Gradient = { angle: 45, from: "#3355aa", to: "#aa33aa" };

function initialMode(current: string | null): Mode {
  if (!current) return "color";
  return classifyBackground(current);
}

/** Inline background picker (c0060): Image / Color / Gradient with live preview
 *  over the real board; a single write on Apply, revert on Cancel. */
export function BackgroundPicker({
  current,
  position,
  onPreview,
  onCommit,
  onRemove,
  onPickImage,
  onClose,
}: {
  current: string | null;
  position: { x: number; y: number };
  onPreview: (value: string | null) => void;
  onCommit: (value: string) => void;
  onRemove: () => void;
  onPickImage: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode(current));
  const [color, setColor] = useState(
    current && classifyBackground(current) === "color" ? current : DEFAULT_COLOR,
  );
  const [gradient, setGradient] = useState<Gradient>(
    (current && parseGradient(current)) || DEFAULT_GRADIENT,
  );

  const cancel = () => {
    onPreview(null);
    onClose();
  };

  // i0012: Escape dismisses like Cancel (revert the live preview, then close)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // cancel closes over stable callbacks; re-binding each render is harmless
  });

  const pickColor = (value: string) => {
    setColor(value);
    onPreview(value);
  };

  const changeGradient = (next: Gradient) => {
    setGradient(next);
    onPreview(formatGradient(next));
  };

  const commit = () => {
    if (mode === "color") onCommit(color);
    else if (mode === "gradient") onCommit(formatGradient(gradient));
    onClose();
  };

  return (
    <div
      className="bg-picker-backdrop"
      data-testid="bg-picker-backdrop"
      onClick={cancel}
      onContextMenu={(e) => {
        // i0012: a right-click outside dismisses too (no native menu leak)
        e.preventDefault();
        cancel();
      }}
    >
      <div
        className="bg-picker"
        role="dialog"
        aria-label="board background"
        style={{ left: position.x, top: position.y }}
        onClick={(e) => e.stopPropagation()}
      >
      <div className="bg-picker-modes">
        {(["image", "color", "gradient"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={m === mode ? "active" : ""}
            onClick={() => setMode(m)}
          >
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {mode === "image" && (
        <div className="bg-picker-body">
          <button type="button" onClick={onPickImage}>
            Choose image…
          </button>
        </div>
      )}

      {mode === "color" && (
        <div className="bg-picker-body">
          <label>
            Color
            <input
              type="color"
              aria-label="Background color"
              value={color}
              onChange={(e) => pickColor(e.target.value)}
            />
          </label>
        </div>
      )}

      {mode === "gradient" && (
        <div className="bg-picker-body">
          <label>
            From
            <input
              type="color"
              aria-label="Gradient from"
              value={gradient.from}
              onChange={(e) => changeGradient({ ...gradient, from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="color"
              aria-label="Gradient to"
              value={gradient.to}
              onChange={(e) => changeGradient({ ...gradient, to: e.target.value })}
            />
          </label>
          <label>
            Angle
            <input
              type="range"
              aria-label="Angle"
              min={0}
              max={360}
              value={gradient.angle}
              onChange={(e) =>
                changeGradient({ ...gradient, angle: Number(e.target.value) })
              }
            />
            <span className="bg-picker-angle">{gradient.angle}°</span>
          </label>
        </div>
      )}

      <div className="bg-picker-actions">
        {mode !== "image" && (
          <button type="button" className="bg-picker-apply" onClick={commit}>
            Apply
          </button>
        )}
        {current && (
          <button type="button" onClick={() => { onRemove(); onClose(); }}>
            Remove
          </button>
        )}
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
      </div>
    </div>
  );
}
