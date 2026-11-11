use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::HashSet,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Region {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}
#[derive(Clone)]
struct Snapshot {
    id: String,
    text: String,
    source: String,
    region: Option<Region>,
    at: Instant,
}
#[derive(Default)]
struct Session {
    binding: Option<String>,
    generation: u64,
    pixels: bool,
    excluded: HashSet<String>,
    snapshot: Option<Snapshot>,
    busy: bool,
}
static SESSION: OnceLock<Mutex<Session>> = OnceLock::new();
fn session() -> &'static Mutex<Session> {
    SESSION.get_or_init(|| Mutex::new(Session::default()))
}
fn authorized(s: &Session, binding: &str, generation: u64) -> bool {
    s.binding.as_deref() == Some(binding)
        && !s.excluded.contains(binding)
        && s.generation == generation
}
#[tauri::command(async)]
pub fn context_bind() -> Result<String, String> {
    require_context_permission()?;
    crate::app_control::bind()
}
#[tauri::command(async)]
pub fn context_enable(
    binding: Option<String>,
    screenshot_permission: Option<bool>,
) -> Result<(), String> {
    if binding.is_some() { require_context_permission()?; }
    let mut s = session().lock().map_err(|_| "Context lock failed")?;
    if binding.as_ref().is_some_and(|b| s.excluded.contains(b)) {
        return Err("Window excluded".into());
    }
    s.binding = binding;
    s.pixels = s.binding.is_some() && screenshot_permission == Some(true);
    s.generation += 1;
    s.snapshot = None;
    Ok(())
}
#[tauri::command(async)]
pub fn context_exclude(binding: String) -> Result<(), String> {
    let mut s = session().lock().map_err(|_| "Context lock failed")?;
    s.excluded.insert(binding);
    s.binding = None;
    s.pixels = false;
    s.generation += 1;
    s.snapshot = None;
    Ok(())
}
#[tauri::command(async)]
pub fn context_read(
    binding: String,
    source: Option<String>,
    region: Option<Region>,
    capture_id: Option<String>,
) -> Result<Value, String> {
    let (generation, source, region, previous) = {
        let mut s = session().lock().map_err(|_| "Context lock failed")?;
        if !authorized(&s, &binding, s.generation) {
            return Err("Explicitly enable this window first".into());
        }
        if s.busy {
            return Err("A context capture is already running".into());
        }
        let previous = if let Some(id) = capture_id {
            Some(
                s.snapshot
                    .clone()
                    .filter(|v| v.id == id && v.at.elapsed() <= Duration::from_secs(30))
                    .ok_or("Context expired or replaced. Capture again.")?,
            )
        } else {
            None
        };
        let source = previous
            .as_ref()
            .map(|v| v.source.clone())
            .unwrap_or_else(|| source.unwrap_or_else(|| "accessibility".into()));
        let region = previous
            .as_ref()
            .map(|v| v.region.clone())
            .unwrap_or(region);
        if source != "accessibility" && source != "ocr" {
            return Err("Unsupported capture source".into());
        }
        if source == "ocr" && !s.pixels {
            return Err("Explicit screenshot permission is required".into());
        }
        if let Some(r) = &region {
            validate_region(r)?;
        }
        require_context_permission()?;
        s.busy = true;
        (s.generation, source, region, previous)
    };
    let result = capture(&binding, &source, region.as_ref(), generation);
    let mut s = session().lock().map_err(|_| "Context lock failed")?;
    s.busy = false;
    if let Err(error) = require_context_permission() {
        s.snapshot = None;
        return Err(error);
    }
    if !authorized(&s, &binding, generation) {
        return Err("Capture stopped; result discarded".into());
    }
    let text = match result {
        Ok(text) => text.chars().take(24000).collect::<String>(),
        Err(e) => {
            s.snapshot = None;
            return Err(e);
        }
    };
    if let Some(old) = previous {
        if old.text != text || old.at.elapsed() > Duration::from_secs(30) {
            s.snapshot = None;
            return Err("Page changed or expired. Capture again before using it.".into());
        }
        return Ok(json!({"valid":true,"captureId":old.id}));
    }
    if text.trim().is_empty() {
        s.snapshot = None;
        return Err(
            "No readable text found. Try a different region or accessibility capture.".into(),
        );
    }
    let id = uuid::Uuid::new_v4().to_string();
    s.snapshot = Some(Snapshot {
        id: id.clone(),
        text: text.clone(),
        source: source.clone(),
        region: region.clone(),
        at: Instant::now(),
    });
    Ok(json!({"text":text,"source":source,"trust":"untrusted","captureId":id,"region":region}))
}
fn require_context_permission() -> Result<(), String> {
    if crate::permission::integration_enabled("page_context") {
        Ok(())
    } else {
        Err("Enable page context in privacy settings first".into())
    }
}
fn validate_region(r: &Region) -> Result<(), String> {
    if r.width == 0
        || r.height == 0
        || r.width > 4096
        || r.height > 4096
        || r.x.checked_add(r.width).is_none()
        || r.y.checked_add(r.height).is_none()
    {
        return Err("Region must be inside the window, between 1 and 4096 pixels per side".into());
    }
    Ok(())
}
fn capture(
    binding: &str,
    source: &str,
    region: Option<&Region>,
    generation: u64,
) -> Result<String, String> {
    // Rechecks window/process/title, protected desktop and adapter allow/exclude policy.
    verify_binding(binding)?;
    if source == "accessibility" {
        let text = safe_labels(binding, generation)?;
        verify_binding(binding)?;
        return Ok(text);
    }
    local_ocr(binding, region, generation)
}
#[cfg(windows)]
fn verify_binding(binding: &str) -> Result<(), String> {
    use windows::Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{GetWindowTextW, GetWindowThreadProcessId},
    };
    let mut parts = binding.splitn(3, ':');
    let window = parts
        .next()
        .and_then(|v| v.parse::<usize>().ok())
        .ok_or("Invalid context window")?;
    let pid = parts
        .next()
        .and_then(|v| v.parse::<u32>().ok())
        .ok_or("Invalid context process")?;
    let title = parts.next().ok_or("Context title missing")?;
    let mut actual = 0;
    let mut text = [0; 1024];
    let hwnd = HWND(window as *mut _);
    let len = unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut actual));
        GetWindowTextW(hwnd, &mut text)
    };
    if actual == 0
        || actual != pid
        || actual == std::process::id()
        || String::from_utf16_lossy(&text[..len.max(0) as usize]) != title
    {
        return Err("Context window changed. Select and capture it again.".into());
    }
    crate::adapter_policy::check(pid)
}
#[cfg(not(windows))]
fn verify_binding(_: &str) -> Result<(), String> {
    Err("Screen context requires Windows".into())
}
#[cfg(windows)]
fn safe_labels(binding: &str, generation: u64) -> Result<String, String> {
    use windows::Win32::{
        Foundation::HWND,
        System::Com::{CLSCTX_ALL, CoCreateInstance},
        UI::Accessibility::*,
    };
    let window = binding
        .split(':')
        .next()
        .and_then(|v| v.parse::<usize>().ok())
        .ok_or("Invalid context window")?;
    let binding = binding.to_owned();
    std::thread::spawn(move || -> Result<String, String> {
        let _apartment = crate::windows_native::Apartment::new().map_err(|e| e.to_string())?;
        unsafe {
            let uia: IUIAutomation =
                CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
            let root = uia
                .ElementFromHandle(HWND(window as *mut _))
                .map_err(|e| e.to_string())?;
            let walker = uia.RawViewWalker().map_err(|e| e.to_string())?;
            let mut queue = std::collections::VecDeque::from([root]);
            let mut labels = Vec::new();
            let mut count = 0;
            while let Some(element) = queue.pop_front() {
                if !session()
                    .lock()
                    .map(|s| authorized(&s, &binding, generation))
                    .unwrap_or(false)
                {
                    return Err("Capture stopped; result discarded".into());
                }
                count += 1;
                if count > 2000 {
                    return Err("Accessibility traversal incomplete; capture refused".into());
                }
                // Skip the entire subtree before reading its name or value.
                if element
                    .CurrentIsOffscreen()
                    .map(|v| v.as_bool())
                    .unwrap_or(true)
                    || element
                        .CurrentIsPassword()
                        .map(|v| v.as_bool())
                        .unwrap_or(true)
                    || element
                        .CurrentControlType()
                        .map(|v| v == UIA_EditControlTypeId)
                        .unwrap_or(true)
                {
                    continue;
                }
                if let Ok(value) =
                    element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
                {
                    if !value
                        .CurrentIsReadOnly()
                        .map(|v| v.as_bool())
                        .unwrap_or(false)
                    {
                        continue;
                    }
                }
                let name = element
                    .CurrentName()
                    .map_err(|_| "Unverifiable accessible label")?
                    .to_string();
                let lower = name.to_lowercase();
                if [
                    "password",
                    "passcode",
                    "credit card",
                    "card number",
                    "security code",
                    "secret key",
                    "api key",
                    "recovery phrase",
                    "verification code",
                    "one-time code",
                ]
                .iter()
                .any(|v| lower.contains(v))
                {
                    continue;
                }
                if !name.trim().is_empty() && labels.len() < 160 {
                    labels.push(name.chars().take(200).collect::<String>());
                }
                if let Ok(mut child) = walker.GetFirstChildElement(&element) {
                    loop {
                        if queue.len() + count >= 2000 {
                            return Err(
                                "Accessibility traversal incomplete; capture refused".into()
                            );
                        }
                        queue.push_back(child.clone());
                        match walker.GetNextSiblingElement(&child) {
                            Ok(next) => child = next,
                            Err(_) => break,
                        }
                    }
                }
            }
            Ok(labels.join("\n"))
        }
    })
    .join()
    .map_err(|_| "Context accessibility worker failed")?
}
#[cfg(not(windows))]
fn safe_labels(_: &str, _: u64) -> Result<String, String> {
    Err("Screen context requires Windows".into())
}
#[cfg(windows)]
fn local_ocr(binding: &str, region: Option<&Region>, generation: u64) -> Result<String, String> {
    use base64::Engine;
    use std::{
        io::Read,
        os::windows::process::CommandExt,
        process::{Command, Stdio},
    };
    // Fixed embedded script: page text and window titles are never interpolated into code.
    let encoded = base64::engine::general_purpose::STANDARD.encode(
        include_str!("context_ocr.ps1")
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>(),
    );
    let powershell = std::path::PathBuf::from(
        std::env::var_os("SystemRoot").ok_or("Windows directory unavailable")?,
    )
    .join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let mut child = Command::new(powershell)
        .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded])
        .env(
            "VOICELA_CAPTURE",
            json!({"binding":binding,"region":region}).to_string(),
        )
        .creation_flags(0x08000000)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let mut stdout = child.stdout.take().ok_or("OCR output unavailable")?;
    let mut stderr = child.stderr.take().ok_or("OCR error output unavailable")?;
    let out = std::thread::spawn(move || {
        let mut b = String::new();
        let _ = stdout.read_to_string(&mut b);
        b
    });
    let err = std::thread::spawn(move || {
        let mut b = String::new();
        let _ = stderr.read_to_string(&mut b);
        b
    });
    let start = Instant::now();
    let status = loop {
        let allowed = session()
            .lock()
            .map(|s| authorized(&s, binding, generation))
            .unwrap_or(false);
        if !allowed || verify_binding(binding).is_err() || start.elapsed() > Duration::from_secs(25)
        {
            let _ = child.kill();
            let _ = child.wait();
            let _ = out.join();
            let _ = err.join();
            return Err("Capture stopped or OCR timed out; pixels and text discarded".into());
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => std::thread::sleep(Duration::from_millis(40)),
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(e.to_string());
            }
        }
    };
    let output = out.join().map_err(|_| "OCR output worker failed")?;
    let error = err.join().map_err(|_| "OCR error worker failed")?;
    if !status.success() {
        return Err(format!(
            "Local OCR refused capture: {}",
            error.chars().take(1000).collect::<String>()
        ));
    }
    verify_binding(binding)?;
    serde_json::from_str::<String>(output.trim())
        .map_err(|_| "Local OCR returned invalid text".into())
}
#[cfg(not(windows))]
fn local_ocr(_: &str, _: Option<&Region>, _: u64) -> Result<String, String> {
    Err("Local screen OCR requires Windows".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_and_exclusion_invalidate_permission() {
        let mut s = Session {
            binding: Some("target".into()),
            generation: 4,
            ..Default::default()
        };
        assert!(authorized(&s, "target", 4));
        assert!(!authorized(&s, "other", 4));
        s.generation += 1;
        assert!(!authorized(&s, "target", 4));
        s.excluded.insert("target".into());
        assert!(!authorized(&s, "target", 5));
    }
    #[test]
    fn regions_are_bounded_without_overflow() {
        assert!(
            validate_region(&Region {
                x: 0,
                y: 0,
                width: 500,
                height: 200
            })
            .is_ok()
        );
        assert!(
            validate_region(&Region {
                x: u32::MAX,
                y: 0,
                width: 1,
                height: 200
            })
            .is_err()
        );
        assert!(
            validate_region(&Region {
                x: 0,
                y: 0,
                width: 0,
                height: 200
            })
            .is_err()
        );
        assert!(
            validate_region(&Region {
                x: 0,
                y: 0,
                width: 4097,
                height: 200
            })
            .is_err()
        );
    }
    #[test]
    fn pixel_capture_requires_separate_explicit_consent() {
        // Seed only the session binding; the global integration grant remains off.
        session().lock().unwrap().binding = Some("test-only-window".into());
        let error =
            context_read("test-only-window".into(), Some("ocr".into()), None, None).unwrap_err();
        assert!(error.contains("screenshot permission"));
        assert!(context_read("test-only-window".into(), None, None, None)
            .unwrap_err().contains("privacy settings"));
        assert!(context_enable(Some("test-only-window".into()), None)
            .unwrap_err().contains("privacy settings"));
        context_enable(None, None).unwrap();
        assert!(
            context_read("test-only-window".into(), None, None, None)
                .unwrap_err()
                .contains("enable")
        );
    }
}
