//! c0153: open an OS terminal at a folder — the project folder, from the board
//! context menu. Same shape as companion.rs: build the invocation purely (so it
//! is unit-testable), spawn separately, and never retain the child — the
//! terminal window is the user's from then on.

use std::path::Path;
use std::process::Command;

use crate::fs_read;

/// A ready-to-spawn terminal invocation: program + argv, passed straight to
/// `Command` with no shell.
#[derive(Debug, PartialEq, Eq)]
pub struct TerminalCommand {
    pub program: String,
    pub args: Vec<String>,
}

/// Build the invocation that opens a terminal with `dir` as its working
/// directory, or `None` on a platform we don't launch a terminal for yet
/// (macOS is the dev platform, as with the companion).
pub fn open_folder_command(dir: &Path) -> Option<TerminalCommand> {
    #[cfg(target_os = "macos")]
    {
        // `open -a Terminal <dir>` opens a new Terminal window there. The path
        // is its own argv entry, so spaces and quotes need no escaping.
        Some(TerminalCommand {
            program: "open".to_string(),
            args: vec![
                "-a".to_string(),
                "Terminal".to_string(),
                dir.to_string_lossy().into_owned(),
            ],
        })
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = dir;
        None
    }
}

/// Open a terminal at `dir`. Returns an error string (surfaced to the user, not
/// swallowed) when the path is not a directory, the platform is unsupported, or
/// the terminal cannot be launched.
pub fn open_folder(dir: &Path) -> Result<(), String> {
    let dir =
        fs_read::openable_dir(dir).ok_or_else(|| format!("no such folder: {}", dir.display()))?;
    let cmd = open_folder_command(dir).ok_or_else(|| {
        "opening a terminal from the app is supported on macOS only for now".to_string()
    })?;
    let status = Command::new(&cmd.program)
        .args(&cmd.args)
        .status()
        .map_err(|error| format!("could not launch {} ({error})", cmd.program))?;
    if !status.success() {
        return Err(format!("{} exited with {status}", cmd.program));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_file_is_not_opened_in_a_terminal() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("board.yaml");
        std::fs::write(&file, "columns: [a]\n").unwrap();

        let error = open_folder(&file).unwrap_err();
        assert!(error.contains("no such folder"), "{error}");
        assert!(error.contains("board.yaml"), "{error}");
    }

    #[test]
    fn a_missing_folder_is_not_opened_in_a_terminal() {
        let dir = tempfile::tempdir().unwrap();

        let error = open_folder(&dir.path().join("gone")).unwrap_err();
        assert!(error.contains("no such folder"), "{error}");
    }
}

#[cfg(all(test, target_os = "macos"))]
mod macos_tests {
    use super::*;

    #[test]
    fn opens_terminal_at_the_folder() {
        let cmd = open_folder_command(Path::new("/Users/x/proj")).unwrap();

        assert_eq!(cmd.program, "open");
        assert_eq!(cmd.args, vec!["-a", "Terminal", "/Users/x/proj"]);
    }

    #[test]
    fn passes_the_path_as_one_argument_so_spaces_survive() {
        let cmd = open_folder_command(Path::new("/Users/x/my proj")).unwrap();

        assert_eq!(cmd.args.last().unwrap(), "/Users/x/my proj");
    }
}
