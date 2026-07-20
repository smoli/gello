/**
 * i0036: read a file's raw text, tolerating a read that fails or returns
 * nothing — resolves to null instead of rejecting. The board watcher's
 * reconcile awaits one of these per changed path; a rejected read (or, under a
 * reset test mock, a `read` that returns `undefined` rather than a promise)
 * must not reject into the void and exit the suite non-zero.
 */
export async function readRawOrNull(
  read: (path: string) => Promise<string>,
  path: string,
): Promise<string | null> {
  try {
    return (await read(path)) ?? null;
  } catch {
    return null;
  }
}
