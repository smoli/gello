// Pure derivations for the window title (c0057/c0059): project folder name
// and the title-bar caption.

/** The folder that contains `.gello` — its basename and full path. */
export function projectFolder(root: string): { name: string; path: string } {
  // i0018: separator-agnostic — Windows roots use `\`, POSIX use `/`
  const trimmed = root.replace(/[/\\]+$/, ""); // drop trailing separator(s)
  const path = trimmed.replace(/[/\\]\.gello$/, ""); // strip the .gello segment
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const name = path.slice(cut + 1);
  return { name, path };
}

/** Window/title-bar caption (c0059): `gello: <folder> (<branch>)`, with the
 *  branch and its parens omitted when the project is not a git repo. */
export function windowTitle(root: string, branch: string | null): string {
  const { name } = projectFolder(root);
  return branch ? `gello: ${name} (${branch})` : `gello: ${name}`;
}

