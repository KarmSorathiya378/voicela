pub mod activity_log;
mod engine;
pub mod permission;
pub mod state;
pub mod tools;

use activity_log::ActivityEntry;
use engine::{Engine, RunResponse, StateSnapshot};
use state::AppState;
use std::sync::Mutex;
use tauri::Manager;
use tools::{ToolDescriptor, ToolInput, ToolName};

type Core<'a> = tauri::State<'a, Mutex<Engine>>;

#[tauri::command]
fn get_state(core: Core<'_>) -> Result<StateSnapshot, String> {
    Ok(core.lock().map_err(|_| "Core lock poisoned")?.snapshot())
}
#[tauri::command]
fn set_state(state: AppState, core: Core<'_>) -> Result<StateSnapshot, String> {
    let mut engine = core.lock().map_err(|_| "Core lock poisoned")?;
    engine.set_capture_state(state)?;
    Ok(engine.snapshot())
}
#[tauri::command]
fn get_tools(core: Core<'_>) -> Result<Vec<ToolDescriptor>, String> {
    Ok(core
        .lock()
        .map_err(|_| "Core lock poisoned")?
        .registry
        .descriptors())
}
#[tauri::command]
fn run_tool(request: ToolInput, intent: String, core: Core<'_>) -> Result<RunResponse, String> {
    core.lock()
        .map_err(|_| "Core lock poisoned")?
        .run(request, intent)
}
#[tauri::command]
fn approve_tool(
    approval_id: String,
    approved: bool,
    core: Core<'_>,
) -> Result<RunResponse, String> {
    core.lock()
        .map_err(|_| "Core lock poisoned")?
        .approve(&approval_id, approved)
}
#[tauri::command]
fn get_activity_log(limit: Option<u32>, core: Core<'_>) -> Result<Vec<ActivityEntry>, String> {
    core.lock()
        .map_err(|_| "Core lock poisoned")?
        .log
        .recent(limit.unwrap_or(50))
}
#[tauri::command]
fn clear_activity_log(core: Core<'_>) -> Result<(), String> {
    let engine = core.lock().map_err(|_| "Core lock poisoned")?;
    if engine.snapshot().pending_approval.is_some() {
        return Err("Resolve the pending approval before clearing history".into());
    }
    engine.log.clear()
}
#[tauri::command]
fn append_activity_log(tool: ToolName, intent: String, core: Core<'_>) -> Result<(), String> {
    engine::validate_intent(&intent)?;
    let engine = core.lock().map_err(|_| "Core lock poisoned")?;
    engine.registry.get(tool)?;
    // Clients may add notes, but cannot forge execution or approval records.
    engine
        .log
        .append(tool, &intent, activity_log::ActivityStatus::ClientNote)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let log = activity_log::ActivityLog::open(&directory.join("activity.sqlite3"))
                .map_err(std::io::Error::other)?;
            app.manage(Mutex::new(Engine::new(log)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            set_state,
            run_tool,
            approve_tool,
            get_activity_log,
            clear_activity_log,
            append_activity_log,
            get_tools
        ])
        .run(tauri::generate_context!())
        .expect("Voicela failed to start");
}
