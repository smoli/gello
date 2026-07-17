// gello Rust shell — kept deliberately thin (see CLAUDE.md).

pub mod fs_read;
pub mod fs_watch;
pub mod fs_write;
pub mod git;
pub mod skills;

/// Typed error shape shared with the frontend (src/lib/fs.ts).
#[derive(serde::Serialize)]
pub struct FsError {
    kind: String,
    path: String,
    message: String,
}

#[tauri::command]
fn write_file_atomic(path: String, contents: String) -> Result<(), FsError> {
    fs_write::atomic_write(std::path::Path::new(&path), &contents).map_err(|error| FsError {
        kind: format!("{:?}", error.kind()),
        message: error.to_string(),
        path,
    })
}

#[tauri::command]
fn find_board_root() -> Option<String> {
    let cwd = std::env::current_dir().ok()?;
    fs_read::find_board_root(&cwd).map(|path| path.to_string_lossy().into_owned())
}

/// c016: locate a `.gello` root at or above a chosen folder.
#[tauri::command]
fn find_board_root_at(folder: String) -> Option<String> {
    fs_read::find_board_root(std::path::Path::new(&folder))
        .map(|path| path.to_string_lossy().into_owned())
}

#[derive(serde::Deserialize)]
struct NewFile {
    path: String,
    content: String,
}

/// c017: create each file (making parent dirs), atomically. Used to scaffold
/// a fresh `.gello/` board and its CLAUDE.md.
#[tauri::command]
fn write_new_files(files: Vec<NewFile>) -> Result<(), FsError> {
    for file in files {
        let path = std::path::Path::new(&file.path);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| FsError {
                kind: format!("{:?}", error.kind()),
                message: error.to_string(),
                path: parent.to_string_lossy().into_owned(),
            })?;
        }
        fs_write::atomic_write(path, &file.content).map_err(|error| FsError {
            kind: format!("{:?}", error.kind()),
            message: error.to_string(),
            path: file.path,
        })?;
    }
    Ok(())
}

/// Keeps the active watcher alive; replaced when a new board is watched.
struct WatcherState(std::sync::Mutex<Option<notify::RecommendedWatcher>>);
/// Keeps the git-HEAD watcher alive (c0057).
struct GitWatcherState(std::sync::Mutex<Option<notify::RecommendedWatcher>>);

#[tauri::command]
fn watch_board(
    root: String,
    app: tauri::AppHandle,
    state: tauri::State<WatcherState>,
) -> Result<(), FsError> {
    use tauri::Emitter;

    let root_path = std::path::PathBuf::from(&root);
    let strip_root = root_path.clone();
    let watcher = fs_watch::start_watching(&root_path, move |paths| {
        let relative: Vec<String> = paths
            .iter()
            .filter_map(|path| path.strip_prefix(&strip_root).ok())
            .map(|path| {
                path.components()
                    .map(|c| c.as_os_str().to_string_lossy())
                    .collect::<Vec<_>>()
                    .join("/")
            })
            .collect();
        if !relative.is_empty() {
            let _ = app.emit("board-files-changed", relative);
        }
    })
    .map_err(|error| FsError {
        kind: "Watch".into(),
        message: error.to_string(),
        path: root.clone(),
    })?;

    *state.0.lock().unwrap() = Some(watcher);
    Ok(())
}

/// c0060: copy a chosen image into the board's assets/board/, return rel path.
#[tauri::command]
fn set_board_image(root: String, source: String) -> Result<String, FsError> {
    fs_write::set_board_image(
        std::path::Path::new(&root),
        std::path::Path::new(&source),
    )
    .map_err(|error| FsError {
        kind: format!("{:?}", error.kind()),
        message: error.to_string(),
        path: source,
    })
}

#[tauri::command]
fn remove_file(path: String) -> Result<(), FsError> {
    fs_write::remove_file(std::path::Path::new(&path)).map_err(|error| FsError {
        kind: format!("{:?}", error.kind()),
        message: error.to_string(),
        path,
    })
}

#[tauri::command]
fn read_file(path: String) -> Result<String, FsError> {
    fs_read::read_file(std::path::Path::new(&path)).map_err(|error| FsError {
        kind: format!("{:?}", error.kind()),
        message: error.to_string(),
        path,
    })
}

#[tauri::command]
fn git_branch(root: String) -> Option<String> {
    git::git_branch(std::path::Path::new(&root))
}

/// c032: existing agent-skill directories under the project root.
#[tauri::command]
fn detect_skill_dirs(project_root: String) -> Vec<String> {
    skills::detect_skill_dirs(std::path::Path::new(&project_root))
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

fn flags_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, FsError> {
    use tauri::Manager;
    let dir = app.path().app_config_dir().map_err(|error| FsError {
        kind: "Config".into(),
        message: error.to_string(),
        path: String::new(),
    })?;
    Ok(dir.join("flags.json"))
}

/// Read one app-local flag (c032: e.g. the "don't ask about skills" choice).
#[tauri::command]
fn app_flag_get(key: String, app: tauri::AppHandle) -> Option<String> {
    let path = flags_path(&app).ok()?;
    let content = std::fs::read_to_string(path).ok()?;
    let map: std::collections::HashMap<String, String> = serde_json::from_str(&content).ok()?;
    map.get(&key).cloned()
}

/// Persist one app-local flag (created under the OS app-config dir).
#[tauri::command]
fn app_flag_set(key: String, value: String, app: tauri::AppHandle) -> Result<(), FsError> {
    let path = flags_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| FsError {
            kind: format!("{:?}", error.kind()),
            message: error.to_string(),
            path: parent.to_string_lossy().into_owned(),
        })?;
    }
    let mut map: std::collections::HashMap<String, String> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default();
    map.insert(key, value);
    let json = serde_json::to_string_pretty(&map).unwrap_or_else(|_| "{}".into());
    fs_write::atomic_write(&path, &json).map_err(|error| FsError {
        kind: format!("{:?}", error.kind()),
        message: error.to_string(),
        path: path.to_string_lossy().into_owned(),
    })
}

/// Watch the repo's `.git/HEAD`, emitting `git-head-changed` on checkout.
/// Kept in the same managed slot lifetime as the board watcher.
#[tauri::command]
fn watch_git_head(
    root: String,
    app: tauri::AppHandle,
    state: tauri::State<GitWatcherState>,
) -> Result<(), FsError> {
    use notify::Watcher;
    use tauri::Emitter;

    let head = match git::find_head_file(std::path::Path::new(&root)) {
        Some(head) => head,
        None => {
            *state.0.lock().unwrap() = None;
            return Ok(());
        }
    };
    // watch the git dir (HEAD is rewritten, sometimes via rename)
    let git_dir = head.parent().map(|p| p.to_path_buf()).unwrap_or(head.clone());
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        if let Ok(event) = result {
            if event.paths.iter().any(|p| p.ends_with("HEAD")) {
                let _ = app.emit("git-head-changed", ());
            }
        }
    })
    .map_err(|error| FsError {
        kind: "Watch".into(),
        message: error.to_string(),
        path: root.clone(),
    })?;
    watcher
        .watch(&git_dir, notify::RecursiveMode::NonRecursive)
        .map_err(|error| FsError {
            kind: "Watch".into(),
            message: error.to_string(),
            path: root,
        })?;
    *state.0.lock().unwrap() = Some(watcher);
    Ok(())
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, FsError> {
    fs_read::read_file_base64(std::path::Path::new(&path)).map_err(|error| FsError {
        kind: format!("{:?}", error.kind()),
        message: error.to_string(),
        path,
    })
}

#[tauri::command]
fn read_board_files(root: String) -> Result<Vec<fs_read::BoardFileEntry>, FsError> {
    fs_read::read_board_files(std::path::Path::new(&root)).map_err(|error| FsError {
        kind: format!("{:?}", error.kind()),
        message: error.to_string(),
        path: root,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // c048: persist and restore the window size/position across restarts
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(WatcherState(std::sync::Mutex::new(None)))
        .manage(GitWatcherState(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            write_file_atomic,
            remove_file,
            find_board_root,
            read_file,
            read_file_base64,
            read_board_files,
            watch_board,
            git_branch,
            watch_git_head,
            detect_skill_dirs,
            app_flag_get,
            app_flag_set,
            find_board_root_at,
            write_new_files,
            set_board_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
