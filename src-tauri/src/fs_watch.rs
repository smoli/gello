//! Recursive watcher on a .gello directory. Reports board-relevant file
//! changes (md/yaml/yml, never our own atomic-write temp files) to a
//! callback; the frontend debounces and reconciles.

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// c0138: the live watchers, one per watch id. The cross-project activity view
/// watches every selected board at once, and its selection may include the board
/// the window already has open — so the key is the caller's watch id, not the
/// root, and the same directory can be watched twice.
///
/// Dropping an entry stops that watcher; nothing else does.
pub struct Registry<W> {
    entries: HashMap<String, W>,
}

impl<W> Registry<W> {
    pub fn new() -> Self {
        Registry {
            entries: HashMap::new(),
        }
    }

    /// Keep `watcher` alive under `id`, replacing — and so stopping — whatever
    /// that id held.
    pub fn insert(&mut self, id: String, watcher: W) {
        self.entries.insert(id, watcher);
    }

    /// Stop the watcher under `id`. An unknown id is tolerated: a stop can
    /// arrive for a watcher that never started.
    pub fn remove(&mut self, id: &str) {
        self.entries.remove(id);
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

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

    // c0138: the cross-project activity view watches every selected board at
    // once, so two watchers must live side by side and report their own root.
    #[test]
    fn two_roots_are_watched_independently() {
        let dir = tempfile::tempdir().unwrap();
        let one = dir.path().join("one/.gello");
        let two = dir.path().join("two/.gello");
        fs::create_dir_all(&one).unwrap();
        fs::create_dir_all(&two).unwrap();

        let (tx_one, rx_one) = mpsc::channel::<Vec<PathBuf>>();
        let (tx_two, rx_two) = mpsc::channel::<Vec<PathBuf>>();
        let mut registry = Registry::new();
        registry.insert(
            "w1".into(),
            start_watching(&one, move |paths| {
                let _ = tx_one.send(paths);
            })
            .unwrap(),
        );
        registry.insert(
            "w2".into(),
            start_watching(&two, move |paths| {
                let _ = tx_two.send(paths);
            })
            .unwrap(),
        );
        assert_eq!(registry.len(), 2);

        std::thread::sleep(Duration::from_millis(250));
        fs::write(one.join("board.yaml"), "columns: [a]\n").unwrap();
        fs::write(two.join("board.yaml"), "columns: [b]\n").unwrap();

        // compared by suffix: macOS reports the resolved /private/var path for a
        // temp dir, so the root each watcher was given is not a literal prefix
        let first = rx_one.recv_timeout(Duration::from_secs(5)).unwrap();
        let second = rx_two.recv_timeout(Duration::from_secs(5)).unwrap();
        assert!(first.iter().all(|p| p.ends_with("one/.gello/board.yaml")));
        assert!(second.iter().all(|p| p.ends_with("two/.gello/board.yaml")));
    }

    #[test]
    fn registry_drops_only_the_watcher_asked_for() {
        let mut registry = Registry::new();
        registry.insert("w1".into(), "watcher one");
        registry.insert("w2".into(), "watcher two");

        registry.remove("w1");
        assert_eq!(registry.len(), 1);

        // an unknown id is tolerated — a stop can arrive for a watcher that
        // never started
        registry.remove("w1");
        assert_eq!(registry.len(), 1);

        // re-using an id replaces (and so stops) the watcher it held
        registry.insert("w2".into(), "watcher three");
        assert_eq!(registry.len(), 1);

        registry.remove("w2");
        assert!(registry.is_empty());
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
