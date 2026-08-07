//! App-local flags: one JSON map under the OS app-config dir (theme, the
//! per-project auto-commit settings, the recent-projects list).

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

/// i0140: commands run on the async runtime, so two `set` calls can overlap.
/// The whole read-modify-write is one critical section — the app is the only
/// writer of this file, so an in-process lock is enough.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

fn read_map(path: &Path) -> HashMap<String, String> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

/// One flag's value, or None when unset (or the file is missing/unreadable).
pub fn get(path: &Path, key: &str) -> Option<String> {
    read_map(path).get(key).cloned()
}

/// Set one flag, keeping every other one. Creates the file and its parent dir.
pub fn set(path: &Path, key: &str, value: &str) -> std::io::Result<()> {
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut map = read_map(path);
    map.insert(key.to_string(), value.to_string());
    let json = serde_json::to_string_pretty(&map).unwrap_or_else(|_| "{}".into());
    crate::fs_write::atomic_write(path, &json)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_one_flag_and_keeps_the_others() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested/flags.json");

        set(&path, "theme", "light").unwrap();
        set(&path, "show-archived", "1").unwrap();

        assert_eq!(get(&path, "theme").as_deref(), Some("light"));
        assert_eq!(get(&path, "show-archived").as_deref(), Some("1"));
        assert_eq!(get(&path, "missing"), None);
    }

    #[test]
    fn unset_flag_of_a_missing_file_is_none() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(get(&dir.path().join("flags.json"), "theme"), None);
    }

    /// i0140: commands run on the async runtime now, so two `app_flag_set`
    /// calls can overlap. Without serialising, the later write is built from a
    /// map read before the earlier one landed and silently drops it.
    #[test]
    fn concurrent_writes_do_not_lose_a_flag() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("flags.json");
        let keys: Vec<String> = (0..24).map(|i| format!("flag-{i}")).collect();

        std::thread::scope(|scope| {
            for key in &keys {
                let path = path.clone();
                scope.spawn(move || set(&path, key, "1").unwrap());
            }
        });

        for key in &keys {
            assert_eq!(get(&path, key).as_deref(), Some("1"), "{key} was lost");
        }
    }
}
