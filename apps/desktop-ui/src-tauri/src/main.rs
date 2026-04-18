#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs::{self, OpenOptions},
    io::{self, Write},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Mutex, MutexGuard},
    thread,
    time::{Duration, SystemTime},
};
use tauri::Manager;

const LOCAL_API_ADDRESS: &str = "127.0.0.1:3001";
const LOCAL_API_START_TIMEOUT: Duration = Duration::from_secs(15);
const LOCAL_API_POLL_INTERVAL: Duration = Duration::from_millis(250);

struct ManagedApiState(Mutex<Option<Child>>);

struct RuntimePaths {
    working_dir: PathBuf,
    api_entry_path: PathBuf,
    node_path: Option<PathBuf>,
    db_path: PathBuf,
    log_path: PathBuf,
}

fn is_local_api_running() -> bool {
    let address: SocketAddr = LOCAL_API_ADDRESS.parse().expect("valid local API address");
    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn wait_for_local_api(timeout: Duration) -> bool {
    let deadline = SystemTime::now() + timeout;
    while SystemTime::now() < deadline {
        if is_local_api_running() {
            return true;
        }

        thread::sleep(LOCAL_API_POLL_INTERVAL);
    }

    is_local_api_running()
}

fn find_repo_root(mut current: PathBuf) -> Option<PathBuf> {
    loop {
        if current.file_name().and_then(|name| name.to_str()) == Some("starline") {
            return Some(current);
        }

        current = current.parent()?.to_path_buf();
    }
}

fn create_parent_dir(path: &Path) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other(format!("missing parent directory for {}", path.display())))?;
    fs::create_dir_all(parent)
}

fn normalize_child_path(path: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        let normalized = path.display().to_string();
        if let Some(stripped) = normalized.strip_prefix(r"\\?\") {
            return PathBuf::from(stripped);
        }
    }

    path
}

fn append_log(log_path: &Path, message: &str) -> io::Result<()> {
    create_parent_dir(log_path)?;
    let mut file = OpenOptions::new().create(true).append(true).open(log_path)?;
    writeln!(file, "{message}")
}

fn resolve_runtime_paths(app: &tauri::AppHandle) -> io::Result<RuntimePaths> {
    if cfg!(debug_assertions) {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let repo_root = find_repo_root(manifest_dir)
            .ok_or_else(|| io::Error::other("failed to locate repo root in dev mode"))?;
        let local_api_dir = repo_root.join("apps").join("local-api");

        return Ok(RuntimePaths {
            working_dir: normalize_child_path(local_api_dir.clone()),
            api_entry_path: normalize_child_path(local_api_dir.join("dist").join("index.js")),
            node_path: None,
            db_path: normalize_child_path(local_api_dir.join("starline-dev.db")),
            log_path: normalize_child_path(local_api_dir.join("local-api.dev.log")),
        });
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| io::Error::other(format!("failed to resolve resource dir: {error}")))?;
    let app_local_data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| io::Error::other(format!("failed to resolve app local data dir: {error}")))?;
    let resource_root = if resource_dir.join("local-api").exists() {
        resource_dir.clone()
    } else {
        resource_dir.join("resources")
    };
    let local_api_dir = resource_root.join("local-api");
    let api_entry_path = local_api_dir.join("index.cjs");
    let node_path = resource_root.join("runtime").join("node.exe");

    if !api_entry_path.exists() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("packaged local-api entry missing at {}", api_entry_path.display()),
        ));
    }

    if !node_path.exists() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("packaged node runtime missing at {}", node_path.display()),
        ));
    }

    fs::create_dir_all(&app_local_data_dir)?;

    Ok(RuntimePaths {
        working_dir: normalize_child_path(local_api_dir),
        api_entry_path: normalize_child_path(api_entry_path),
        node_path: Some(normalize_child_path(node_path)),
        db_path: normalize_child_path(app_local_data_dir.join("starline.db")),
        log_path: normalize_child_path(app_local_data_dir.join("logs").join("local-api.log")),
    })
}

fn spawn_local_api(runtime_paths: &RuntimePaths) -> io::Result<Child> {
    create_parent_dir(&runtime_paths.log_path)?;

    let stdout_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&runtime_paths.log_path)?;
    let stderr_log = stdout_log.try_clone()?;

    let mut command = if cfg!(debug_assertions) {
        let mut command = Command::new("pnpm.cmd");
        command.arg("--dir").arg(&runtime_paths.working_dir).arg("dev");
        command
    } else {
        let node_path = runtime_paths
            .node_path
            .as_ref()
            .ok_or_else(|| io::Error::other("missing packaged node runtime"))?;
        let mut command = Command::new(node_path);
        command.arg(&runtime_paths.api_entry_path);
        command
    };

    command
        .current_dir(&runtime_paths.working_dir)
        .env("PORT", "3001")
        .env("DB_PATH", &runtime_paths.db_path)
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log))
        .spawn()
        .map_err(|error| io::Error::other(format!("failed to spawn local-api: {error}")))
}

fn main() {
    let managed_api_state = ManagedApiState(Mutex::new(None));

    tauri::Builder::default()
        .manage(managed_api_state)
        .setup(|app| {
            if is_local_api_running() {
                return Ok(());
            }

            let runtime_paths = match resolve_runtime_paths(app.handle()) {
                Ok(paths) => paths,
                Err(_) => return Ok(()),
            };

            let _ = append_log(
                &runtime_paths.log_path,
                &format!(
                    "[launcher] starting local-api cwd={} entry={} db={}",
                    runtime_paths.working_dir.display(),
                    runtime_paths.api_entry_path.display(),
                    runtime_paths.db_path.display(),
                ),
            );

            match spawn_local_api(&runtime_paths) {
                Ok(mut child) => {
                    if wait_for_local_api(LOCAL_API_START_TIMEOUT) {
                        let state: tauri::State<'_, ManagedApiState> = app.state();
                        let mut guard: MutexGuard<'_, Option<Child>> =
                            state.0.lock().expect("managed API state lock");
                        *guard = Some(child);
                    } else {
                        let status = child
                            .try_wait()
                            .map_err(|error| io::Error::other(format!("failed to inspect local-api exit status: {error}")))
                            .ok()
                            .flatten();
                        let status_suffix = status
                            .map(|exit_status| format!("process exited with status {exit_status}"))
                            .unwrap_or_else(|| "process is still running without opening the port".to_string());
                        let error_message = format!(
                            "Local API did not become ready within {} seconds; {status_suffix}.",
                            LOCAL_API_START_TIMEOUT.as_secs(),
                        );
                        let _ = append_log(&runtime_paths.log_path, &format!("[launcher] {error_message}"));
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
                Err(error) => {
                    let _ = append_log(&runtime_paths.log_path, &format!("[launcher] {error}"));
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state: tauri::State<'_, ManagedApiState> = window.state();
                let mut guard: MutexGuard<'_, Option<Child>> =
                    state.0.lock().expect("managed API state lock");
                let child_process: Option<Child> = guard.take();
                if let Some(mut child) = child_process {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running StarLine desktop shell");
}
