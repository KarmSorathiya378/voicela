use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AppPolicy {
    pub allowed: Vec<String>,
    pub excluded: Vec<String>,
}
static POLICY: OnceLock<Mutex<AppPolicy>> = OnceLock::new();
fn policy() -> &'static Mutex<AppPolicy> {
    POLICY.get_or_init(|| Mutex::new(AppPolicy::default()))
}
pub fn load(path: &std::path::Path) {
    if let Ok(bytes) = std::fs::read(path) {
        if let Ok(value) = serde_json::from_slice(&bytes) {
            *policy().lock().unwrap() = value;
        }
    }
}
#[tauri::command]
pub fn get_app_policy() -> Result<AppPolicy, String> {
    Ok(policy().lock().map_err(|_| "Policy lock failed")?.clone())
}
#[tauri::command]
pub fn set_app_policy(app: tauri::AppHandle, value: AppPolicy) -> Result<(), String> {
    use tauri::Manager;
    if value.allowed.len() + value.excluded.len() > 200
        || value
            .allowed
            .iter()
            .chain(&value.excluded)
            .any(|v| v.is_empty() || v.len() > 260 || v.contains(['/', '\\']))
    {
        return Err("Use executable basenames, up to 200 entries".into());
    }
    let mut guard = policy().lock().map_err(|_| "Policy lock failed")?;
    std::fs::write(
        app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("app-policy.json"),
        serde_json::to_vec(&value).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    *guard = value;
    Ok(())
}
#[cfg(windows)]
pub fn check(pid: u32) -> Result<(), String> {
    use std::ffi::c_void;
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut c_void;
        fn QueryFullProcessImageNameW(
            process: *mut c_void,
            flags: u32,
            name: *mut u16,
            size: *mut u32,
        ) -> i32;
        fn CloseHandle(handle: *mut c_void) -> i32;
    }
    #[link(name = "user32")]
    unsafe extern "system" {
        fn OpenInputDesktop(flags: u32, inherit: i32, access: u32) -> *mut c_void;
        fn CloseDesktop(handle: *mut c_void) -> i32;
        fn GetUserObjectInformationW(
            handle: *mut c_void,
            index: i32,
            info: *mut c_void,
            len: u32,
            needed: *mut u32,
        ) -> i32;
    }
    unsafe {
        let desktop = OpenInputDesktop(0, 0, 1);
        if desktop.is_null() {
            return Err("Secure desktop excluded".into());
        }
        let mut name = [0u16; 256];
        let mut needed = 0;
        let ok = GetUserObjectInformationW(desktop, 2, name.as_mut_ptr().cast(), 512, &mut needed);
        CloseDesktop(desktop);
        if ok == 0
            || String::from_utf16_lossy(&name[..name.iter().position(|v| *v == 0).unwrap_or(256)])
                != "Default"
        {
            return Err("Protected desktop excluded".into());
        }
        let process = OpenProcess(0x1000, 0, pid);
        if process.is_null() {
            return Err("Protected process excluded".into());
        }
        let mut path = [0u16; 32768];
        let mut len = path.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, path.as_mut_ptr(), &mut len);
        CloseHandle(process);
        if ok == 0 {
            return Err("Cannot verify target process".into());
        }
        let path = String::from_utf16_lossy(&path[..len as usize]);
        let exe = path.rsplit('\\').next().unwrap_or("").to_lowercase();
        let policy = get_app_policy()?;
        evaluate(&policy, &exe)
    }
}
fn evaluate(policy: &AppPolicy, exe: &str) -> Result<(), String> {
    if [
        "winlogon.exe",
        "logonui.exe",
        "consent.exe",
        "credentialuibroker.exe",
        "keepass.exe",
        "1password.exe",
        "bitwarden.exe",
    ]
    .contains(&exe)
        || policy.excluded.iter().any(|v| v.eq_ignore_ascii_case(exe))
        || (!policy.allowed.is_empty()
            && !policy.allowed.iter().any(|v| v.eq_ignore_ascii_case(exe)))
    {
        return Err("Application excluded by privacy policy".into());
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exclusion_wins() {
        let p = AppPolicy {
            allowed: vec!["editor.exe".into()],
            excluded: vec!["editor.exe".into()],
        };
        assert!(evaluate(&p, "editor.exe").is_err());
        assert!(evaluate(&p, "other.exe").is_err());
        assert!(evaluate(&AppPolicy::default(), "logonui.exe").is_err());
    }
}
#[tauri::command(async)]
pub fn adapter_read(selection: bool) -> Result<serde_json::Value, String> {
    let binding = crate::app_control::bind()?;
    let text = crate::app_control::execute(
        if selection { "selection" } else { "inspect" },
        "",
        &binding,
    )?;
    Ok(
        serde_json::json!({"binding":binding,"text":text,"trust":"untrusted","source":"windows-uia"}),
    )
}
#[tauri::command(async)]
pub fn adapter_action(binding:String, action:String, target:String, core:tauri::State<'_,Mutex<crate::engine::Engine>>) -> Result<crate::engine::RunResponse,String> {
 if !["type","click","scroll","key"].contains(&action.as_str()) {return Err("Unsupported adapter action".into());}
 let mut engine=core.lock().map_err(|_|"Core lock failed")?;
 if crate::app_control::bind()? != binding {return Err("Focus changed. Refocus the selected application and retry.".into());}
 let request=serde_json::from_value(serde_json::json!({"tool":"control_app","input":{"action":action,"target":target,"window":"foreground"}})).map_err(|e|e.to_string())?;
 engine.run(request,"Apply reviewed application action".into())
}
