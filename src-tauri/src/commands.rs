//! Tauri Commands — frontend-invokable Rust functions.
//!
//! Each command corresponds to a frontend `invoke()` call.
//! They delegate to ProcessManager for Python subprocess operations.

use crate::process_manager::ProcessManager;
use tauri::State;

/// Shared application state managed by Tauri.
pub struct AppState {
    pub process_manager: ProcessManager,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            process_manager: ProcessManager::new(),
        }
    }
}

/* ═══════════════════════════════════════════════
   Test Command (minimal Python — pipe diagnostic)
   ═══════════════════════════════════════════════ */

#[tauri::command]
pub fn test_python(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let task_id = "test-hello";
    state
        .process_manager
        .spawn_python(task_id, "hello.py", &[], false, app_handle)?;
    Ok(task_id.to_string())
}

/* ═══════════════════════════════════════════════
   Environment Check
   ═══════════════════════════════════════════════ */

/// Run the environment detection script (env_check.py).
/// Each JSONL output line is emitted as `env:check:line` event.
/// On completion, emits `env:check:completed` or `env:check:error`.
#[tauri::command]
pub fn check_environment(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let task_id = format!("env-check-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    state
        .process_manager
        .spawn_python(&task_id, "env_check.py", &[], false, app_handle)?;

    Ok(task_id)
}

/* ═══════════════════════════════════════════════
   Dataset Check
   ═══════════════════════════════════════════════ */

/// Validate a dataset directory or ZIP file.
#[tauri::command]
pub fn check_dataset(
    path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    if path.is_empty() {
        return Err("Dataset path is required".into());
    }

    let task_id = format!("dataset-check-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    state.process_manager.spawn_python(
        &task_id,
        "dataset_check.py",
        &["--dataset-path".into(), path],
        false,
        app_handle,
    )?;

    Ok(task_id)
}

/* ═══════════════════════════════════════════════
   Model Check
   ═══════════════════════════════════════════════ */

/// Validate a .pt model file.
#[tauri::command]
pub fn check_model(
    path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    if path.is_empty() {
        return Err("Model path is required".into());
    }

    let task_id = format!("model-check-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    state.process_manager.spawn_python(
        &task_id,
        "model_check.py",
        &["--model-path".into(), path],
        false,
        app_handle,
    )?;

    Ok(task_id)
}

/* ═══════════════════════════════════════════════
   Training
   ═══════════════════════════════════════════════ */

#[tauri::command]
pub fn start_training(
    config: serde_json::Value,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let task_id = format!("train-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    // Serialize config as CLI args: --key value
    let mut args: Vec<String> = Vec::new();
    if let Some(obj) = config.as_object() {
        for (k, v) in obj {
            let val_str = match v {
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            args.push(format!("--{}", k));
            args.push(val_str);
        }
    }

    state.process_manager.spawn_python(
        &task_id,
        "train.py",
        &args,
        true, // accept stdin for pause/resume/stop
        app_handle,
    )?;

    Ok(task_id)
}

#[tauri::command]
pub fn pause_training(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.process_manager.send_command(&task_id, "pause")
}

#[tauri::command]
pub fn resume_training(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.process_manager.send_command(&task_id, "resume")
}

#[tauri::command]
pub fn stop_training(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.process_manager.send_command(&task_id, "stop")
}

/* ═══════════════════════════════════════════════
   Inference
   ═══════════════════════════════════════════════ */

#[tauri::command]
pub fn run_inference(
    model_path: String,
    image_path: String,
    conf: Option<f64>,
    iou: Option<f64>,
    imgsz: Option<i64>,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let task_id = format!("infer-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    let mut args = vec![
        "--model-path".into(), model_path,
        "--image-path".into(), image_path,
    ];
    if let Some(c) = conf { args.push("--conf".into()); args.push(c.to_string()); }
    if let Some(i) = iou { args.push("--iou".into()); args.push(i.to_string()); }
    if let Some(s) = imgsz { args.push("--imgsz".into()); args.push(s.to_string()); }

    state.process_manager.spawn_python(
        &task_id,
        "infer.py",
        &args,
        false,
        app_handle,
    )?;

    Ok(task_id)
}

/* ═══════════════════════════════════════════════
   File System / Settings
   ═══════════════════════════════════════════════ */

#[tauri::command]
pub fn get_task_history() -> Result<serde_json::Value, String> {
    // Read history.json from output directory
    let output_dir = std::env::var("YOLO_OUTPUT_DIR")
        .unwrap_or_else(|_| "output".to_string());
    let path = std::path::Path::new(&output_dir).join("history.json");

    if !path.exists() {
        return Ok(serde_json::json!([]));
    }

    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read history: {}", e))?;
    let history: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse history: {}", e))?;

    Ok(history)
}

#[tauri::command]
pub fn get_settings() -> Result<serde_json::Value, String> {
    // Default settings
    let defaults = serde_json::json!({
        "output_directory": "",
        "log_level": "detailed",
    });
    Ok(defaults)
}

#[tauri::command]
pub fn save_settings(
    settings: serde_json::Value,
) -> Result<(), String> {
    log::info!("Settings saved: {}", settings);
    Ok(())
}
