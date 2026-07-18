//! Minimal git awareness for the status bar (c0057): find the repo, read
//! `.git/HEAD`, and derive the current branch — a short SHA when detached.
//! Branch reading is plain file reads; the commit/status plumbing (c0083)
//! shells out to `git` (no git library).

use std::path::{Path, PathBuf};
use std::process::Command;

/// Outcome of an auto-commit attempt (c0083), serialized to the frontend.
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum CommitOutcome {
    /// A commit was made.
    Committed,
    /// Nothing under `.gello/` was pending — no commit.
    Nothing,
    /// `root` is not inside a git repo — skipped, not an error.
    NotARepo,
    /// A merge/rebase/cherry-pick/revert is in progress — skipped.
    MidOperation,
    /// git failed; the message is surfaced non-fatally.
    Failed { message: String },
}

/// Whether the worktree is dirty, split by whether the change is board-only
/// (`.gello/`) or includes non-board (code) files (c0083 dirty indicator).
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct WorktreeStatus {
    /// At least one uncommitted change lives under `.gello/`.
    pub board_dirty: bool,
    /// At least one uncommitted change lives outside `.gello/` (code).
    pub code_dirty: bool,
}

/// Run `git -C <cwd> <args>`, capturing output. None if git can't be spawned.
fn run_git(cwd: &Path, args: &[&str]) -> Option<std::process::Output> {
    Command::new("git").arg("-C").arg(cwd).args(args).output().ok()
}

/// True if the repo containing `git_dir` is mid-merge/rebase/cherry-pick/revert
/// — states where an automated commit would be unsafe.
fn is_mid_operation(git_dir: &Path) -> bool {
    ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"]
        .iter()
        .any(|marker| git_dir.join(marker).exists())
}

/// The `.gello/`-relative prefix within the repo (e.g. "proj/.gello/"), used to
/// classify porcelain paths as board vs code. `root` is the `.gello` dir.
fn board_prefix(root: &Path) -> Option<String> {
    let out = run_git(root, &["rev-parse", "--show-toplevel"]).filter(|o| o.status.success())?;
    let top = String::from_utf8(out.stdout).ok()?;
    let top = Path::new(top.trim());
    // canonicalize so a symlinked tempdir (/var → /private/var on macOS) still
    // strips against git's already-resolved toplevel path
    let root = root.canonicalize().ok()?;
    let rel = root.strip_prefix(top).ok()?;
    let mut prefix = rel.to_string_lossy().replace('\\', "/");
    if !prefix.is_empty() {
        prefix.push('/');
    }
    Some(prefix)
}

/// Classify the worktree's dirtiness (board vs code). None when `root` is not
/// inside a git repo.
pub fn worktree_status(root: &Path) -> Option<WorktreeStatus> {
    let prefix = board_prefix(root)?;
    let out = run_git(root, &["status", "--porcelain"]).filter(|o| o.status.success())?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mut status = WorktreeStatus { board_dirty: false, code_dirty: false };
    for line in text.lines() {
        if line.len() < 4 {
            continue;
        }
        // porcelain: "XY <path>" (paths relative to repo top; rename shown as
        // "old -> new" — the new path decides classification)
        let path = &line[3..];
        let path = path.rsplit(" -> ").next().unwrap_or(path);
        if path.starts_with(&prefix) {
            status.board_dirty = true;
        } else {
            status.code_dirty = true;
        }
    }
    Some(status)
}

/// Stage and commit only `.gello/` changes (c0083). A pathspec commit: the
/// user's staged/unstaged code changes are never swept in — that is the
/// load-bearing safety property. `root` is the `.gello` dir, so pathspec `.`
/// scopes both the stage and the commit to the board subtree.
pub fn commit_board(root: &Path, message: &str) -> CommitOutcome {
    let git_dir = match find_git_dir(root) {
        Some(dir) => dir,
        None => return CommitOutcome::NotARepo,
    };
    if is_mid_operation(&git_dir) {
        return CommitOutcome::MidOperation;
    }
    // stage every board change (adds, mods, deletes) under .gello, code untouched
    match run_git(root, &["add", "-A", "--", "."]) {
        Some(out) if out.status.success() => {}
        Some(out) => {
            return CommitOutcome::Failed {
                message: String::from_utf8_lossy(&out.stderr).trim().to_string(),
            };
        }
        None => {
            return CommitOutcome::Failed { message: "could not run git".into() };
        }
    }
    // nothing staged under .gello → nothing to commit
    let staged = run_git(root, &["diff", "--cached", "--quiet", "--", "."]);
    let has_changes = matches!(staged, Some(out) if !out.status.success());
    if !has_changes {
        return CommitOutcome::Nothing;
    }
    match run_git(root, &["commit", "-m", message, "--", "."]) {
        Some(out) if out.status.success() => CommitOutcome::Committed,
        Some(out) => CommitOutcome::Failed {
            message: String::from_utf8_lossy(&out.stderr).trim().to_string(),
        },
        None => CommitOutcome::Failed { message: "could not run git".into() },
    }
}

/// Derive the branch name (or short SHA when detached) from `.git/HEAD`.
pub fn branch_from_head(head: &str) -> String {
    let head = head.trim();
    if let Some(rest) = head.strip_prefix("ref:") {
        // ref: refs/heads/<branch>  →  <branch>
        let reference = rest.trim();
        return reference
            .rsplit('/')
            .next()
            .unwrap_or(reference)
            .to_string();
    }
    // detached HEAD: a raw commit SHA → short form
    head.chars().take(7).collect()
}

/// Locate the `.git` directory for the repo containing `start`, walking up.
/// Handles a `.git` file (worktrees/submodules) pointing elsewhere.
pub fn find_git_dir(start: &Path) -> Option<PathBuf> {
    let mut current = Some(start);
    while let Some(dir) = current {
        let candidate = dir.join(".git");
        if candidate.is_dir() {
            return Some(candidate);
        }
        if candidate.is_file() {
            // `.git` file: "gitdir: <path>"
            let content = std::fs::read_to_string(&candidate).ok()?;
            let path = content.trim().strip_prefix("gitdir:")?.trim();
            let resolved = dir.join(path);
            return Some(resolved);
        }
        current = dir.parent();
    }
    None
}

/// Path to the HEAD file for the repo containing `start`, if any.
pub fn find_head_file(start: &Path) -> Option<PathBuf> {
    find_git_dir(start).map(|git| git.join("HEAD"))
}

/// Current branch (or short SHA) of the repo containing `start`; None when
/// `start` is not inside a git repo.
pub fn git_branch(start: &Path) -> Option<String> {
    let head = find_head_file(start)?;
    let content = std::fs::read_to_string(head).ok()?;
    Some(branch_from_head(&content))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn branch_from_a_ref_head() {
        assert_eq!(branch_from_head("ref: refs/heads/main\n"), "main");
        assert_eq!(
            branch_from_head("ref: refs/heads/feature/status-bar\n"),
            "status-bar"
        );
    }

    #[test]
    fn branch_from_detached_head_is_short_sha() {
        assert_eq!(
            branch_from_head("9f4a1c2b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a\n"),
            "9f4a1c2"
        );
    }

    #[test]
    fn git_branch_reads_a_real_repo_layout() {
        let dir = tempfile::tempdir().unwrap();
        let git = dir.path().join(".git");
        fs::create_dir_all(&git).unwrap();
        fs::write(git.join("HEAD"), "ref: refs/heads/dev\n").unwrap();
        // a nested working path resolves up to the repo
        let nested = dir.path().join("proj/.gello");
        fs::create_dir_all(&nested).unwrap();

        assert_eq!(git_branch(&nested).as_deref(), Some("dev"));
    }

    #[test]
    fn git_branch_is_none_outside_a_repo() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(git_branch(dir.path()), None);
    }

    #[test]
    fn resolves_a_dot_git_file_pointer() {
        let dir = tempfile::tempdir().unwrap();
        let realgit = dir.path().join("realgit");
        fs::create_dir_all(&realgit).unwrap();
        fs::write(realgit.join("HEAD"), "ref: refs/heads/wt\n").unwrap();
        let work = dir.path().join("work");
        fs::create_dir_all(&work).unwrap();
        fs::write(work.join(".git"), "gitdir: ../realgit\n").unwrap();

        assert_eq!(git_branch(&work).as_deref(), Some("wt"));
    }

    // --- c0083: commit / status plumbing -----------------------------------

    fn git_run(cwd: &Path, args: &[&str]) {
        let out = Command::new("git").arg("-C").arg(cwd).args(args).output().unwrap();
        assert!(out.status.success(), "git {:?} failed: {}", args, String::from_utf8_lossy(&out.stderr));
    }

    /// A temp git repo with a committed `.gello/board.yaml`. Returns (dir, gello).
    fn repo_with_board() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let top = dir.path();
        git_run(top, &["init", "-q", "-b", "main"]);
        git_run(top, &["config", "user.email", "t@example.com"]);
        git_run(top, &["config", "user.name", "Test"]);
        let gello = top.join(".gello");
        fs::create_dir_all(gello.join("inbox")).unwrap();
        fs::write(gello.join("board.yaml"), "columns: [ready]\n").unwrap();
        git_run(top, &["add", "-A"]);
        git_run(top, &["commit", "-qm", "init"]);
        (dir, gello)
    }

    fn head_count(top: &Path) -> usize {
        let out = Command::new("git")
            .arg("-C").arg(top).args(["rev-list", "--count", "HEAD"]).output().unwrap();
        String::from_utf8_lossy(&out.stdout).trim().parse().unwrap()
    }

    #[test]
    fn commit_board_commits_only_gello_and_preserves_staged_code() {
        let (dir, gello) = repo_with_board();
        let top = dir.path();
        let before = head_count(top);

        // the user has staged a code change (mid-edit index) …
        fs::write(top.join("code.rs"), "fn main() {}\n").unwrap();
        git_run(top, &["add", "code.rs"]);
        // … and a board file changed
        fs::write(gello.join("inbox/c001.md"), "---\nid: c001\n---\n").unwrap();

        assert_eq!(commit_board(&gello, "board: 1 card updated"), CommitOutcome::Committed);

        // exactly one new commit
        assert_eq!(head_count(top), before + 1);
        // the commit contains only the board file, not the code
        let show = Command::new("git")
            .arg("-C").arg(top).args(["show", "--name-only", "--format=", "HEAD"]).output().unwrap();
        let names = String::from_utf8_lossy(&show.stdout);
        assert!(names.contains(".gello/inbox/c001.md"), "board file committed: {names}");
        assert!(!names.contains("code.rs"), "code must NOT be in the commit: {names}");
        // the staged code change survives, still uncommitted
        let porcelain = Command::new("git")
            .arg("-C").arg(top).args(["status", "--porcelain"]).output().unwrap();
        assert!(String::from_utf8_lossy(&porcelain.stdout).contains("A  code.rs"));
    }

    #[test]
    fn commit_board_reports_nothing_when_no_board_changes() {
        let (dir, gello) = repo_with_board();
        // only a code change exists; nothing under .gello
        fs::write(dir.path().join("code.rs"), "x\n").unwrap();
        assert_eq!(commit_board(&gello, "board: 0"), CommitOutcome::Nothing);
    }

    #[test]
    fn commit_board_skips_outside_a_repo() {
        let dir = tempfile::tempdir().unwrap();
        let gello = dir.path().join(".gello");
        fs::create_dir_all(&gello).unwrap();
        assert_eq!(commit_board(&gello, "x"), CommitOutcome::NotARepo);
    }

    #[test]
    fn commit_board_skips_mid_merge() {
        let (dir, gello) = repo_with_board();
        fs::write(dir.path().join(".git/MERGE_HEAD"), "deadbeef\n").unwrap();
        fs::write(gello.join("inbox/c001.md"), "---\nid: c001\n---\n").unwrap();
        assert_eq!(commit_board(&gello, "x"), CommitOutcome::MidOperation);
    }

    #[test]
    fn worktree_status_classifies_board_vs_code() {
        let (dir, gello) = repo_with_board();
        let top = dir.path();
        // clean
        assert_eq!(
            worktree_status(&gello),
            Some(WorktreeStatus { board_dirty: false, code_dirty: false })
        );
        // board-only dirty
        fs::write(gello.join("inbox/c001.md"), "---\nid: c001\n---\n").unwrap();
        assert_eq!(
            worktree_status(&gello),
            Some(WorktreeStatus { board_dirty: true, code_dirty: false })
        );
        // now also a code change → both
        fs::write(top.join("code.rs"), "x\n").unwrap();
        assert_eq!(
            worktree_status(&gello),
            Some(WorktreeStatus { board_dirty: true, code_dirty: true })
        );
    }

    #[test]
    fn worktree_status_is_none_outside_a_repo() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(worktree_status(dir.path()), None);
    }
}
