//! Detect agent-skill locations under a project (c032/i0010). gello asks when
//! the project already uses an agent ecosystem — i.e. a `.claude`, `.pi`, or
//! `.agents` directory exists — and installs into that root's `skills/`
//! subdirectory (created on install if absent). It never creates the agent
//! root itself, so it won't introduce an ecosystem into a project without one.

use std::path::{Path, PathBuf};

/// Agent ecosystem roots gello knows about, in priority order.
const AGENT_ROOTS: [&str; 3] = [".claude", ".pi", ".agents"];

/// For each agent root that exists under `project_root`, the `skills/`
/// directory to install into (whether or not it exists yet).
pub fn detect_skill_dirs(project_root: &Path) -> Vec<PathBuf> {
    AGENT_ROOTS
        .iter()
        .map(|rel| project_root.join(rel))
        .filter(|root| root.is_dir())
        .map(|root| root.join("skills"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn detects_the_skills_dir_when_the_agent_root_exists() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        // .claude exists but has no skills/ subdir yet
        fs::create_dir_all(root.join(".claude")).unwrap();
        fs::create_dir_all(root.join(".agents/skills")).unwrap();
        // .pi absent

        let found = detect_skill_dirs(root);

        assert_eq!(found.len(), 2);
        assert!(found.iter().any(|p| p.ends_with(".claude/skills")));
        assert!(found.iter().any(|p| p.ends_with(".agents/skills")));
        assert!(!found.iter().any(|p| p.ends_with(".pi/skills")));
    }

    #[test]
    fn ignores_a_file_named_like_an_agent_root() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(".claude"), "not a dir").unwrap();

        assert!(detect_skill_dirs(dir.path()).is_empty());
    }

    #[test]
    fn empty_when_no_agent_root() {
        let dir = tempfile::tempdir().unwrap();
        assert!(detect_skill_dirs(dir.path()).is_empty());
    }
}
