use tauri::Manager;

mod storage;
mod pdf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            storage::get_all_resumes,
            storage::get_resume_by_id,
            storage::create_resume,
            storage::update_resume,
            storage::delete_resumes,
            pdf::generate_pdf,
        ])
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
