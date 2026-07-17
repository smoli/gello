//! Atomic file writes: the only write path in gello.
//!
//! Write to a temp file in the *same directory* (same volume, so the final
//! `rename` is atomic on POSIX), fsync, then rename over the target. A card
//! file must never be observable half-written — agents and editors may read
//! it at any moment.

use std::io::{Error, ErrorKind, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

/// Distinguishes temp files of concurrent writes within this process.
static WRITE_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn atomic_write(path: &Path, contents: &str) -> std::io::Result<()> {
    let dir = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| Error::new(ErrorKind::InvalidInput, "path has no parent directory"))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| Error::new(ErrorKind::InvalidInput, "path has no file name"))?;

    let temp_path = dir.join(format!(
        ".{}.gello-tmp.{}.{}",
        file_name.to_string_lossy(),
        std::process::id(),
        WRITE_COUNTER.fetch_add(1, Ordering::Relaxed),
    ));

    let result = (|| {
        let mut file = std::fs::File::create(&temp_path)?;
        file.write_all(contents.as_bytes())?;
        // flush to disk before the rename makes it visible
        file.sync_all()?;
        std::fs::rename(&temp_path, path)
    })();

    if result.is_err() {
        let _ = std::fs::remove_file(&temp_path);
    }
    result
}

/// Delete one file — used by triage after its content has been rewritten to
/// the new location (write-new-then-delete-old, never the other way around).
pub fn remove_file(path: &Path) -> std::io::Result<()> {
    std::fs::remove_file(path)
}

/// Copy `source` into `<board_root>/assets/board/` as `background.<ext>`,
/// removing any prior `background.*` first (orphan cleanup — the extension may
/// change). Returns the new path relative to the board root (c0060).
pub fn set_board_image(board_root: &Path, source: &Path) -> std::io::Result<String> {
    let dir = board_root.join("assets").join("board");
    std::fs::create_dir_all(&dir)?;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with("background.") {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let file_name = format!("background.{ext}");
    std::fs::copy(source, dir.join(&file_name))?;
    Ok(format!("assets/board/{file_name}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn writes_new_file_with_exact_contents() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("card.md");

        atomic_write(&path, "---\nid: c001\n---\nbody\n").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "---\nid: c001\n---\nbody\n");
    }

    #[test]
    fn overwrites_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("card.md");

        atomic_write(&path, "old").unwrap();
        atomic_write(&path, "new").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
    }

    #[test]
    fn leaves_no_temp_files_behind_on_success() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("card.md");

        atomic_write(&path, "content").unwrap();

        let entries: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(entries, vec![std::ffi::OsString::from("card.md")]);
    }

    #[test]
    fn fails_with_error_and_no_debris_for_missing_directory() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("no-such-dir").join("card.md");

        let result = atomic_write(&path, "content");

        assert!(result.is_err());
        // parent dir of tempdir unchanged: no stray temp files anywhere
        let entries: Vec<_> = fs::read_dir(dir.path()).unwrap().collect();
        assert!(entries.is_empty());
    }

    #[test]
    fn set_board_image_copies_and_cleans_prior_background() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join(".gello");
        // a stale background of a different format
        let board_assets = root.join("assets/board");
        fs::create_dir_all(&board_assets).unwrap();
        fs::write(board_assets.join("background.png"), "old").unwrap();
        // the new source image
        let src = dir.path().join("pic.jpg");
        fs::write(&src, "jpegbytes").unwrap();

        let rel = set_board_image(&root, &src).unwrap();

        assert_eq!(rel, "assets/board/background.jpg");
        assert!(board_assets.join("background.jpg").exists());
        assert!(!board_assets.join("background.png").exists()); // orphan removed
    }

    #[test]
    fn remove_file_deletes_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("card.md");
        fs::write(&path, "x").unwrap();

        remove_file(&path).unwrap();

        assert!(!path.exists());
    }

    #[test]
    fn remove_file_errors_on_missing_path() {
        let dir = tempfile::tempdir().unwrap();

        assert!(remove_file(&dir.path().join("nope.md")).is_err());
    }

    #[test]
    fn concurrent_reader_never_sees_partial_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("card.md");
        // different lengths so a torn write would be detectable
        let a = "A".repeat(64 * 1024);
        let b = "B".repeat(128 * 1024);

        atomic_write(&path, &a).unwrap();

        let stop = Arc::new(AtomicBool::new(false));
        let reader = {
            let stop = Arc::clone(&stop);
            let path = path.clone();
            let (a, b) = (a.clone(), b.clone());
            thread::spawn(move || {
                let mut reads = 0u64;
                while !stop.load(Ordering::Relaxed) {
                    let content = fs::read_to_string(&path).expect("file must always exist");
                    assert!(
                        content == a || content == b,
                        "torn read: {} bytes, starts with {:?}",
                        content.len(),
                        &content[..1]
                    );
                    reads += 1;
                }
                reads
            })
        };

        for _ in 0..100 {
            atomic_write(&path, &b).unwrap();
            atomic_write(&path, &a).unwrap();
        }
        stop.store(true, Ordering::Relaxed);
        let reads = reader.join().unwrap();
        assert!(reads > 0, "reader thread must have observed the file");
    }
}
