//! c0110: start the gello-companion from the app by opening the OS terminal
//! running `gello-companion <project-dir>`. The app does not manage the
//! process — the terminal owns its lifetime (Ctrl-C stops it), which keeps the
//! companion's headless independence (c0069) intact and gives the c0104 stream
//! a free log view.
//!
//! Scope is the dev checkout: `gello-companion` is assumed on `PATH` (the
//! README's `pnpm link --global`). Launching from a distributed app (bundled
//! binary) is its own card.

use std::process::Command;

/// A ready-to-spawn terminal invocation: program + argv, passed straight to
/// `Command` with no shell.
#[derive(Debug, PartialEq, Eq)]
pub struct TerminalCommand {
    pub program: String,
    pub args: Vec<String>,
}

/// The companion command run inside the opened terminal.
const COMPANION_BIN: &str = "gello-companion";

/// Build the terminal invocation that runs `gello-companion <project_dir>`, or
/// `None` on a platform we don't launch a terminal for yet (macOS is the dev
/// platform; others are a follow-up). Pure — spawning is separate (`start`), so
/// the construction is unit-testable.
pub fn terminal_command(project_dir: &str) -> Option<TerminalCommand> {
    #[cfg(target_os = "macos")]
    {
        Some(macos_command(project_dir))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = project_dir;
        None
    }
}

/// macOS: drive Terminal.app via `osascript` to run the companion in a new
/// shell (a login shell, so the user's PATH — with the pnpm global bin —
/// applies, which is why a terminal is opened rather than the process spawned
/// directly).
#[cfg(target_os = "macos")]
fn macos_command(project_dir: &str) -> TerminalCommand {
    // The shell command Terminal runs: single-quote the dir so spaces survive.
    let shell_cmd = format!("{COMPANION_BIN} {}", shell_single_quote(project_dir));
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
pub fn start(project_dir: &str) -> Result<(), String> {
    let cmd = terminal_command(project_dir).ok_or_else(|| {
        "starting the companion from the app is supported on macOS only for now — \
         run `gello-companion <dir>` in a terminal"
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

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn builds_an_osascript_do_script_running_the_companion() {
        let cmd = terminal_command("/Users/x/proj").unwrap();
        assert_eq!(cmd.program, "osascript");
        assert_eq!(cmd.args.len(), 2);
        assert_eq!(cmd.args[0], "-e");
        assert_eq!(
            cmd.args[1],
            "tell application \"Terminal\" to do script \"gello-companion '/Users/x/proj'\"",
        );
    }

    #[test]
    fn single_quotes_a_project_dir_with_spaces() {
        let cmd = terminal_command("/Users/x/my proj").unwrap();
        // the dir is single-quoted so the shell keeps it one argument
        assert!(cmd.args[1].contains("gello-companion '/Users/x/my proj'"));
    }

    #[test]
    fn escapes_an_embedded_single_quote_the_posix_way() {
        let cmd = terminal_command("/tmp/it's here").unwrap();
        // POSIX ' → '\'' , then the backslash is doubled for the AppleScript
        // string literal (\\ means one backslash when AppleScript parses it).
        assert!(cmd.args[1].contains("'/tmp/it'\\\\''s here'"));
    }

    #[test]
    fn escapes_a_double_quote_for_the_applescript_string() {
        let cmd = terminal_command("/tmp/a\"b").unwrap();
        // the embedded " is backslash-escaped so the AppleScript literal is valid
        assert!(cmd.args[1].contains("\\\""));
        assert!(!cmd.args[1].contains("b\"b"));
    }
}
