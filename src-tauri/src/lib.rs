mod pty;

use std::process::Child;
use std::sync::Mutex;
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tauri::{Manager, WindowEvent};
use tauri_plugin_sql::{Migration, MigrationKind};

const SIDECAR_HOST: &str = "127.0.0.1";
const SIDECAR_PORT_START: u16 = 14321;
const SIDECAR_PORT_END: u16 = 14360;
const SIDECAR_READY_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Default)]
struct SidecarState {
    child: Mutex<Option<Child>>,
    port: Mutex<Option<u16>>,
}

struct DbUrlState(String);

fn find_available_port() -> Option<u16> {
    for port in SIDECAR_PORT_START..=SIDECAR_PORT_END {
        if TcpListener::bind((SIDECAR_HOST, port)).is_ok() {
            return Some(port);
        }
    }
    None
}

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if TcpStream::connect((SIDECAR_HOST, port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(120));
    }
    false
}

fn resolve_sidecar_entry(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?;
    let current_dir_candidates = std::env::current_dir()
        .ok()
        .map(|cwd| {
            vec![
                cwd.join("src-tauri").join("resources").join("sidecar").join("server.js"),
                cwd.join("resources").join("sidecar").join("server.js"),
            ]
        })
        .unwrap_or_default();

    let mut candidates = vec![
        resource_dir.join("sidecar").join("server.js"),
        resource_dir
            .join("resources")
            .join("sidecar")
            .join("server.js"),
    ];
    candidates.extend(current_dir_candidates);

    for entry in candidates {
        if entry.exists() {
            return Ok(entry);
        }
    }
    Err(format!(
        "Missing bundled Sidecar entry under {}",
        resource_dir.display()
    ))
}

fn resolve_node_runtime(app: &tauri::AppHandle) -> Option<PathBuf> {
    let resource_dir = app.path().resource_dir().ok()?;
    let file_name = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };
    let candidates = [
        resource_dir.join("node-runtime").join(file_name),
        resource_dir
            .join("resources")
            .join("node-runtime")
            .join(file_name),
    ];
    candidates.into_iter().find(|candidate| candidate.exists())
}

fn resolve_sidecar_default_cwd() -> PathBuf {
    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    if cfg!(debug_assertions) {
        if current_dir
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name == "src-tauri")
            .unwrap_or(false)
        {
            if let Some(parent) = current_dir.parent() {
                return parent.to_path_buf();
            }
        }

        return current_dir;
    }

    dirs::home_dir().unwrap_or(current_dir)
}

fn spawn_sidecar_server(
    entry: &PathBuf,
    server_dir: &PathBuf,
    default_cwd: &PathBuf,
    port: u16,
    runtime: Option<&PathBuf>,
) -> Result<Child, String> {
    let mut command = match runtime {
        Some(path) => Command::new(path),
        None => Command::new("node"),
    };
    command
        .arg(entry)
        .current_dir(server_dir)
        .env("NODE_ENV", "production")
        .env("SIDECAR_PORT", port.to_string())
        .env("GGBOND_DEFAULT_CWD", default_cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit());

    command.spawn().map_err(|e| match runtime {
        Some(path) => format!(
            "Failed to start bundled Sidecar using packaged node runtime ({}): {e}",
            path.display()
        ),
        None => format!("Failed to start bundled Sidecar via system node: {e}"),
    })
}

fn stop_sidecar_server(app: &tauri::AppHandle) {
    let state = app.state::<SidecarState>();
    let mut guard = match state.child.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg(unix)]
fn stop_stale_sidecar_processes(entry: &PathBuf) {
    let pattern = entry.to_string_lossy().into_owned();
    let output = match Command::new("pgrep").arg("-f").arg(&pattern).output() {
        Ok(output) => output,
        Err(_) => return,
    };

    if !output.status.success() {
        return;
    }

    let current_pid = std::process::id();
    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines() {
        let Ok(pid) = line.trim().parse::<u32>() else {
            continue;
        };

        if pid == current_pid {
            continue;
        }

        let _ = Command::new("kill").arg(pid.to_string()).status();
    }

    std::thread::sleep(Duration::from_millis(300));
}

#[cfg(not(unix))]
fn stop_stale_sidecar_processes(_entry: &PathBuf) {}

fn start_sidecar_if_needed(app: &tauri::AppHandle) -> Result<u16, String> {
    let entry = resolve_sidecar_entry(app)?;
    stop_stale_sidecar_processes(&entry);
    let port = find_available_port().ok_or("No available port for bundled Sidecar")?;
    let server_dir = entry
        .parent()
        .ok_or("Invalid Sidecar entry path")?
        .to_path_buf();
    let default_cwd = resolve_sidecar_default_cwd();

    let bundled_runtime = resolve_node_runtime(app);
    let mut attempts: Vec<Option<PathBuf>> = Vec::new();
    if let Some(path) = bundled_runtime {
        attempts.push(Some(path));
    }
    attempts.push(None);

    let mut last_error: Option<String> = None;

    for runtime in attempts {
        let child = spawn_sidecar_server(&entry, &server_dir, &default_cwd, port, runtime.as_ref());
        let child = match child {
            Ok(child) => child,
            Err(err) => {
                last_error = Some(err);
                continue;
            }
        };

        {
            let state = app.state::<SidecarState>();
            let mut guard = state
                .child
                .lock()
                .map_err(|_| "Failed to lock Sidecar state".to_string())?;
            *guard = Some(child);

            let mut port_guard = state
                .port
                .lock()
                .map_err(|_| "Failed to lock Sidecar port state".to_string())?;
            *port_guard = Some(port);
        }

        if wait_for_port(port, SIDECAR_READY_TIMEOUT) {
            return Ok(port);
        }

        stop_sidecar_server(app);
        if runtime.is_some() {
            eprintln!(
                "Bundled node runtime failed to start Sidecar in time, falling back to system node..."
            );
        }
        last_error = Some("Bundled Sidecar did not become ready in time".to_string());
    }

    Err(last_error.unwrap_or_else(|| "Bundled Sidecar failed to start".to_string()))
}

#[tauri::command]
fn get_sidecar_port(state: tauri::State<SidecarState>) -> u16 {
    let guard = state.port.lock().unwrap();
    if let Some(port) = *guard {
        port
    } else {
        14321 // Dev mode fallback
    }
}

/// Resolve the path to ggbond.db, checking known locations in order of priority.
/// This mirrors the logic from the original lib/db.ts so we read the same database.
fn resolve_db_path() -> String {
    let home = dirs::home_dir().unwrap_or_default();

    // Candidate directories, ordered by priority (matching lib/db.ts resolveDbPath)
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    // 1. macOS app data locations
    #[cfg(target_os = "macos")]
    {
        let app_support = home.join("Library").join("Application Support");
        for name in &["ggbond", "GGBond", "gg-bond"] {
            candidates.push(app_support.join(name).join("gemini-home"));
            candidates.push(app_support.join(name));
        }
    }

    // 2. Linux XDG locations
    #[cfg(target_os = "linux")]
    {
        let data_dir = home.join(".local").join("share");
        for name in &["ggbond", "GGBond", "gg-bond"] {
            candidates.push(data_dir.join(name).join("gemini-home"));
            candidates.push(data_dir.join(name));
        }
    }

    // 3. Legacy CWD-based location
    candidates.push(std::env::current_dir().unwrap_or_default().join("gemini-home"));

    // 4. Fallback
    candidates.push(home.join(".ggbond"));

    // Check each candidate for an existing DB file first
    for candidate in &candidates {
        let db_file = candidate.join("ggbond.db");
        if db_file.exists() {
            return db_file.to_string_lossy().to_string();
        }
    }

    // If no existing DB found, create in the first writable candidate
    for candidate in &candidates {
        if std::fs::create_dir_all(candidate).is_ok() {
            return candidate.join("ggbond.db").to_string_lossy().to_string();
        }
    }

    // Ultimate fallback
    home.join(".ggbond").join("ggbond.db").to_string_lossy().to_string()
}

#[tauri::command]
fn get_db_url(state: tauri::State<DbUrlState>) -> String {
    state.0.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("Starting GGBond Tauri Engine...");

    let db_path = resolve_db_path();
    println!("Using database: {}", db_path);
    let db_url = format!("sqlite:{}", db_path);
    let db_url_for_state = db_url.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, vec![Migration {
                    version: 1,
                    description: "create_initial_tables",
                    sql: "
                        CREATE TABLE IF NOT EXISTS sessions (
                            id TEXT PRIMARY KEY,
                            title TEXT NOT NULL,
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER NOT NULL,
                            workspace TEXT,
                            branch TEXT,
                            archived INTEGER DEFAULT 0
                        );
                        CREATE TABLE IF NOT EXISTS messages (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            session_id TEXT NOT NULL,
                            role TEXT NOT NULL,
                            content TEXT NOT NULL,
                            stats TEXT,
                            thought TEXT,
                            citations TEXT,
                            images TEXT,
                            parent_id INTEGER,
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER,
                            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
                            FOREIGN KEY (parent_id) REFERENCES messages (id) ON DELETE CASCADE
                        );
                        CREATE TABLE IF NOT EXISTS confirmation_queue (
                            correlation_id TEXT PRIMARY KEY,
                            confirmed INTEGER NOT NULL,
                            outcome TEXT,
                            payload TEXT,
                            created_at INTEGER NOT NULL
                        );
                        CREATE TABLE IF NOT EXISTS undo_snapshots (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            session_id TEXT NOT NULL,
                            user_message_id INTEGER NOT NULL,
                            restore_id TEXT,
                            fallback_files TEXT,
                            created_at INTEGER NOT NULL,
                            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
                            FOREIGN KEY (user_message_id) REFERENCES messages (id) ON DELETE CASCADE,
                            UNIQUE(session_id, user_message_id)
                        );
                        CREATE TABLE IF NOT EXISTS background_jobs (
                            id TEXT PRIMARY KEY,
                            session_id TEXT NOT NULL,
                            user_message_id INTEGER,
                            status TEXT NOT NULL DEFAULT 'running',
                            current_content TEXT,
                            current_thought TEXT,
                            current_tool_calls TEXT,
                            error TEXT,
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER NOT NULL,
                            completed_at INTEGER,
                            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
                        );
                        CREATE TABLE IF NOT EXISTS agent_runs (
                            id TEXT PRIMARY KEY,
                            agent_name TEXT NOT NULL,
                            agent_display_name TEXT,
                            description TEXT,
                            task TEXT NOT NULL,
                            status TEXT NOT NULL DEFAULT 'pending',
                            workspace TEXT,
                            model TEXT,
                            result TEXT,
                            error TEXT,
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER NOT NULL,
                            completed_at INTEGER
                        );
                        CREATE TABLE IF NOT EXISTS tool_stats (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            tool_name TEXT NOT NULL,
                            session_id TEXT,
                            status TEXT NOT NULL DEFAULT 'success',
                            error_message TEXT,
                            duration_ms INTEGER,
                            created_at INTEGER NOT NULL
                        );
                        CREATE TABLE IF NOT EXISTS file_ops (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            file_path TEXT NOT NULL,
                            operation TEXT NOT NULL,
                            session_id TEXT,
                            workspace TEXT,
                            created_at INTEGER NOT NULL
                        );
                        CREATE TABLE IF NOT EXISTS message_queue (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            session_id TEXT NOT NULL,
                            content TEXT NOT NULL,
                            images TEXT,
                            status TEXT NOT NULL DEFAULT 'pending',
                            priority INTEGER NOT NULL DEFAULT 0,
                            created_at INTEGER NOT NULL,
                            started_at INTEGER,
                            completed_at INTEGER,
                            result_message_id TEXT,
                            error TEXT,
                            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
                        );
                        CREATE INDEX IF NOT EXISTS idx_message_queue_session ON message_queue(session_id);
                        CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status);
                        CREATE TABLE IF NOT EXISTS chat_snapshots (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            session_id TEXT NOT NULL,
                            tag TEXT NOT NULL,
                            title TEXT,
                            message_count INTEGER NOT NULL DEFAULT 0,
                            created_at INTEGER NOT NULL,
                            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
                            UNIQUE(session_id, tag)
                        );
                        CREATE TABLE IF NOT EXISTS app_config (
                            key TEXT PRIMARY KEY,
                            value TEXT NOT NULL,
                            updated_at INTEGER NOT NULL
                        );
                    ",
                    kind: MigrationKind::Up,
                }])
                .build(),
        )
        .manage(SidecarState::default())
        .manage(DbUrlState(db_url_for_state))
        .manage(pty::PtyState::default())
        .invoke_handler(tauri::generate_handler![
            pty::run_terminal_stream,
            pty::stop_terminal_stream,
            pty::write_terminal_input,
            get_sidecar_port,
            get_db_url
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_handle = app.handle().clone();
            if let Err(error) = start_sidecar_if_needed(&app_handle) {
                eprintln!("Bundled Node Sidecar bootstrap failed: {error}");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                pty::stop_all_terminal_streams(&window.app_handle());
                stop_sidecar_server(&window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
