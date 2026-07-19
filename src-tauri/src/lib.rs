mod commands;
mod process_manager;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_folder_dialog,
            commands::open_file_dialog,
            commands::test_python,
            commands::preview_dataset,
            commands::check_environment,
            commands::check_dataset,
            commands::check_model,
            commands::start_training,
            commands::pause_training,
            commands::resume_training,
            commands::stop_training,
            commands::run_inference,
            commands::get_task_history,
            commands::get_settings,
            commands::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
