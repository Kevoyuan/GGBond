mod pty;

use std::process::Child;
use std::sync::Mutex;
use tauri::{Manager, WindowEvent};

#[cfg(not(debug_assertions))]
use std::net::{TcpListener, TcpStream};
#[cfg(not(debug_assertions))]
use std::path::PathBuf;
#[cfg(not(debug_assertions))]
use std::process::{Command, Stdio};
#[cfg(not(debug_assertions))]
use std::time::{Duration, Instant};

#[cfg(not(debug_assertions))]
const NEXT_HOST: &str = "127.0.0.1";
#[cfg(not(debug_assertions))]
const NEXT_PORT_START: u16 = 45123;
#[cfg(not(debug_assertions))]
const NEXT_PORT_END: u16 = 45160;
#[cfg(not(debug_assertions))]
const NEXT_READY_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Default)]
struct NextServerState {
    child: Mutex<Option<Child>>,
}

#[cfg(not(debug_assertions))]
fn find_available_port() -> Option<u16> {
    for port in NEXT_PORT_START..=NEXT_PORT_END {
        if TcpListener::bind((NEXT_HOST, port)).is_ok() {
            return Some(port);
        }
    }
    None
}

#[cfg(not(debug_assertions))]
fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if TcpStream::connect((NEXT_HOST, port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(120));
    }
    false
}

#[cfg(not(debug_assertions))]
fn resolve_next_server_entry(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?;
    let candidates = [
        resource_dir.join("next-standalone").join("server.js"),
        resource_dir
            .join("resources")
            .join("next-standalone")
            .join("server.js"),
    ];
    for entry in candidates {
        if entry.exists() {
            return Ok(entry);
        }
    }
    Err(format!(
        "Missing bundled Next server entry under {}",
        resource_dir.display()
    ))
}

fn stop_next_server(app: &tauri::AppHandle) {
    let state = app.state::<NextServerState>();
    let mut guard = match state.child.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg(not(debug_assertions))]
fn start_next_server_if_needed(app: &tauri::AppHandle) -> Result<String, String> {
    let port = find_available_port().ok_or("No available port for bundled Next server")?;
    let entry = resolve_next_server_entry(app)?;
    let server_dir = entry
        .parent()
        .ok_or("Invalid Next server entry path")?
        .to_path_buf();

    let mut command = Command::new("node");
    command
        .arg(&entry)
        .current_dir(&server_dir)
        .env("NODE_ENV", "production")
        .env("HOSTNAME", NEXT_HOST)
        .env("PORT", port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit());

    let child = command
        .spawn()
        .map_err(|e| format!("Failed to start bundled Next server: {e}"))?;

    {
        let state = app.state::<NextServerState>();
        let mut guard = state
            .child
            .lock()
            .map_err(|_| "Failed to lock Next server state".to_string())?;
        *guard = Some(child);
    }

    if !wait_for_port(port, NEXT_READY_TIMEOUT) {
        stop_next_server(app);
        return Err("Bundled Next server did not become ready in time".to_string());
    }

    Ok(format!("http://{NEXT_HOST}:{port}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("Starting GGBond Tauri Engine...");

    tauri::Builder::default()
        .manage(NextServerState::default())
        .manage(pty::PtyState::default())
        .invoke_handler(tauri::generate_handler![
            pty::run_terminal_stream,
            pty::stop_terminal_stream,
            pty::write_terminal_input
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(not(debug_assertions))]
            {
                let app_handle = app.handle().clone();
                match start_next_server_if_needed(&app_handle) {
                    Ok(url) => {
                        if let Some(window) = app.get_webview_window("main") {
                            let redirect_js = format!("window.location.replace({url:?});");
                            if let Err(error) = window.eval(&redirect_js) {
                                eprintln!(
                                    "Failed to redirect main window to bundled Next server ({url}): {error}"
                                );
                            }
                        }
                    }
                    Err(error) => {
                        eprintln!("Bundled Next server bootstrap failed: {error}");
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                pty::stop_all_terminal_streams(&window.app_handle());
                stop_next_server(&window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
