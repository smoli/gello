// gello Rust shell — kept deliberately thin (see CLAUDE.md).

pub mod fs_read;
pub mod fs_write;

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

#[tauri::command]
fn read_file(path: String) -> Result<String, FsError> {
    fs_read::read_file(std::path::Path::new(&path)).map_err(|error| FsError {
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
        .invoke_handler(tauri::generate_handler![
            write_file_atomic,
            find_board_root,
            read_file,
            read_board_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
