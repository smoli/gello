// c0059: start a native window drag from a background surface. No-op outside
// Tauri (plain browser / tests). Dynamic import keeps the Tauri API out of
// the web bundle path.

export async function startWindowDrag(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch {
    // not running inside a Tauri window
  }
}
