// gello Rust shell — kept deliberately thin (see CLAUDE.md).

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![write_file_atomic])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
