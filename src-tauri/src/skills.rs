//! Detect agent-skill locations under a project (c032). gello only installs
//! into skill directories that already exist — it never introduces an agent
//! ecosystem into a project that isn't using one.

use std::path::{Path, PathBuf};

/// Skill directories gello knows about, in priority order.
const SKILL_DIRS: [&str; 3] = [".claude/skills", ".pi/skills", ".agents/skills"];

/// The subset of known skill directories that exist under `project_root`.
pub fn detect_skill_dirs(project_root: &Path) -> Vec<PathBuf> {
    SKILL_DIRS
        .iter()
        .map(|rel| project_root.join(rel))
        .filter(|path| path.is_dir())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn detects_only_existing_skill_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join(".claude/skills")).unwrap();
        fs::create_dir_all(root.join(".agents/skills")).unwrap();
        // .pi/skills intentionally absent

        let found = detect_skill_dirs(root);

        assert_eq!(found.len(), 2);
        assert!(found.iter().any(|p| p.ends_with(".claude/skills")));
        assert!(found.iter().any(|p| p.ends_with(".agents/skills")));
        assert!(!found.iter().any(|p| p.ends_with(".pi/skills")));
    }

    #[test]
    fn a_file_named_like_a_skill_dir_does_not_count() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".claude")).unwrap();
        fs::write(dir.path().join(".claude/skills"), "not a dir").unwrap();

        assert!(detect_skill_dirs(dir.path()).is_empty());
    }

    #[test]
    fn empty_when_no_skill_dirs() {
        let dir = tempfile::tempdir().unwrap();
        assert!(detect_skill_dirs(dir.path()).is_empty());
    }
}
