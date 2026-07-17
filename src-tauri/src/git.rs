//! Minimal git awareness for the status bar (c0057): find the repo, read
//! `.git/HEAD`, and derive the current branch — a short SHA when detached.
//! Plain file reads only; no git library.

use std::path::{Path, PathBuf};

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
}
