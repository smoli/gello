// gello Rust shell — kept deliberately thin (see CLAUDE.md).
// Real commands (atomic writes, file watching) arrive with c004/c014,
// each test-driven via `cargo test`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
