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
   File Dialogs
   ═══════════════════════════════════════════════ */

/// Open a native folder picker dialog.
#[tauri::command]
pub async fn open_folder_dialog(
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app_handle
        .dialog()
        .file()
        .blocking_pick_folder();
    Ok(path.map(|p| p.to_string()))
}

/// Open a native file picker (any file type — used for both model and image).
#[tauri::command]
pub async fn open_file_dialog(
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app_handle
        .dialog()
        .file()
        .blocking_pick_file();
    Ok(path.map(|p| p.to_string()))
}

/* ═══════════════════════════════════════════════
   Dataset Preview
   ═══════════════════════════════════════════════ */

#[tauri::command]
pub fn preview_dataset(
    path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    // Run synchronously via process_manager but capture stdout directly.
    // This avoids Tauri event race conditions for fast scripts.
    let python_exe = state.process_manager.find_python()?;
    // Check path from src-tauri/ (../python/), pass relative to child CWD=project root (python/)
    let check_path = std::path::Path::new("../python").join("preview_dataset.py");
    if !check_path.exists() {
        let alt = std::path::Path::new("python").join("preview_dataset.py");
        if !alt.exists() {
            return Err(format!("Script not found: {:?}", check_path));
        }
    }
    // Always pass as python/preview_dataset.py — child CWD is project root
    let script_arg = "python/preview_dataset.py";

    let output = std::process::Command::new(&python_exe)
        .arg("-u")
        .arg(&script_arg)
        .arg("--dataset-path")
        .arg(&path)
        .arg("--max-count")
        .arg("20")
        .current_dir("..")
        .output()
        .map_err(|e| format!("Failed to run preview: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Preview failed: {}", stderr));
    }

    // Parse the last JSONL line (P-001) for preview data
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            if val.get("code").and_then(|c| c.as_str()) == Some("P-001") {
                return Ok(val);
            }
        }
    }

    Err("No preview data found in output".into())
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
    // Convert snake_case → kebab-case for Python argparse compatibility
    let mut args: Vec<String> = Vec::new();
    if let Some(obj) = config.as_object() {
        for (k, v) in obj {
            let val_str = match v {
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            let flag = k.replace('_', "-");
            args.push(format!("--{}", flag));
            args.push(val_str);
        }
    }

    // File-based control signal (replaces stdin pipe).
    // Python CWD = project root (set via cmd.current_dir("..")).
    let control_file = format!("output/.control_{}", task_id);
    args.push("--control-file".into());
    args.push(control_file);

    state.process_manager.spawn_python(
        &task_id,
        "train.py",
        &args,
        false, // stdin disabled — pipe blocks Ultralytics import on Windows
        app_handle,
    )?;

    Ok(task_id)
}

/// Write a control command to the training process's signal file.
/// Rust CWD = src-tauri/, Python CWD = project root (..), so use ../output/.
fn write_control_signal(task_id: &str, command: &str) -> Result<(), String> {
    let control_file = format!("../output/.control_{}", task_id);
    std::fs::create_dir_all("../output").map_err(|e| format!("Cannot create output dir: {}", e))?;
    std::fs::write(&control_file, format!("{}\n", command))
        .map_err(|e| format!("Cannot write control file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn pause_training(
    task_id: String,
) -> Result<(), String> {
    write_control_signal(&task_id, "pause")
}

#[tauri::command]
pub fn resume_training(
    task_id: String,
) -> Result<(), String> {
    write_control_signal(&task_id, "resume")
}

#[tauri::command]
pub fn stop_training(
    task_id: String,
) -> Result<(), String> {
    write_control_signal(&task_id, "stop")
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
   Training History Actions
   ═══════════════════════════════════════════════ */

/// Open the training report HTML in the default browser.
/// output_dir is relative to project root; Rust CWD is src-tauri/.
#[tauri::command]
pub fn open_report(output_dir: String) -> Result<(), String> {
    let report_path = std::path::Path::new("..").join(&output_dir).join("report.html");
    let report_path = if report_path.exists() {
        report_path
    } else {
        std::path::Path::new(&output_dir).join("report.html")
    };
    if !report_path.exists() {
        return Err(format!("Report not found: {}", report_path.display()));
    }
    opener::open(report_path.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to open report: {}", e))?;
    Ok(())
}

/// Delete a training task — removes from history.json.
#[tauri::command]
pub fn delete_task(task_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let history_path = std::path::Path::new("../output").join("history.json");
    let history_path = if history_path.exists() {
        history_path
    } else {
        std::path::Path::new("output").join("history.json")
    };

    if !history_path.exists() {
        return Err("No history file found".into());
    }

    let content = std::fs::read_to_string(&history_path)
        .map_err(|e| format!("Failed to read history: {}", e))?;
    let mut records: Vec<serde_json::Value> =
        serde_json::from_str(&content).unwrap_or_else(|_| vec![]);

    let before = records.len();
    records.retain(|r| r.get("id").and_then(|v| v.as_str()) != Some(&task_id));

    if records.len() == before {
        return Err(format!("Task not found: {}", task_id));
    }

    let json = serde_json::to_string_pretty(&records)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&history_path, json)
        .map_err(|e| format!("Failed to write history: {}", e))?;

    Ok(())
}

/// Open a save file dialog and return the chosen path.
#[tauri::command]
pub async fn save_file_dialog(
    app_handle: tauri::AppHandle,
    default_name: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app_handle
        .dialog()
        .file()
        .set_file_name(&default_name)
        .blocking_save_file();
    Ok(path.map(|p| p.to_string()))
}

/// Copy a file from source to destination.
/// src is relative to project root; Rust CWD is src-tauri/.
#[tauri::command]
pub fn copy_file(src: String, dst: String) -> Result<(), String> {
    // Try ../ prefix first (project root), then raw path
    let src_path = std::path::Path::new("..").join(&src);
    let src_path = if src_path.exists() { src_path } else { std::path::Path::new(&src).to_path_buf() };
    if !src_path.exists() {
        return Err(format!("Source not found: {}", src_path.display()));
    }
    std::fs::copy(&src_path, &dst)
        .map_err(|e| format!("Failed to copy: {}", e))?;
    Ok(())
}

/* ═══════════════════════════════════════════════
   File System / Settings
   ═══════════════════════════════════════════════ */

#[tauri::command]
pub fn get_task_history() -> Result<serde_json::Value, String> {
    // Try ../output/ (Rust CWD = src-tauri/) first, then output/ (project root)
    let path = std::path::Path::new("../output").join("history.json");
    let path = if path.exists() {
        path
    } else {
        std::path::Path::new("output").join("history.json")
    };

    if !path.exists() {
        return Ok(serde_json::json!([]));
    }

    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read history: {}", e))?;
    let mut history: Vec<serde_json::Value> =
        serde_json::from_str(&content).unwrap_or_else(|_| vec![]);

    // Sort by date descending (newest first)
    history.reverse();

    Ok(serde_json::json!(history))
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
