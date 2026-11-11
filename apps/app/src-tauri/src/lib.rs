pub mod activity_log;
mod adapter_policy;
mod app_control;
#[cfg(windows)]
mod audio_capture;
mod context_bridge;
mod desktop_controls;
mod endpoint;
mod engine;
mod google;
pub mod permission;
mod platform;
mod text_insertion;
mod speech;
pub mod state;
pub mod tools;
mod whisper;
#[cfg(windows)]
mod windows_native;

use activity_log::ActivityEntry;
use engine::{Engine, RunResponse, StateSnapshot};
use state::AppState;
use std::sync::Mutex;
use tauri::Manager;
use tools::{ToolDescriptor, ToolInput, ToolName};

type Core<'a> = tauri::State<'a, Mutex<Engine>>;

#[tauri::command(async)]
fn get_state(core: Core<'_>) -> Result<StateSnapshot, String> {
    Ok(core.lock().map_err(|_| "Core lock poisoned")?.snapshot())
}
#[tauri::command(async)]
fn set_state(state: AppState, core: Core<'_>) -> Result<StateSnapshot, String> {
    let mut engine = core.lock().map_err(|_| "Core lock poisoned")?;
    engine.set_capture_state(state)?;
    Ok(engine.snapshot())
}
#[tauri::command(async)]
fn get_tools(core: Core<'_>) -> Result<Vec<ToolDescriptor>, String> {
    Ok(core
        .lock()
        .map_err(|_| "Core lock poisoned")?
        .registry
        .descriptors())
}
#[tauri::command(async)]
fn run_tool(request: ToolInput, intent: String, core: Core<'_>) -> Result<RunResponse, String> {
    core.lock()
        .map_err(|_| "Core lock poisoned")?
        .run(request, intent)
}
#[tauri::command(async)]
fn approve_tool(
    approval_id: String,
    approved: bool,
    core: Core<'_>,
) -> Result<RunResponse, String> {
    core.lock()
        .map_err(|_| "Core lock poisoned")?
        .approve(&approval_id, approved)
}
#[tauri::command(async)]
fn get_activity_log(limit: Option<u32>, core: Core<'_>) -> Result<Vec<ActivityEntry>, String> {
    core.lock()
        .map_err(|_| "Core lock poisoned")?
        .log
        .recent(limit.unwrap_or(50))
}
#[tauri::command(async)]
fn clear_activity_log(core: Core<'_>) -> Result<(), String> {
    let engine = core.lock().map_err(|_| "Core lock poisoned")?;
    if engine.snapshot().pending_approval.is_some() {
        return Err("Resolve the pending approval before clearing history".into());
    }
    engine.log.clear()
}
#[tauri::command(async)]
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
        .manage(speech::SpeechCapture::default())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::Builder;
                app.handle().plugin(Builder::new().build())?;
            }
            desktop_controls::setup(app)?;
            let directory = app.path().app_data_dir()?;
            adapter_policy::load(&directory.join("app-policy.json"));
            std::fs::create_dir_all(&directory)?;
            if let Ok(shortcut) = std::fs::read_to_string(directory.join("panel-shortcut.txt")) {
                if let Err(error) =
                    desktop_controls::set_panel_shortcut(app.handle().clone(), shortcut)
                {
                    eprintln!("Panel shortcut: {error}");
                }
            }
            let log = activity_log::ActivityLog::open(&directory.join("activity.sqlite3"))
                .map_err(std::io::Error::other)?;
            permission::initialize(&directory).map_err(std::io::Error::other)?;
            permission::enforce_retention().map_err(std::io::Error::other)?;
            app.manage(Mutex::new(Engine::new(log)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            permission::get_privacy_settings,
            permission::set_privacy_settings,
            permission::export_private_history,
            permission::delete_private_history,
            adapter_policy::get_app_policy,
            adapter_policy::set_app_policy,
            adapter_policy::adapter_read,
            adapter_policy::adapter_action,
            text_insertion::text_capture,
            text_insertion::text_replace,
            text_insertion::text_undo,
            desktop_controls::set_panel_shortcut,
            desktop_controls::panel_voice,
            desktop_controls::panel_window,
            desktop_controls::startup_enabled,
            desktop_controls::set_startup,
            google::google_connect,
            google::google_disconnect,
            google::google_preview,
            google::google_confirm,
            context_bridge::context_bind,
            context_bridge::context_enable,
            context_bridge::context_exclude,
            context_bridge::context_read,
            get_state,
            set_state,
            run_tool,
            approve_tool,
            get_activity_log,
            clear_activity_log,
            append_activity_log,
            get_tools,
            speech::start_speech,
            speech::stop_speech,
            speech::speech_devices,
            speech::start_listening,
            speech::stop_listening,
            speech::speech_level
        ])
        .run(tauri::generate_context!())
        .expect("Voicela failed to start");
}
