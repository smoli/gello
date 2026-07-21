//! c0110: start the gello-companion from the app by opening the OS terminal
//! running `gello-companion <project-dir>`. The app does not manage the
//! process — the terminal owns its lifetime (Ctrl-C stops it), which keeps the
//! companion's headless independence (c0069) intact and gives the c0104 stream
//! a free log view.
//!
//! Scope is the dev checkout: `gello-companion` is assumed on `PATH` (the
//! README's `pnpm link --global`). Launching from a distributed app (bundled
//! binary) is its own card.

use std::path::{Path, PathBuf};
use std::process::Command;

/// A ready-to-spawn terminal invocation: program + argv, passed straight to
/// `Command` with no shell.
#[derive(Debug, PartialEq, Eq)]
pub struct TerminalCommand {
    pub program: String,
    pub args: Vec<String>,
}

/// File name of the bundled companion (see scripts/build-companion.mjs).
pub const COMPANION_JS: &str = "gello-companion.mjs";

/// Directory holding the bundle, both inside the installed app's resources and
/// in the dev checkout.
pub const COMPANION_DIR: &str = "companion-dist";

/// The first candidate that actually exists (i0118). The installed app finds the
/// bundle in its resource dir; a dev build finds it under `src-tauri/`. `None`
/// means the companion was not shipped — the caller surfaces that.
pub fn companion_js_path(candidates: &[PathBuf]) -> Option<PathBuf> {
    candidates.iter().find(|p| p.is_file()).cloned()
}

/// Build the terminal invocation that runs the bundled companion against
/// `project_dir`, or `None` on a platform we don't launch a terminal for yet
/// (macOS is the dev platform; others are a follow-up). Pure — spawning is
/// separate (`start`), so the construction is unit-testable.
pub fn terminal_command(companion_js: &Path, project_dir: &str) -> Option<TerminalCommand> {
    #[cfg(target_os = "macos")]
    {
        Some(macos_command(companion_js, project_dir))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (companion_js, project_dir);
        None
    }
}

/// macOS: drive Terminal.app via `osascript` to run the companion in a new
/// shell (a login shell, so the user's PATH — with the pnpm global bin —
/// applies, which is why a terminal is opened rather than the process spawned
/// directly).
#[cfg(target_os = "macos")]
fn macos_command(companion_js: &Path, project_dir: &str) -> TerminalCommand {
    // The shell command Terminal runs. Both paths are single-quoted so spaces
    // survive. `node` is checked *here* rather than app-side: a GUI app on macOS
    // does not inherit the login shell's PATH, so an app-side probe would report
    // node missing when the terminal can see it. The guard puts a readable
    // message where the user is already looking.
    let shell_cmd = format!(
        "if ! command -v node >/dev/null 2>&1; then \
           echo 'gello: node was not found on your PATH - install Node.js to run the companion'; \
           exit 1; \
         fi; \
         exec node {} {}",
        shell_single_quote(&companion_js.to_string_lossy()),
        shell_single_quote(project_dir),
    );
    // Wrap it in AppleScript; escape for the double-quoted string literal.
    let script = format!(
        "tell application \"Terminal\" to do script \"{}\"",
        applescript_escape(&shell_cmd),
    );
    TerminalCommand {
        program: "osascript".to_string(),
        args: vec!["-e".to_string(), script],
    }
}

/// POSIX single-quote: wrap in `'…'`; a literal `'` becomes `'\''`.
#[cfg(target_os = "macos")]
fn shell_single_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Escape a string for an AppleScript double-quoted literal: backslash first,
/// then the double quote.
#[cfg(target_os = "macos")]
fn applescript_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Open the OS terminal running the companion for `project_dir`. Returns an
/// error string (surfaced to the user, not swallowed) when the platform is
/// unsupported or the terminal cannot be launched. The child is not retained —
/// the app never tracks or terminates the companion.
pub fn start(companion_js: &Path, project_dir: &str) -> Result<(), String> {
    let cmd = terminal_command(companion_js, project_dir).ok_or_else(|| {
        "starting the companion from the app is supported on macOS only for now — \
         run the companion in a terminal instead"
            .to_string()
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
mod resolve_tests {
    use super::*;

    /// i0118: the shipped app finds the bundle in its resource dir; the dev
    /// checkout finds it under src-tauri/. First existing candidate wins.
    #[test]
    fn picks_the_first_candidate_that_exists() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("resources/gello-companion.mjs");
        let present = dir.path().join("dev/gello-companion.mjs");
        std::fs::create_dir_all(present.parent().unwrap()).unwrap();
        std::fs::write(&present, "// bundle").unwrap();

        assert_eq!(
            companion_js_path(&[missing.clone(), present.clone()]),
            Some(present),
        );
    }

    #[test]
    fn prefers_an_earlier_candidate_when_both_exist() {
        let dir = tempfile::tempdir().unwrap();
        let first = dir.path().join("a/gello-companion.mjs");
        let second = dir.path().join("b/gello-companion.mjs");
        for path in [&first, &second] {
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, "// bundle").unwrap();
        }
        assert_eq!(companion_js_path(&[first.clone(), second]), Some(first));
    }

    #[test]
    fn none_when_the_bundle_is_nowhere() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(companion_js_path(&[dir.path().join("nope.mjs")]), None);
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;
    use std::path::Path;

    fn script_of(js: &str, dir: &str) -> String {
        terminal_command(Path::new(js), dir).unwrap().args[1].clone()
    }

    #[test]
    fn builds_an_osascript_do_script_running_the_bundle_with_node() {
        let cmd = terminal_command(Path::new("/app/gello-companion.mjs"), "/Users/x/proj").unwrap();
        assert_eq!(cmd.program, "osascript");
        assert_eq!(cmd.args.len(), 2);
        assert_eq!(cmd.args[0], "-e");
        // i0118: the companion is no longer assumed on PATH — it is the bundled
        // .mjs run by the user's node.
        assert!(cmd.args[1].starts_with("tell application \"Terminal\" to do script \""));
        assert!(cmd.args[1].contains("node '/app/gello-companion.mjs' '/Users/x/proj'"));
        assert!(!cmd.args[1].contains("gello-companion '"));
    }

    #[test]
    fn tells_the_user_when_node_is_missing_instead_of_failing_bare() {
        // The GUI app's PATH is not the login shell's, so node can only be
        // checked where the command actually runs — in the terminal.
        let script = script_of("/app/c.mjs", "/proj");
        assert!(script.contains("command -v node"));
        assert!(script.to_lowercase().contains("node"));
        assert!(script.contains("exit 1"));
    }

    #[test]
    fn single_quotes_paths_with_spaces() {
        let script = script_of("/my app/c.mjs", "/Users/x/my proj");
        assert!(script.contains("'/my app/c.mjs'"));
        assert!(script.contains("'/Users/x/my proj'"));
    }

    #[test]
    fn escapes_an_embedded_single_quote_the_posix_way() {
        let script = script_of("/app/c.mjs", "/tmp/it's here");
        // POSIX ' → '\'' , then the backslash is doubled for the AppleScript
        // string literal (\\ means one backslash when AppleScript parses it).
        assert!(script.contains("'/tmp/it'\\\\''s here'"));
    }

    #[test]
    fn escapes_a_double_quote_for_the_applescript_string() {
        let script = script_of("/app/c.mjs", "/tmp/a\"b");
        // the embedded " is backslash-escaped so the AppleScript literal is valid
        assert!(script.contains("\\\""));
        assert!(!script.contains("b\"b"));
    }
}
