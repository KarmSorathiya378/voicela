use crate::tools::ToolName;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Permission {
    pub enabled: bool,
    pub requires_approval: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct PrivacySettings {
    pub onboarding_complete: bool,
    pub language: String,
    pub tools: BTreeMap<String, bool>,
    pub integrations: BTreeMap<String, bool>,
    pub retention_days: u32,
    pub diagnostics: bool,
}
impl Default for PrivacySettings {
    fn default() -> Self {
        Self {
            onboarding_complete: false,
            language: "en".into(),
            tools: BTreeMap::new(),
            integrations: BTreeMap::new(),
            retention_days: 0,
            diagnostics: false,
        }
    }
}
static STORE: OnceLock<Mutex<(PathBuf, PrivacySettings)>> = OnceLock::new();
fn read_settings(path: &Path) -> Result<PrivacySettings, String> {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|e| e.to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(PrivacySettings::default()),
        Err(e) => Err(e.to_string()),
    }
}
fn persist(path: &Path, settings: &PrivacySettings) -> Result<(), String> {
    let temp = path.with_extension("tmp");
    std::fs::write(
        &temp,
        serde_json::to_vec_pretty(settings).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    // Windows rename cannot replace an existing destination. Copy the complete staged file.
    std::fs::copy(&temp, path).map_err(|e| e.to_string())?;
    std::fs::remove_file(temp).map_err(|e| e.to_string())?;
    Ok(())
}
pub fn initialize(directory: &Path) -> Result<(), String> {
    std::fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let path = directory.join("privacy.json");
    let value = read_settings(&path)?;
    STORE
        .set(Mutex::new((path, value)))
        .map_err(|_| "Privacy already initialized")?;
    Ok(())
}
#[tauri::command]
pub fn get_privacy_settings() -> Result<PrivacySettings, String> {
    Ok(STORE
        .get()
        .ok_or("Privacy unavailable")?
        .lock()
        .map_err(|_| "Privacy lock failed")?
        .1
        .clone())
}
#[tauri::command]
pub fn set_privacy_settings(settings: PrivacySettings) -> Result<(), String> {
    if ![0, 1, 7, 30, 90].contains(&settings.retention_days)
        || !["en", "auto", "hi", "gu"].contains(&settings.language.as_str())
    {
        return Err("Unsupported privacy preference".into());
    }
    let mut guard = STORE
        .get()
        .ok_or("Privacy unavailable")?
        .lock()
        .map_err(|_| "Privacy lock failed")?;
    persist(&guard.0, &settings)?;
    guard.1 = settings;
    drop(guard);
    enforce_retention()
}
pub fn integration_enabled(name: &str) -> bool {
    get_privacy_settings()
        .map(|s| s.integrations.get(name) == Some(&true))
        .unwrap_or(false)
}
pub fn policy(tool: ToolName) -> Permission {
    let key = serde_json::to_value(tool)
        .unwrap()
        .as_str()
        .unwrap()
        .to_owned();
    let enabled = get_privacy_settings()
        .map(|s| s.tools.get(&key) == Some(&true))
        .unwrap_or(cfg!(test));
    Permission {
        enabled,
        requires_approval: !matches!(tool, ToolName::OpenApp | ToolName::FindFile),
    }
}
fn history_connection() -> Result<rusqlite::Connection, String> {
    let guard = STORE
        .get()
        .ok_or("Privacy unavailable")?
        .lock()
        .map_err(|_| "Privacy lock failed")?;
    rusqlite::Connection::open(guard.0.parent().unwrap().join("activity.sqlite3"))
        .map_err(|e| e.to_string())
}
pub fn enforce_retention() -> Result<(), String> {
    let days = get_privacy_settings()?.retention_days;
    let c = history_connection()?;
    c.execute_batch("PRAGMA secure_delete=ON;")
        .map_err(|e| e.to_string())?;
    c.execute(
        "DELETE FROM activity_log WHERE ?1=0 OR julianday(timestamp)<julianday('now')-?1",
        [days],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn delete_private_history() -> Result<(), String> {
    let c = history_connection()?;
    c.execute_batch("PRAGMA secure_delete=ON; DELETE FROM activity_log; VACUUM;")
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn export_private_history() -> Result<String, String> {
    enforce_retention()?;
    let c = history_connection()?;
    let mut statement = c
        .prepare("SELECT timestamp,tool,intent,status FROM activity_log ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows=statement.query_map([],|r|Ok(serde_json::json!({"timestamp":r.get::<_,String>(0)?,"tool":r.get::<_,String>(1)?,"intent":r.get::<_,String>(2)?,"status":r.get::<_,String>(3)?}))).map_err(|e|e.to_string())?;
    let values = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let guard = STORE
        .get()
        .ok_or("Privacy unavailable")?
        .lock()
        .map_err(|_| "Privacy lock failed")?;
    let path = guard
        .0
        .parent()
        .unwrap()
        .join(format!("history-export-{}.json", uuid::Uuid::new_v4()));
    std::fs::write(
        &path,
        serde_json::to_vec_pretty(&values).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}
/// Allowlist only: unstructured text and unknown fields are never diagnostic output.
pub fn redact_diagnostics(value: &serde_json::Value) -> serde_json::Value {
    let mut result = serde_json::Map::new();
    for key in ["latency_ms", "error_count", "session_count"] {
        if let Some(number) = value.get(key).and_then(|v| v.as_u64()) {
            result.insert(key.into(), number.into());
        }
    }
    serde_json::Value::Object(result)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn minimal_defaults_and_persistence() {
        let path = std::env::temp_dir().join(format!("privacy-{}.json", uuid::Uuid::new_v4()));
        let mut s = read_settings(&path).unwrap();
        assert!(s.tools.is_empty());
        assert!(s.integrations.is_empty());
        assert_eq!(s.retention_days, 0);
        s.tools.insert("open_app".into(), true);
        s.onboarding_complete = true;
        persist(&path, &s).unwrap();
        let loaded = read_settings(&path).unwrap();
        assert!(loaded.onboarding_complete);
        assert_eq!(loaded.tools.get("open_app"), Some(&true));
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn diagnostics_never_copy_sensitive_values() {
        let output = redact_diagnostics(
            &serde_json::json!({"email":"a@b.com","transcript":"secret","file_contents":"secret","latency_ms":"a@b.com","session_count":3,"nested":{"secret":"password"}}),
        );
        assert_eq!(output, serde_json::json!({"session_count":3}));
    }
}
