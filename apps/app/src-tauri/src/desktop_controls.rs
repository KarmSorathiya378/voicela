use tauri::{Emitter, Manager};
#[tauri::command]
pub fn panel_window(app: tauri::AppHandle, action: String) -> Result<(), String> {
    let label = if action == "main" { "main" } else { "panel" };
    if let Some(w) = app.get_webview_window(label) {
        if action == "hide" {
            w.hide()
        } else {
            w.show().and_then(|_| w.set_focus())
        }
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
pub fn startup_enabled() -> Result<bool, String> {
    #[cfg(windows)]
    {
        use winreg::{RegKey, enums::*};
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")
            .map_err(|e| e.to_string())?;
        Ok(key.get_value::<String, _>("Voicela").is_ok())
    }
    #[cfg(not(windows))]
    {
        Err("Startup requires Windows".into())
    }
}
#[tauri::command]
pub fn set_startup(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use winreg::{RegKey, enums::*};
        let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
            .create_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")
            .map_err(|e| e.to_string())?;
        if enabled {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            key.set_value("Voicela", &format!("\"{}\"", exe.display()))
                .map_err(|e| e.to_string())?;
        } else if startup_enabled()? {
            key.delete_value("Voicela").map_err(|e| e.to_string())?;
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Startup requires Windows".into())
    }
}
pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::TrayIconBuilder,
    };
    tauri::WebviewWindowBuilder::new(
        app,
        "panel",
        tauri::WebviewUrl::App("index.html?panel".into()),
    )
    .title("Voicela voice panel")
    .inner_size(360., 300.)
    .resizable(false)
    .always_on_top(true)
    .visible(false)
    .build()?;
    let main = MenuItem::with_id(app, "workspace", "Open workspace", true, None::<&str>)?;
    let panel = MenuItem::with_id(app, "voice-panel", "Show voice panel", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause-voice", "Pause listening", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit-voicela", "Quit Voicela", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&main, &panel, &pause, &quit])?;
    let mut tray = TrayIconBuilder::new()
        .tooltip("Voicela")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "workspace" => {
                let _ = panel_window(app.clone(), "main".into());
            }
            "voice-panel" => {
                let _ = panel_window(app.clone(), "show".into());
            }
            "pause-voice" => {
                let _ = app.emit("panel-action", "pause");
            }
            "quit-voicela" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}
#[tauri::command]
pub fn set_panel_shortcut(app: tauri::AppHandle, value: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
    static CURRENT: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);
    let parsed = value.parse::<Shortcut>().map_err(|e| e.to_string())?;
    let mut current = CURRENT.lock().map_err(|_| "Shortcut lock failed")?;
    if current.as_deref() == Some(&value) {
        return Ok(());
    }
    if app.global_shortcut().is_registered(parsed) {
        return Err("Shortcut is already assigned in Voicela".into());
    }
    app.global_shortcut()
        .on_shortcut(parsed, |app, _, event| {
            if event.state == ShortcutState::Pressed {
                let _ = panel_window(app.clone(), "show".into());
            }
        })
        .map_err(|e| format!("Shortcut unavailable or in use: {e}"))?;
    if let Some(old) = current.as_ref() {
        if let Err(error) = app.global_shortcut().unregister(old.as_str()) {
            let _ = app.global_shortcut().unregister(parsed);
            return Err(error.to_string());
        }
    }
    *current = Some(value.clone());
    std::fs::write(
        app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("panel-shortcut.txt"),
        value,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn panel_voice(app: tauri::AppHandle, action: String) -> Result<(), String> {
    if !["toggle", "pause", "dictation", "edit", "assistant"].contains(&action.as_str()) {
        return Err("Unsupported panel action".into());
    }
    app.emit_to("main", "panel-action", action)
        .map_err(|e| e.to_string())
}
