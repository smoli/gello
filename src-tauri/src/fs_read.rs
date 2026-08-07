//! Board file reading: walk a .gello directory into (relative path, content)
//! pairs for the frontend's pure `loadBoard()`, and locate the board root.

use std::path::{Path, PathBuf};

/// One board file, path relative to the .gello root with forward slashes.
#[derive(serde::Serialize, Debug, PartialEq)]
pub struct BoardFileEntry {
    pub path: String,
    pub content: String,
}

const BOARD_EXTENSIONS: [&str; 3] = ["md", "yaml", "yml"];

/// Recursively read all board-relevant files (.md, .yaml, .yml) under `root`,
/// sorted by path. Binary assets and other files are skipped.
pub fn read_board_files(root: &Path) -> std::io::Result<Vec<BoardFileEntry>> {
    let mut files = Vec::new();
    visit(root, root, &mut files)?;
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(files)
}

fn visit(dir: &Path, root: &Path, out: &mut Vec<BoardFileEntry>) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() {
            visit(&path, root, out)?;
            continue;
        }
        let is_board_file = path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| BOARD_EXTENSIONS.contains(&ext));
        if !is_board_file {
            continue;
        }
        let relative = path
            .strip_prefix(root)
            .expect("visited paths are under root")
            .components()
            .map(|c| c.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/");
        out.push(BoardFileEntry {
            path: relative,
            content: std::fs::read_to_string(&path)?,
        });
    }
    Ok(())
}

/// Read one file's current content — used for conflict detection at save time.
pub fn read_file(path: &Path) -> std::io::Result<String> {
    std::fs::read_to_string(path)
}

/// Read one file as base64 — used to serve board background images (c047)
/// into the webview without widening the asset-protocol scope.
pub fn read_file_base64(path: &Path) -> std::io::Result<String> {
    use base64::Engine;
    let bytes = std::fs::read(path)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

/// c0151: turn a board-relative path (a card's reference link, already resolved
/// against the card's folder by the frontend) into an absolute path under
/// `root`. `None` when the path is absolute or climbs out of the board — the
/// app only ever opens files the board itself holds.
pub fn resolve_board_path(root: &Path, relative: &str) -> Option<PathBuf> {
    let mut segments: Vec<&str> = Vec::new();
    if relative.starts_with('/') || relative.starts_with('\\') {
        return None;
    }
    for part in relative.split(['/', '\\']) {
        match part {
            "" | "." => continue,
            ".." => {
                segments.pop()?;
            }
            other => segments.push(other),
        }
    }
    if segments.is_empty() {
        return None;
    }
    Some(segments.iter().fold(root.to_path_buf(), |path, s| path.join(s)))
}

/// c0152: the path the OS file manager is asked to show. `None` unless it is
/// an existing directory — a stale project path or a file is refused here
/// rather than handed to the desktop.
pub fn openable_dir(path: &Path) -> Option<&Path> {
    path.is_dir().then_some(path)
}

/// Walk upwards from `start` looking for a `.gello` directory; return its path.
pub fn find_board_root(start: &Path) -> Option<PathBuf> {
    let mut current = Some(start);
    while let Some(dir) = current {
        let candidate = dir.join(".gello");
        if candidate.is_dir() {
            return Some(candidate);
        }
        current = dir.parent();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn write(path: &Path, content: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    #[test]
    fn reads_md_and_yaml_files_recursively_with_relative_paths() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join(".gello");
        write(&root.join("board.yaml"), "columns: [a]\n");
        write(&root.join("inbox/c001-idea.md"), "idea\n");
        write(&root.join("milestones/m01-x/milestone.md"), "goal\n");
        write(&root.join("milestones/m01-x/c002-card.md"), "card\n");

        let files = read_board_files(&root).unwrap();

        let paths: Vec<&str> = files.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(
            paths,
            vec![
                "board.yaml",
                "inbox/c001-idea.md",
                "milestones/m01-x/c002-card.md",
                "milestones/m01-x/milestone.md",
            ]
        );
        assert_eq!(files[0].content, "columns: [a]\n");
    }

    #[test]
    fn skips_non_board_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join(".gello");
        write(&root.join("board.yaml"), "x\n");
        write(&root.join("inbox/.gitkeep"), "");
        write(&root.join("assets/c003/shot.png"), "\u{0089}PNG fake binary");

        let files = read_board_files(&root).unwrap();

        let paths: Vec<&str> = files.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(paths, vec!["board.yaml"]);
    }

    #[test]
    fn errors_on_missing_root() {
        let dir = tempfile::tempdir().unwrap();

        let result = read_board_files(&dir.path().join("no-such"));

        assert!(result.is_err());
    }

    #[test]
    fn reads_a_single_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("card.md");
        fs::write(&path, "---\nid: c001\n---\nbody\n").unwrap();

        assert_eq!(read_file(&path).unwrap(), "---\nid: c001\n---\nbody\n");
    }

    #[test]
    fn read_file_errors_on_missing_path() {
        let dir = tempfile::tempdir().unwrap();

        assert!(read_file(&dir.path().join("nope.md")).is_err());
    }

    #[test]
    fn reads_a_file_as_base64() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bg.png");
        fs::write(&path, [0x89u8, 0x50, 0x4e, 0x47]).unwrap();

        assert_eq!(read_file_base64(&path).unwrap(), "iVBORw==");
    }

    #[test]
    fn read_file_base64_errors_on_missing_path() {
        let dir = tempfile::tempdir().unwrap();

        assert!(read_file_base64(&dir.path().join("nope.png")).is_err());
    }

    #[test]
    fn finds_board_root_from_nested_directory() {
        let dir = tempfile::tempdir().unwrap();
        write(&dir.path().join(".gello/board.yaml"), "x\n");
        let deep = dir.path().join("src/components/deep");
        fs::create_dir_all(&deep).unwrap();

        let found = find_board_root(&deep).unwrap();

        // canonicalize both sides: macOS tempdirs live behind /private symlinks
        assert_eq!(
            found.canonicalize().unwrap(),
            dir.path().join(".gello").canonicalize().unwrap()
        );
    }

    #[test]
    fn returns_none_when_no_board_exists_upwards() {
        let dir = tempfile::tempdir().unwrap();

        assert!(find_board_root(dir.path()).is_none());
    }

    #[test]
    fn a_gello_file_rather_than_directory_does_not_count() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(".gello"), "not a dir").unwrap();

        assert!(find_board_root(dir.path()).is_none());
    }

    // c0151: resolving a reference document's board-relative path

    // c0152: the folder handed to the OS file manager

    #[test]
    fn an_existing_directory_is_openable() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(openable_dir(dir.path()), Some(dir.path()));
    }

    #[test]
    fn a_file_or_a_missing_path_is_not_openable() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("board.yaml");
        write(&file, "columns: [a]\n");

        assert_eq!(openable_dir(&file), None);
        assert_eq!(openable_dir(&dir.path().join("gone")), None);
    }

    #[test]
    fn resolves_a_board_relative_asset_path() {
        let root = Path::new("/repo/.gello");

        assert_eq!(
            resolve_board_path(root, "assets/c0151/spec.pdf"),
            Some(PathBuf::from("/repo/.gello/assets/c0151/spec.pdf"))
        );
    }

    #[test]
    fn refuses_a_path_that_climbs_out_of_the_board() {
        let root = Path::new("/repo/.gello");

        assert_eq!(resolve_board_path(root, "../../etc/passwd"), None);
        assert_eq!(resolve_board_path(root, "assets/../../secrets"), None);
        assert_eq!(resolve_board_path(root, "/etc/passwd"), None);
        assert_eq!(resolve_board_path(root, ""), None);
    }

    #[test]
    fn allows_dots_that_stay_inside_the_board() {
        let root = Path::new("/repo/.gello");

        assert_eq!(
            resolve_board_path(root, "epics/../assets/c1/a.pdf"),
            Some(PathBuf::from("/repo/.gello/assets/c1/a.pdf"))
        );
    }
}
