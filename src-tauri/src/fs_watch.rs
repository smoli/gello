//! Recursive watcher on a .gello directory. Reports board-relevant file
//! changes (md/yaml/yml, never our own atomic-write temp files) to a
//! callback; the frontend debounces and reconciles.

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};

/// Should this changed path be reported? Filters out our atomic-write temp
/// files and anything that is not board data.
pub fn is_board_change(path: &Path) -> bool {
    let name = match path.file_name().and_then(|n| n.to_str()) {
        Some(name) => name,
        None => return false,
    };
    if name.contains(".gello-tmp.") {
        return false;
    }
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("md") | Some("yaml") | Some("yml")
    )
}

/// Start watching `root` recursively. `on_change` receives absolute paths of
/// board-relevant changes. The returned watcher must be kept alive.
pub fn start_watching<F>(root: &Path, on_change: F) -> notify::Result<RecommendedWatcher>
where
    F: Fn(Vec<PathBuf>) + Send + 'static,
{
    let mut watcher = notify::recommended_watcher(
        move |result: notify::Result<notify::Event>| {
            if let Ok(event) = result {
                let paths: Vec<PathBuf> = event
                    .paths
                    .into_iter()
                    .filter(|path| is_board_change(path))
                    .collect();
                if !paths.is_empty() {
                    on_change(paths);
                }
            }
        },
    )?;
    watcher.watch(root, RecursiveMode::Recursive)?;
    Ok(watcher)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn board_change_filter() {
        assert!(is_board_change(Path::new("/b/inbox/c001-idea.md")));
        assert!(is_board_change(Path::new("/b/board.yaml")));
        assert!(!is_board_change(Path::new("/b/inbox/.c001-idea.md.gello-tmp.1.2")));
        assert!(!is_board_change(Path::new("/b/assets/c001/shot.png")));
        assert!(!is_board_change(Path::new("/b/inbox/.gitkeep")));
    }

    #[test]
    fn reports_a_created_card_file() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join(".gello");
        fs::create_dir_all(root.join("inbox")).unwrap();

        let (tx, rx) = mpsc::channel::<Vec<PathBuf>>();
        let _watcher = start_watching(&root, move |paths| {
            let _ = tx.send(paths);
        })
        .unwrap();

        // give the OS watcher a moment to arm, then write
        std::thread::sleep(Duration::from_millis(250));
        fs::write(root.join("inbox/c001-idea.md"), "---\nid: c001\n---\n").unwrap();

        let paths = rx
            .recv_timeout(Duration::from_secs(5))
            .expect("watcher must report the change");
        assert!(paths.iter().any(|p| p.ends_with("inbox/c001-idea.md")));
    }

    #[test]
    fn does_not_report_temp_or_asset_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join(".gello");
        fs::create_dir_all(root.join("inbox")).unwrap();
        fs::create_dir_all(root.join("assets")).unwrap();

        let (tx, rx) = mpsc::channel::<Vec<PathBuf>>();
        let _watcher = start_watching(&root, move |paths| {
            let _ = tx.send(paths);
        })
        .unwrap();

        std::thread::sleep(Duration::from_millis(250));
        fs::write(root.join("inbox/.c9.md.gello-tmp.1.0"), "tmp").unwrap();
        fs::write(root.join("assets/shot.png"), "png").unwrap();
        // then one real change as a sentinel
        fs::write(root.join("board.yaml"), "columns: [a]\n").unwrap();

        let paths = rx
            .recv_timeout(Duration::from_secs(5))
            .expect("watcher must report the sentinel");
        assert!(paths.iter().all(|p| p.ends_with("board.yaml")));
    }
}
