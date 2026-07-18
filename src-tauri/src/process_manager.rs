//! Python child process manager.
//!
//! Spawns Python scripts as subprocesses, reads JSONL stdout line-by-line,
//! forwards parsed JSON to the frontend via Tauri events.
//!
//! IPC protocol:
//!   stdout: one JSON object per line (JSONL), every line has a "code" field
//!   stderr: fatal errors only
//!   stdin:  control commands (pause/resume/stop) — only for training
//!   exit:   0=success, 1=expected error, -1=unexpected exception

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

/// Handle to a running Python child process.
pub struct ProcessHandle {
    pub task_id: String,
    pub script: String,
    pub process_id: u32,
    /// Clone to write control commands to stdin.
    stdin_tx: Option<std::sync::mpsc::Sender<String>>,
}

impl ProcessHandle {
    /// Send a control command to the Python process's stdin.
    pub fn send_command(&self, cmd: &str) -> Result<(), String> {
        if let Some(ref tx) = self.stdin_tx {
            tx.send(cmd.to_string())
                .map_err(|e| format!("Failed to send command: {}", e))
        } else {
            Err("This process does not accept control commands".into())
        }
    }

    /// Kill the child process by PID.
    pub fn kill(&self) -> Result<(), String> {
        let output = std::process::Command::new("taskkill")
            .args(["/PID", &self.process_id.to_string(), "/F"])
            .output()
            .map_err(|e| format!("Failed to run taskkill: {}", e))?;
        if output.status.success() {
            Ok(())
        } else {
            let msg = String::from_utf8_lossy(&output.stderr);
            Err(format!("taskkill failed: {}", msg))
        }
    }
}

/// Manages all Python child processes.
pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, ProcessHandle>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Detect the Python executable path.
    ///
    /// Priority:
    ///   1. PYTHON_HOME env var (set at packaging time)
    ///   2. `python` on PATH (dev mode, venv activated)
    ///   3. Embedded python/runtime/ (Tauri resource dir)
    pub fn find_python(&self) -> Result<String, String> {
        // 1. Explicit env var
        if let Ok(path) = std::env::var("PYTHON_HOME") {
            let exe = std::path::Path::new(&path).join("python.exe");
            if exe.exists() {
                return Ok(exe.to_string_lossy().to_string());
            }
        }

        // 2. Project venv (relative to project root; in dev CWD is src-tauri/)
        let venv_python = std::path::Path::new("../venv/Scripts/python.exe");
        let venv_python = if venv_python.exists() {
            venv_python.to_path_buf()
        } else {
            std::path::Path::new("venv/Scripts/python.exe").to_path_buf()
        };
        if venv_python.exists() {
            return Ok(venv_python.canonicalize()
                .unwrap_or_else(|_| venv_python.clone())
                .to_string_lossy()
                .to_string());
        }

        // 3. PATH lookup (works when venv is activated before `cargo tauri dev`)
        let path_result = Command::new("python")
            .arg("--version")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();
        if path_result.is_ok() {
            return Ok("python".to_string());
        }

        // 4. Embedded runtime (packaging path) — Tauri resource dir
        // In Tauri 2.x, the resource dir is resolved via the path plugin.
        // For now, check relative to the executable.
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let embedded = exe_dir.join("python").join("runtime").join("python.exe");
                if embedded.exists() {
                    return Ok(embedded.to_string_lossy().to_string());
                }
            }
        }

        Err("Python not found. Set PYTHON_HOME or activate the venv.".into())
    }

    /// Spawn a Python script as a child process.
    ///
    /// - `task_id`: unique identifier for this process (e.g., "env-check-001")
    /// - `script`: path to the .py file relative to `python/` directory
    /// - `args`: extra CLI arguments passed after the script
    /// - `accept_stdin`: if true, spawn a writer thread for control commands
    /// - `app_handle`: Tauri handle for emitting events
    pub fn spawn_python(
        &self,
        task_id: &str,
        script: &str,
        args: &[String],
        accept_stdin: bool,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let python_exe = self.find_python()?;

        // Scripts live in <project-root>/python/.
        // In dev mode, CWD is src-tauri/, so use ../python/.
        // In production, scripts are bundled alongside the executable.
        let script_path = std::path::Path::new("../python").join(script);
        let script_path = if script_path.exists() {
            script_path
        } else {
            // Fallback: try relative to CWD (production or custom setup)
            std::path::Path::new("python").join(script)
        };
        if !script_path.exists() {
            return Err(format!(
                "Script not found: {} (cwd: {:?})",
                script_path.display(),
                std::env::current_dir().unwrap_or_default()
            ));
        }

        log::info!(
            "Spawning Python: {} {} (task: {})",
            python_exe,
            script_path.display(),
            task_id
        );

        let mut cmd = Command::new(&python_exe);
        cmd.arg(script_path.to_string_lossy().to_string());
        for arg in args {
            cmd.arg(arg);
        }
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        if accept_stdin {
            cmd.stdin(Stdio::piped());
        } else {
            cmd.stdin(Stdio::null());
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn Python: {}", e))?;

        let pid = child.id();
        let task_id_owned = task_id.to_string();
        let script_owned = script.to_string();

        // ── Stdin writer (only for long-running processes like training) ──
        let stdin_tx: Option<std::sync::mpsc::Sender<String>> = if accept_stdin {
            let stdin = child.stdin.take().ok_or("Failed to capture stdin")?;
            let (tx, rx) = std::sync::mpsc::channel::<String>();
            std::thread::spawn(move || {
                let mut stdin = stdin;
                for cmd in rx {
                    let _ = writeln!(stdin, "{}", cmd);
                    let _ = stdin.flush();
                }
            });
            Some(tx)
        } else {
            None
        };

        // ── Stdout reader (takes ownership of child for wait()) ──
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
        let handle_clone = app_handle.clone();
        let tid = task_id.to_string();
        let scr = script.to_string();

        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        if text.trim().is_empty() {
                            continue;
                        }
                        let event_name = format!("{}:line", script_to_event(&scr));
                        let _ = handle_clone.emit(&event_name, &text);
                        log::debug!("[{}] stdout: {}", tid, &text[..text.len().min(120)]);
                    }
                    Err(e) => {
                        log::error!("[{}] stdout read error: {}", tid, e);
                        break;
                    }
                }
            }

            // Process ended — check exit status
            match child.wait() {
                Ok(status) => {
                    let exit_event = if status.success() {
                        format!("{}:completed", script_to_event(&scr))
                    } else {
                        format!("{}:error", script_to_event(&scr))
                    };
                    let code = status.code().unwrap_or(-1);
                    let payload = serde_json::json!({
                        "code": if status.success() { "R-003" } else { "R-003E" },
                        "task_id": tid,
                        "exit_code": code,
                    });
                    let _ = handle_clone.emit(&exit_event, &payload.to_string());
                    log::info!("[{}] process exited with code {}", tid, code);
                }
                Err(e) => {
                    log::error!("[{}] failed to wait on child: {}", tid, e);
                }
            }

            // Read stderr for diagnostics
            let stderr_reader = BufReader::new(stderr);
            for line in stderr_reader.lines().flatten() {
                if !line.trim().is_empty() {
                    log::warn!("[{}] stderr: {}", tid, line);
                }
            }
        });

        // ── Store handle ──
        let handle = ProcessHandle {
            task_id: task_id_owned.clone(),
            script: script_owned,
            process_id: pid,
            stdin_tx,
        };

        let mut procs = self.processes.lock().unwrap();
        procs.insert(task_id_owned, handle);

        Ok(())
    }

    /// Send a command to a running process.
    pub fn send_command(&self, task_id: &str, cmd: &str) -> Result<(), String> {
        let procs = self.processes.lock().unwrap();
        if let Some(handle) = procs.get(task_id) {
            handle.send_command(cmd)
        } else {
            Err(format!("No process with task_id: {}", task_id))
        }
    }

    /// Kill a running process.
    pub fn kill(&self, task_id: &str) -> Result<(), String> {
        let mut procs = self.processes.lock().unwrap();
        if let Some(handle) = procs.get_mut(task_id) {
            handle.kill()
        } else {
            Err(format!("No process with task_id: {}", task_id))
        }
    }
}

/// Map a Python script name to a Tauri event name prefix (without suffix).
/// Suffixes :line, :completed, :error are appended by the caller.
fn script_to_event(script: &str) -> String {
    if script.contains("env_check") {
        "env:check".into()
    } else if script.contains("train") {
        "train".into()
    } else if script.contains("infer") {
        "infer".into()
    } else if script.contains("dataset") {
        "dataset:check".into()
    } else if script.contains("model_check") {
        "model:check".into()
    } else if script.contains("export") {
        "export".into()
    } else {
        "python".into()
    }
}
