use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use thiserror::Error;

// Output loss detection configuration
const OUTPUT_TIMEOUT_MS: u64 = 30_000; // 30 seconds timeout
const HEARTBEAT_CHECK_INTERVAL_MS: u64 = 5_000; // Check every 5 seconds

#[derive(Default)]
pub struct PtyState {
    controls: Mutex<HashMap<String, Arc<PtyControl>>>,
}

struct PtyControl {
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    writer: Mutex<Box<dyn Write + Send>>,
    stop_requested: AtomicBool,
    last_output_time: AtomicU64, // Unix timestamp in milliseconds
}

#[derive(Clone, serde::Serialize)]
struct TerminalStreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    chunk: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(rename = "runId", skip_serializing_if = "Option::is_none")]
    run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cwd: Option<String>,
    #[serde(rename = "exitCode", skip_serializing_if = "Option::is_none")]
    exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timed_out: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stopped: Option<bool>,
    #[serde(rename = "durationMs", skip_serializing_if = "Option::is_none")]
    duration_ms: Option<u64>,
}

#[derive(Debug, Error)]
enum AppError {
    #[error("Failed to allocate PTY: {0}")]
    OpenPty(String),
    #[error("Failed to spawn PTY child process: {0}")]
    Spawn(String),
    #[error("Failed to clone PTY reader: {0}")]
    CloneReader(String),
    #[error("Failed to create PTY writer: {0}")]
    TakeWriter(String),
    #[error("Internal PTY state lock poisoned")]
    StatePoisoned,
    #[error("Terminal session not found")]
    SessionNotFound,
    #[error("Failed to send signal to terminal: {0}")]
    Signal(String),
    #[error("Failed to write terminal input: {0}")]
    Input(String),
}

impl From<AppError> for String {
    fn from(value: AppError) -> Self {
        value.to_string()
    }
}

fn event_name(entry_id: &str) -> String {
    format!("pty-stream-{entry_id}")
}

fn default_shell() -> String {
    if cfg!(windows) {
        "cmd.exe".to_string()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

fn build_command(
    shell: String,
    command: &str,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    interactive_autocomplete: bool,
) -> CommandBuilder {
    let mut cmd = CommandBuilder::new(shell);
    cmd.env("TERM", "xterm-256color");

    if let Some(c) = cwd {
        cmd.cwd(c);
    }

    if let Some(vars) = env {
        for (k, v) in vars {
            cmd.env(k, v);
        }
    }

    if cfg!(windows) {
        cmd.args(["/d", "/s", "/c", command]);
    } else {
        if interactive_autocomplete {
            cmd.args(["-lic", command]);
        } else {
            cmd.args(["-lc", command]);
        }
    }

    cmd
}

fn get_control(state: &PtyState, entry_id: &str) -> Result<Arc<PtyControl>, AppError> {
    let controls = state.controls.lock().map_err(|_| AppError::StatePoisoned)?;
    controls
        .get(entry_id)
        .cloned()
        .ok_or(AppError::SessionNotFound)
}

fn remove_control(state: &PtyState, entry_id: &str) -> Result<Option<Arc<PtyControl>>, AppError> {
    let mut controls = state.controls.lock().map_err(|_| AppError::StatePoisoned)?;
    Ok(controls.remove(entry_id))
}

#[tauri::command]
pub async fn run_terminal_stream(
    _session_id: String,
    entry_id: String,
    command: String,
    cwd: Option<String>,
    shell: Option<String>,
    interactive_autocomplete: Option<bool>,
    env: Option<HashMap<String, String>>,
    app_handle: AppHandle,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| AppError::OpenPty(e.to_string()))?;

    let shell_to_use = shell.unwrap_or_else(default_shell);
    let resolved_cwd = cwd.clone();
    let cmd = build_command(
        shell_to_use,
        &command,
        cwd,
        env,
        interactive_autocomplete.unwrap_or(true),
    );

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| AppError::Spawn(e.to_string()))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| AppError::CloneReader(e.to_string()))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| AppError::TakeWriter(e.to_string()))?;

    let control = Arc::new(PtyControl {
        killer: Mutex::new(child.clone_killer()),
        writer: Mutex::new(writer),
        stop_requested: AtomicBool::new(false),
        last_output_time: AtomicU64::new(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        ),
    });

    {
        let mut controls = state.controls.lock().map_err(|_| AppError::StatePoisoned)?;
        controls.insert(entry_id.clone(), control.clone());
    }

    let event = event_name(&entry_id);
    let _ = app_handle.emit(
        &event,
        TerminalStreamEvent {
            event_type: "init".to_string(),
            chunk: None,
            message: None,
            run_id: Some(entry_id.clone()),
            cwd: resolved_cwd,
            exit_code: None,
            timed_out: None,
            stopped: None,
            duration_ms: None,
        },
    );

    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(128);
    let reader_event = event.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    if tx.blocking_send(text).is_err() {
                        break;
                    }
                }
                _ => break,
            }
        }
    });

    let app_for_reader = app_handle.clone();
    let control_for_output = control.clone();
    tokio::spawn(async move {
        // Track last output time for heartbeat detection
        let mut last_output = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Heartbeat task to detect output loss
        let heartbeat_app = app_for_reader.clone();
        let heartbeat_event = reader_event.clone();
        let heartbeat_handle = tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(
                    HEARTBEAT_CHECK_INTERVAL_MS,
                ))
                .await;

                let current_time = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                // Check if we haven't received output for too long
                if current_time - last_output > OUTPUT_TIMEOUT_MS {
                    let _ = heartbeat_app.emit(
                        &heartbeat_event,
                        TerminalStreamEvent {
                            event_type: "error".to_string(),
                            chunk: None,
                            message: Some(
                                "Output timeout: no data received for 30 seconds".to_string(),
                            ),
                            run_id: None,
                            cwd: None,
                            exit_code: None,
                            timed_out: Some(true),
                            stopped: None,
                            duration_ms: None,
                        },
                    );
                    break;
                }
            }
        });

        while let Some(chunk) = rx.recv().await {
            // Update last output time
            last_output = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            // Also update the shared control for external access
            control_for_output
                .last_output_time
                .store(last_output, Ordering::Relaxed);

            let _ = app_for_reader.emit(
                &reader_event,
                TerminalStreamEvent {
                    event_type: "stdout".to_string(),
                    chunk: Some(chunk),
                    message: None,
                    run_id: None,
                    cwd: None,
                    exit_code: None,
                    timed_out: None,
                    stopped: None,
                    duration_ms: None,
                },
            );
        }

        // Stop the heartbeat task when output ends
        heartbeat_handle.abort();
    });

    let app_for_exit = app_handle.clone();
    let entry_for_exit = entry_id.clone();
    let event_for_exit = event_name(&entry_id);
    let started_at = std::time::Instant::now();

    tokio::task::spawn_blocking(move || {
        let exit_code = match child.wait() {
            Ok(status) => status.exit_code() as i32,
            Err(_) => 1,
        };

        let stopped = app_for_exit
            .state::<PtyState>()
            .controls
            .lock()
            .ok()
            .and_then(|controls| controls.get(&entry_for_exit).cloned())
            .map(|control| control.stop_requested.load(Ordering::Relaxed))
            .unwrap_or(false);

        let _ = remove_control(&app_for_exit.state::<PtyState>(), &entry_for_exit);

        let _ = app_for_exit.emit(
            &event_for_exit,
            TerminalStreamEvent {
                event_type: "exit".to_string(),
                chunk: None,
                message: None,
                run_id: None,
                cwd: None,
                exit_code: Some(exit_code),
                timed_out: Some(false),
                stopped: Some(stopped),
                duration_ms: Some(started_at.elapsed().as_millis() as u64),
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub fn write_terminal_input(
    entry_id: String,
    data: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let control = get_control(&state, &entry_id)?;
    let mut writer = control.writer.lock().map_err(|_| AppError::StatePoisoned)?;

    writer
        .write_all(data.as_bytes())
        .map_err(|e| AppError::Input(e.to_string()))?;
    writer.flush().map_err(|e| AppError::Input(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub fn stop_terminal_stream(entry_id: String, state: State<'_, PtyState>) -> Result<(), String> {
    let control = get_control(&state, &entry_id)?;
    control.stop_requested.store(true, Ordering::Relaxed);

    let mut killer = control.killer.lock().map_err(|_| AppError::StatePoisoned)?;

    killer.kill().map_err(|e| AppError::Signal(e.to_string()))?;

    Ok(())
}

pub fn stop_all_terminal_streams(app_handle: &AppHandle) {
    let state = app_handle.state::<PtyState>();

    let controls: Vec<Arc<PtyControl>> = match state.controls.lock() {
        Ok(map) => map.values().cloned().collect(),
        Err(_) => return,
    };

    for control in controls {
        control.stop_requested.store(true, Ordering::Relaxed);
        if let Ok(mut killer) = control.killer.lock() {
            let _ = killer.kill();
        }
    }
}
