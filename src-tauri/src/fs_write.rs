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
    atomic_write_bytes(path, contents.as_bytes())
}

/// Atomic write for arbitrary bytes (c011: pasted/dragged image assets).
pub fn atomic_write_bytes(path: &Path, contents: &[u8]) -> std::io::Result<()> {
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
        file.write_all(contents)?;
        // flush to disk before the rename makes it visible
        file.sync_all()?;
        std::fs::rename(&temp_path, path)
    })();

    if result.is_err() {
        let _ = std::fs::remove_file(&temp_path);
    }
    result
}

/// c011: write an image asset into `<board_root>/assets/<card_id>/`, choosing
/// a collision-free filename derived from `requested_name` (a readable base
/// like `pasted-20260717-120301.png` or a dragged file's own name). If the
/// name is taken, insert `-2`, `-3`, … before the extension. Path separators
/// in the request are stripped so it can never escape the asset dir. Returns
/// the path relative to the board root, for the Markdown link.
pub fn write_asset(
    board_root: &Path,
    card_id: &str,
    requested_name: &str,
    bytes: &[u8],
) -> std::io::Result<String> {
    let safe = sanitize_filename(requested_name);
    let dir = board_root.join("assets").join(card_id);
    std::fs::create_dir_all(&dir)?;
    let name = unique_filename(&dir, &safe);
    atomic_write_bytes(&dir.join(&name), bytes)?;
    Ok(format!("assets/{card_id}/{name}"))
}

/// Strip directory separators and leading dots so a requested asset name is a
/// plain filename that stays inside the asset directory.
fn sanitize_filename(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let trimmed = base.trim_start_matches('.').trim();
    if trimmed.is_empty() {
        "pasted.png".to_string()
    } else {
        trimmed.to_string()
    }
}

/// First free name in `dir` starting from `name`, inserting `-2`, `-3`, …
/// before the extension on collision.
fn unique_filename(dir: &Path, name: &str) -> String {
    if !dir.join(name).exists() {
        return name.to_string();
    }
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{e}")),
        None => (name.to_string(), String::new()),
    };
    let mut n = 2;
    loop {
        let candidate = format!("{stem}-{n}{ext}");
        if !dir.join(&candidate).exists() {
            return candidate;
        }
        n += 1;
    }
}

/// Delete one file — used by triage after its content has been rewritten to
/// the new location (write-new-then-delete-old, never the other way around).
pub fn remove_file(path: &Path) -> std::io::Result<()> {
    std::fs::remove_file(path)
}

/// Recursively remove a directory (c0062: a deleted card's asset folder).
/// Tolerant of a missing path — a card with no attachments has no dir, and
/// deleting it should still succeed.
pub fn remove_dir_all(path: &Path) -> std::io::Result<()> {
    match std::fs::remove_dir_all(path) {
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        other => other,
    }
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
    fn write_asset_creates_dir_and_returns_relative_path() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join(".gello");

        let rel = write_asset(&root, "c011", "pasted-1.png", b"pngbytes").unwrap();

        assert_eq!(rel, "assets/c011/pasted-1.png");
        assert_eq!(
            fs::read(root.join("assets/c011/pasted-1.png")).unwrap(),
            b"pngbytes",
        );
    }

    #[test]
    fn write_asset_dedupes_a_taken_name() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join(".gello");

        let first = write_asset(&root, "c011", "shot.png", b"one").unwrap();
        let second = write_asset(&root, "c011", "shot.png", b"two").unwrap();
        let third = write_asset(&root, "c011", "shot.png", b"three").unwrap();

        assert_eq!(first, "assets/c011/shot.png");
        assert_eq!(second, "assets/c011/shot-2.png");
        assert_eq!(third, "assets/c011/shot-3.png");
        // the original is untouched — no clobber
        assert_eq!(fs::read(root.join("assets/c011/shot.png")).unwrap(), b"one");
    }

    #[test]
    fn write_asset_strips_path_separators_from_the_request() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join(".gello");

        let rel = write_asset(&root, "c011", "../../evil/x.png", b"z").unwrap();

        // no escape: the file lands inside the card's asset dir
        assert_eq!(rel, "assets/c011/x.png");
        assert!(root.join("assets/c011/x.png").exists());
        assert!(!dir.path().join("evil").exists());
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
    fn remove_dir_all_removes_a_populated_dir() {
        let dir = tempfile::tempdir().unwrap();
        let assets = dir.path().join("assets/c0062");
        fs::create_dir_all(&assets).unwrap();
        fs::write(assets.join("shot.png"), "png").unwrap();

        remove_dir_all(&assets).unwrap();

        assert!(!assets.exists());
    }

    #[test]
    fn remove_dir_all_tolerates_a_missing_dir() {
        let dir = tempfile::tempdir().unwrap();
        // a card with no attachments — its asset dir never existed
        assert!(remove_dir_all(&dir.path().join("assets/nope")).is_ok());
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
