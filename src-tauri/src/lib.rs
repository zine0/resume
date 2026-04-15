use tauri::Manager;

mod ai_chat;
mod ai_config;
mod ai_service;
mod ai_snapshot;
mod applications;
mod pdf;
mod persist;
mod resume;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(storage::ResumeStorageLock::default())
        .invoke_handler(tauri::generate_handler![
            ai_service::ai_polish_text,
            ai_service::ai_optimize_resume,
            ai_service::ai_analyze_jd,
            ai_service::ai_rewrite_for_jd,
            ai_service::ai_test_connection,
            ai_config::get_ai_config,
            ai_config::save_ai_config,
            resume::get_default_resume_data,
            resume::validate_resume_data_command,
            resume::import_resume_file,
            resume::export_resume_file,
            resume::create_personal_info_item,
            resume::create_job_intention_item,
            resume::create_resume_module,
            resume::create_rich_text_row,
            resume::create_tags_row,
            storage::get_all_resumes,
            storage::get_resume_by_id,
            storage::create_resume,
            storage::create_resume_from_data,
            storage::update_resume,
            storage::delete_resumes,
            applications::get_all_applications,
            applications::get_application_by_id,
            applications::create_application,
            applications::update_application,
            applications::delete_applications,
            pdf::generate_pdf,
        ])
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
            Ok(())
        });

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
