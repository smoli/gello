import { useEffect, useRef } from "react";
import type React from "react";
import { insertAt } from "../lib/assets";

/** c011: gather image files from a paste/drop payload (items first, then the
 *  files list), skipping anything that isn't an image. */
export function imageFilesFrom(data: DataTransfer): File[] {
  const files: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length === 0) {
    for (const file of Array.from(data.files ?? [])) {
      if (file.type.startsWith("image/")) files.push(file);
    }
  }
  return files;
}

/**
 * c011/i0013: wire image paste + drop onto a textarea. `onSaveImage` persists
 * one file and returns the ready-to-insert relative path; a Markdown link is
 * spliced at the caret and the caret restored after the async update. Shared
 * by the card-detail editor and the quick-capture draft. Handlers are
 * undefined when no `onSaveImage` is given, so normal text paste is untouched.
 */
export function useImageInsert(
  value: string,
  setValue: (next: string) => void,
  onSaveImage?: (file: File) => Promise<string>,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);

  useEffect(() => {
    if (caretRef.current !== null && ref.current) {
      const pos = caretRef.current;
      caretRef.current = null;
      ref.current.focus();
      ref.current.setSelectionRange(pos, pos);
    }
  });

  const insertImages = async (files: File[]) => {
    if (!onSaveImage || files.length === 0) return;
    const el = ref.current;
    let start = el?.selectionStart ?? value.length;
    let end = el?.selectionEnd ?? value.length;
    let working = value;
    for (const file of files) {
      const path = await onSaveImage(file);
      const alt = file.name.replace(/\.[^.]+$/, "") || "image";
      const result = insertAt(working, start, end, `![${alt}](${path})`);
      working = result.text;
      start = end = result.cursor;
    }
    caretRef.current = start;
    setValue(working);
  };

  if (!onSaveImage) {
    return { ref, onPaste: undefined, onDrop: undefined, onDragOver: undefined };
  }

  return {
    ref,
    onPaste: (event: React.ClipboardEvent) => {
      const files = imageFilesFrom(event.clipboardData);
      if (files.length === 0) return; // leave text/other pastes to the browser
      event.preventDefault();
      void insertImages(files);
    },
    onDrop: (event: React.DragEvent) => {
      const files = imageFilesFrom(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      void insertImages(files);
    },
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
  };
}
