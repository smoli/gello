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

/// What the git layer can say about a project (i0131). A bare `Option` made
/// "not a repo", "git is missing", "git refused the directory" and "clean" one
/// indistinguishable state, so every git feature switched off in silence.
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum GitStatus {
    /// No `.git` above the board. An ordinary project, not a fault — stays quiet.
    NotARepo,
    /// A repo is there, but git could not answer for it. `message` is git's own
    /// stderr, or the spawn failure when git is not on PATH.
    Unavailable { message: String },
    /// The worktree's dirtiness.
    Status(WorktreeStatus),
}

/// Run `git -C <cwd> <args>`, capturing output. None if git can't be spawned.
fn run_git(cwd: &Path, args: &[&str]) -> Option<std::process::Output> {
    Command::new("git").arg("-C").arg(cwd).args(args).output().ok()
}

/// Run git for its stdout, or the reason it couldn't answer (i0131): the spawn
/// failure when git isn't there, else its stderr.
fn git_output(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(cwd)
        .args(args)
        .output()
        .map_err(|error| format!("could not run git: {error}"))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("git {} failed", args.join(" "))
        } else {
            stderr
        });
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

/// True if the repo containing `git_dir` is mid-merge/rebase/cherry-pick/revert
/// — states where an automated commit would be unsafe.
fn is_mid_operation(git_dir: &Path) -> bool {
    ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"]
        .iter()
        .any(|marker| git_dir.join(marker).exists())
}

/// The repo's top-level directory (git's already-resolved absolute path). Err
/// carries git's reason (i0131).
fn repo_top(root: &Path) -> Result<PathBuf, String> {
    Ok(PathBuf::from(git_output(root, &["rev-parse", "--show-toplevel"])?.trim()))
}

/// The `.gello/`-relative prefix within the repo (e.g. "proj/.gello/", empty
/// when the board dir *is* the repo top), used to classify porcelain paths as
/// board vs code. `root` is the `.gello` dir. Err carries git's reason (i0131).
///
/// Asked of git rather than worked out here (i0127). Deriving it meant
/// comparing two spellings of the same directory — git's `--show-toplevel`
/// against a canonicalized `root` — and on Windows those diverge in ways no
/// amount of string normalization settles: the extended-length prefix
/// (i0126), and a substituted or mapped drive, where `canonicalize` resolves
/// `X:\proj` through to `C:/proj` or `//server/share/proj` while git, run with
/// its cwd on `X:`, answers `X:/proj`. A failed match returned None, which
/// switched off both the status indicator and auto-commit. `--show-prefix`
/// takes the same cwd git already resolved and prints what is wanted directly
/// — forward slashes, trailing separator, no second spelling to reconcile.
fn board_prefix(root: &Path) -> Result<String, String> {
    Ok(git_output(root, &["rev-parse", "--show-prefix"])?.trim().to_string())
}

/// A changed board file (c0083): repo-top-relative path plus its content at HEAD
/// (`head`, None if newly added) and in the worktree (`work`, None if deleted).
/// The frontend parses both to build the per-card commit message.
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct BoardChange {
    pub path: String,
    pub head: Option<String>,
    pub work: Option<String>,
}

/// The changed board files, or why git couldn't list them (i0131) — the
/// auto-commit half of the same silence `GitStatus` fixes for the indicator.
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum BoardChanges {
    /// No `.git` above the board — nothing to commit into, and not a fault.
    NotARepo,
    /// A repo is there, but git could not answer for it.
    Unavailable { message: String },
    /// Every changed file under `.gello/` (added/modified/deleted, incl.
    /// untracked), with its HEAD and worktree content. Empty = clean.
    Changes { changes: Vec<BoardChange> },
}

/// Every changed file under `.gello/` with its HEAD and worktree content, or the
/// reason git couldn't say. Repo-ness is a filesystem question (see
/// `worktree_status`), so a missing git binary reads as unavailable, not absent.
pub fn board_changes(root: &Path) -> BoardChanges {
    if find_git_dir(root).is_none() {
        return BoardChanges::NotARepo;
    }
    let top = match repo_top(root) {
        Ok(top) => top,
        Err(message) => return BoardChanges::Unavailable { message },
    };
    let prefix = match board_prefix(root) {
        Ok(prefix) => prefix,
        Err(message) => return BoardChanges::Unavailable { message },
    };
    // run from the repo top with a pathspec so porcelain paths are top-relative;
    // -uall expands untracked directories to individual files
    let text = match git_output(&top, &["status", "--porcelain", "-uall", "--", &prefix]) {
        Ok(text) => text,
        Err(message) => return BoardChanges::Unavailable { message },
    };
    let mut changes = Vec::new();
    for line in text.lines() {
        if line.len() < 4 {
            continue;
        }
        let path = &line[3..];
        // a rename is "old -> new"; the new path is the current one
        let path = path.rsplit(" -> ").next().unwrap_or(path).to_string();
        let head = run_git(&top, &["show", &format!("HEAD:{path}")])
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string());
        let work = std::fs::read_to_string(top.join(&path)).ok();
        changes.push(BoardChange { path, head, work });
    }
    BoardChanges::Changes { changes }
}

/// Classify the worktree's dirtiness (board vs code), or say why git can't
/// (i0131). Repo-ness is decided by walking the filesystem for `.git`, never by
/// asking git — otherwise a missing git binary reads as "not a repo" and the
/// whole integration disappears without a word.
pub fn worktree_status(root: &Path) -> GitStatus {
    if find_git_dir(root).is_none() {
        return GitStatus::NotARepo;
    }
    let prefix = match board_prefix(root) {
        Ok(prefix) => prefix,
        Err(message) => return GitStatus::Unavailable { message },
    };
    let text = match git_output(root, &["status", "--porcelain"]) {
        Ok(text) => text,
        Err(message) => return GitStatus::Unavailable { message },
    };
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
    GitStatus::Status(status)
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

    // --- i0126/i0127: locating the board dir inside the repo ----------------

    #[test]
    fn prefix_is_empty_when_the_board_dir_is_the_repo_top() {
        let (dir, _gello) = repo_with_board();
        assert_eq!(board_prefix(dir.path()).as_deref(), Ok(""));
    }

    #[test]
    fn prefix_names_the_board_dir_relative_to_the_repo_top() {
        let (dir, _gello) = repo_with_board();
        let nested = dir.path().join("proj/.gello");
        fs::create_dir_all(&nested).unwrap();
        assert_eq!(board_prefix(&nested).as_deref(), Ok("proj/.gello/"));
    }

    /// i0131: outside a repo the failure carries git's own words, so the caller
    /// can tell "no repo here" from "git could not answer".
    #[test]
    fn prefix_outside_a_repo_reports_gits_reason() {
        let dir = tempfile::tempdir().unwrap();
        let reason = board_prefix(dir.path()).expect_err("not a repo");
        assert!(reason.contains("not a git repository"), "git's reason: {reason}");
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

    /// A repo whose top directory is named `Repo`, plus the same `.gello`
    /// reached through the lowercase spelling `repo`. None on a case-sensitive
    /// filesystem, where that second spelling is simply a missing path.
    fn repo_reached_by_another_spelling() -> Option<(tempfile::TempDir, PathBuf)> {
        let dir = tempfile::tempdir().unwrap();
        let top = dir.path().join("Repo");
        fs::create_dir_all(top.join(".gello/inbox")).unwrap();
        git_run(&top, &["init", "-q", "-b", "main"]);
        git_run(&top, &["config", "user.email", "t@example.com"]);
        git_run(&top, &["config", "user.name", "Test"]);
        fs::write(top.join(".gello/board.yaml"), "columns: [ready]\n").unwrap();
        git_run(&top, &["add", "-A"]);
        git_run(&top, &["commit", "-qm", "init"]);
        let other = dir.path().join("repo/.gello");
        other.is_dir().then_some((dir, other))
    }

    /// i0127: git answers `--show-toplevel` in the directory's real on-disk
    /// spelling no matter how the caller spelled the path, so deriving the
    /// board prefix by comparing that answer against a canonicalized path is
    /// only ever as good as the normalization. On a case-insensitive
    /// filesystem — Windows, and macOS by default — opening the board through
    /// `c:\proj` when git says `C:/Proj` left every git feature switched off:
    /// no status indicator (this card) and no auto-commit (i0126).
    #[test]
    fn board_prefix_survives_a_differently_spelled_path() {
        let Some((_dir, gello)) = repo_reached_by_another_spelling() else {
            return; // case-sensitive filesystem — the spelling doesn't exist
        };
        assert_eq!(board_prefix(&gello).as_deref(), Ok(".gello/"));
    }

    /// The same divergence, at the level the title bar actually consumes: no
    /// status here is what makes the indicator disappear.
    #[test]
    fn worktree_status_survives_a_differently_spelled_path() {
        let Some((_dir, gello)) = repo_reached_by_another_spelling() else {
            return;
        };
        fs::write(gello.join("inbox/c001.md"), "---\nid: c001\n---\n").unwrap();

        assert_eq!(
            worktree_status(&gello),
            GitStatus::Status(WorktreeStatus { board_dirty: true, code_dirty: false })
        );
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
            GitStatus::Status(WorktreeStatus { board_dirty: false, code_dirty: false })
        );
        // board-only dirty
        fs::write(gello.join("inbox/c001.md"), "---\nid: c001\n---\n").unwrap();
        assert_eq!(
            worktree_status(&gello),
            GitStatus::Status(WorktreeStatus { board_dirty: true, code_dirty: false })
        );
        // now also a code change → both
        fs::write(top.join("code.rs"), "x\n").unwrap();
        assert_eq!(
            worktree_status(&gello),
            GitStatus::Status(WorktreeStatus { board_dirty: true, code_dirty: true })
        );
    }

    // --- i0131: a git failure has to say why --------------------------------

    /// A project that is not a repo is the ordinary case, not a fault: stay
    /// quiet. Decided from the filesystem, so it holds with no git installed.
    #[test]
    fn status_says_not_a_repo_outside_a_repo() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(worktree_status(dir.path()), GitStatus::NotARepo);
    }

    /// A `.git` is right there but git cannot answer for it (here: an empty
    /// `.git`, standing in for a broken repo, dubious ownership, or no git on
    /// PATH). Reporting "not a repo" for this is what made i0126/i0127
    /// undiagnosable — it has to carry git's reason instead.
    #[test]
    fn status_reports_why_git_cannot_answer() {
        let dir = tempfile::tempdir().unwrap();
        let gello = dir.path().join(".gello");
        fs::create_dir_all(&gello).unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();

        match worktree_status(&gello) {
            GitStatus::Unavailable { message } => {
                assert!(!message.trim().is_empty(), "the reason must not be empty");
            }
            other => panic!("expected a reason, got {other:?}"),
        }
    }

    /// The board dir being inside a repo is decided by walking the filesystem,
    /// never by asking git — otherwise a missing git binary reads as "no repo".
    #[test]
    fn repo_ness_does_not_depend_on_the_git_binary() {
        let (dir, gello) = repo_with_board();
        assert!(find_git_dir(&gello).is_some());
        assert!(find_git_dir(dir.path().parent().unwrap()).is_none());
    }

    /// The auto-commit half of the same silence: `runAutoCommit` returned on a
    /// None here, so a git that could not answer looked exactly like a project
    /// that never asked for commits.
    #[test]
    fn board_changes_says_not_a_repo_outside_a_repo() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(board_changes(dir.path()), BoardChanges::NotARepo);
    }

    #[test]
    fn board_changes_reports_why_git_cannot_answer() {
        let dir = tempfile::tempdir().unwrap();
        let gello = dir.path().join(".gello");
        fs::create_dir_all(&gello).unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();

        match board_changes(&gello) {
            BoardChanges::Unavailable { message } => {
                assert!(!message.trim().is_empty(), "the reason must not be empty");
            }
            other => panic!("expected a reason, got {other:?}"),
        }
    }

    #[test]
    fn board_changes_reports_head_and_worktree_content() {
        let (dir, gello) = repo_with_board();
        let top = dir.path();
        // modify a committed file and add a new one, both under .gello
        fs::write(gello.join("board.yaml"), "columns: [ready, done]\n").unwrap();
        fs::write(gello.join("inbox/c001.md"), "---\nid: c001\n---\n").unwrap();
        // a code change must be ignored
        fs::write(top.join("code.rs"), "x\n").unwrap();

        let BoardChanges::Changes { mut changes } = board_changes(&gello) else {
            panic!("a repo with board changes must list them");
        };
        changes.sort_by(|a, b| a.path.cmp(&b.path));
        let paths: Vec<&str> = changes.iter().map(|c| c.path.as_str()).collect();
        assert_eq!(paths, vec![".gello/board.yaml", ".gello/inbox/c001.md"]);

        // modified file: head is the old content, work is the new
        let yaml = changes.iter().find(|c| c.path.ends_with("board.yaml")).unwrap();
        assert_eq!(yaml.head.as_deref(), Some("columns: [ready]\n"));
        assert_eq!(yaml.work.as_deref(), Some("columns: [ready, done]\n"));
        // newly added file: no head, has worktree content
        let card = changes.iter().find(|c| c.path.ends_with("c001.md")).unwrap();
        assert_eq!(card.head, None);
        assert_eq!(card.work.as_deref(), Some("---\nid: c001\n---\n"));
    }
}
