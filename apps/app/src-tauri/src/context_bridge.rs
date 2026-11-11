use serde_json::{Value, json};
use std::{
    collections::HashSet,
    sync::{Mutex, OnceLock},
};
#[derive(Default)]
struct Session {
    binding: Option<String>,
    generation: u64,
    excluded: HashSet<String>,
}
static SESSION: OnceLock<Mutex<Session>> = OnceLock::new();
fn session() -> &'static Mutex<Session> {
    SESSION.get_or_init(|| Mutex::new(Session::default()))
}
#[tauri::command(async)]
pub fn context_bind() -> Result<String, String> {
    crate::app_control::bind()
}
#[tauri::command(async)]
pub fn context_enable(binding: Option<String>) -> Result<(), String> {
    let mut s = session().lock().map_err(|_| "Context lock failed")?;
    if let Some(b) = &binding {
        if s.excluded.contains(b) {
            return Err("Window excluded".into());
        }
    }
    s.binding = binding;
    s.generation += 1;
    Ok(())
}
#[tauri::command(async)]
pub fn context_exclude(binding: String) -> Result<(), String> {
    let mut s = session().lock().map_err(|_| "Context lock failed")?;
    s.excluded.insert(binding);
    s.binding = None;
    s.generation += 1;
    Ok(())
}
#[tauri::command(async)]
pub fn context_read(binding: String) -> Result<Value, String> {
    let generation = {
        let s = session().lock().map_err(|_| "Context lock failed")?;
        if s.binding.as_ref() != Some(&binding) || s.excluded.contains(&binding) {
            return Err("Explicitly enable this window first".into());
        }
        s.generation
    };
    let text = crate::app_control::execute("inspect", "", &binding)?;
    let s = session().lock().map_err(|_| "Context lock failed")?;
    if s.generation != generation || s.binding.as_ref() != Some(&binding) {
        return Err("Capture stopped; result discarded".into());
    }
    Ok(json!({"text":text,"source":"accessibility","trust":"untrusted"}))
}
