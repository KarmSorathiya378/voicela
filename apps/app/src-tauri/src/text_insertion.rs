//! Clipboard-free UIA plain-text mutations. Unsupported/rich controls fail closed.
use serde::{Deserialize, Serialize};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub token: String,
    pub text: String,
    pub password: bool,
    pub editable: bool,
    pub formatting: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub token: String,
    pub inserted_text: String,
}
#[cfg(windows)]
mod native {
    use super::*;
    use std::{
        collections::HashMap,
        sync::{OnceLock, mpsc},
        time::{Duration, Instant},
    };
    use windows::{
        Win32::{
            System::Com::{CLSCTX_ALL, CoCreateInstance},
            UI::Accessibility::*,
        },
        core::BSTR,
    };
    struct Entry {
        binding: String,
        element: IUIAutomationElement,
        value: String,
        selection: IUIAutomationTextRange,
        prefix: String,
        suffix: String,
        original: String,
        undo: bool,
        created: Instant,
    }
    struct Request {
        op: &'static str,
        token: String,
        text: String,
        reply: mpsc::Sender<Result<serde_json::Value, String>>,
    }
    static WORKER: OnceLock<mpsc::Sender<Request>> = OnceLock::new();
    fn err(e: windows::core::Error) -> String {
        e.to_string()
    }
    unsafe fn focused(uia: &IUIAutomation) -> Result<IUIAutomationElement, String> {
        unsafe {
            let element = uia.GetFocusedElement().map_err(err)?;
            if element
                .CurrentIsPassword()
                .map(|v| v.as_bool())
                .unwrap_or(true)
            {
                return Err(
                    "Protected or unverifiable field. Nothing was read or inserted.".into(),
                );
            }
            if !element.CurrentIsEnabled().map_err(err)?.as_bool() {
                return Err("Field is disabled".into());
            }
            Ok(element)
        }
    }
    unsafe fn value(element: &IUIAutomationElement) -> Result<IUIAutomationValuePattern, String> {
        unsafe {
            let value = element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId).map_err(|_| "This control does not support safe plain-text replacement. Your transcript is retained.".to_owned())?;
            if value.CurrentIsReadOnly().map_err(err)?.as_bool() {
                return Err("Field is read-only".into());
            }
            Ok(value)
        }
    }
    unsafe fn perform(
        uia: &IUIAutomation,
        entries: &mut HashMap<String, Entry>,
        request: &Request,
    ) -> Result<serde_json::Value, String> {
        unsafe {
            entries.retain(|_, entry| entry.created.elapsed() < Duration::from_secs(600));
            if request.op == "capture" {
                let binding = crate::app_control::bind()?;
                let element = focused(uia)?;
                let vp = value(&element)?;
                let full = vp.CurrentValue().map_err(err)?.to_string();
                if full.len() > 200_000 {
                    return Err("Text field exceeds safe editing limit".into());
                }
                let pattern = element
                    .GetCurrentPatternAs::<IUIAutomationTextPattern>(UIA_TextPatternId)
                    .map_err(|_| "Control cannot expose a safe selection/caret".to_owned())?;
                let ranges = pattern.GetSelection().map_err(err)?;
                if ranges.Length().map_err(err)? != 1 {
                    return Err("Select a single text range".into());
                }
                let selection = ranges.GetElement(0).map_err(err)?;
                let text = selection.GetText(-1).map_err(err)?.to_string();
                let before = pattern.DocumentRange().map_err(err)?;
                before
                    .MoveEndpointByRange(
                        TextPatternRangeEndpoint_End,
                        &selection,
                        TextPatternRangeEndpoint_Start,
                    )
                    .map_err(err)?;
                let prefix = before.GetText(-1).map_err(err)?.to_string();
                let after = pattern.DocumentRange().map_err(err)?;
                after
                    .MoveEndpointByRange(
                        TextPatternRangeEndpoint_Start,
                        &selection,
                        TextPatternRangeEndpoint_End,
                    )
                    .map_err(err)?;
                let suffix = after.GetText(-1).map_err(err)?.to_string();
                if format!("{prefix}{text}{suffix}") != full {
                    return Err(
                        "Control text and selection disagree. Safe editing is unavailable.".into(),
                    );
                }
                let token = uuid::Uuid::new_v4().to_string();
                if entries.len() >= 16 {
                    entries.clear();
                }
                entries.insert(
                    token.clone(),
                    Entry {
                        binding,
                        element,
                        value: full,
                        selection,
                        prefix,
                        suffix,
                        original: text.clone(),
                        undo: false,
                        created: Instant::now(),
                    },
                );
                return serde_json::to_value(Snapshot {
                    token,
                    text,
                    password: false,
                    editable: true,
                    formatting: "plain".into(),
                })
                .map_err(|e| e.to_string());
            }
            let entry = entries
                .get(&request.token)
                .ok_or("Text token expired or already used. Capture the selection again.")?;
            // Reuse the adapter to restore the reviewed target and enforce app exclusions.
            crate::app_control::execute("selection", "", &entry.binding)?;
            if crate::app_control::bind()? != entry.binding {
                return Err(
                    "Target changed. Focus the original app before applying or undoing.".into(),
                );
            }
            let element = focused(uia)?;
            if !uia
                .CompareElements(&element, &entry.element)
                .map_err(err)?
                .as_bool()
            {
                return Err("Focused field changed. No text replaced.".into());
            }
            let vp = value(&element)?;
            if vp.CurrentValue().map_err(err)?.to_string() != entry.value {
                return Err("Text changed since review. Capture and propose again.".into());
            }
            if request.op == "replace" {
                if entry.undo {
                    return Err("Invalid selection token".into());
                }
                let pattern = element
                    .GetCurrentPatternAs::<IUIAutomationTextPattern>(UIA_TextPatternId)
                    .map_err(err)?;
                let ranges = pattern.GetSelection().map_err(err)?;
                if ranges.Length().map_err(err)? != 1 {
                    return Err("Selection changed".into());
                }
                let selected = ranges.GetElement(0).map_err(err)?;
                if selected
                    .CompareEndpoints(
                        TextPatternRangeEndpoint_Start,
                        &entry.selection,
                        TextPatternRangeEndpoint_Start,
                    )
                    .map_err(err)?
                    != 0
                    || selected
                        .CompareEndpoints(
                            TextPatternRangeEndpoint_End,
                            &entry.selection,
                            TextPatternRangeEndpoint_End,
                        )
                        .map_err(err)?
                        != 0
                {
                    return Err("Selection changed. Review a new proposal.".into());
                }
                if request.text.len() > 100_000 || request.text.trim().is_empty() {
                    return Err("Replacement is empty or too large".into());
                }
                let replacement = format!("{}{}{}", entry.prefix, request.text, entry.suffix);
                vp.SetValue(&BSTR::from(&replacement)).map_err(err)?;
                // Consume before verification: a failed verification cannot replay a mutation.
                let mut entry = entries.remove(&request.token).ok_or("Token consumed")?;
                if vp.CurrentValue().map_err(err)?.to_string() != replacement {
                    return Err(
                        "App did not confirm replacement. Review the app; transcript retained."
                            .into(),
                    );
                }
                let token = uuid::Uuid::new_v4().to_string();
                entry.value = replacement;
                entry.undo = true;
                entries.insert(token.clone(), entry);
                return serde_json::to_value(Receipt {
                    token,
                    inserted_text: request.text.clone(),
                })
                .map_err(|e| e.to_string());
            }
            if request.op != "undo" || !entry.undo {
                return Err("Invalid undo token".into());
            }
            let original = format!("{}{}{}", entry.prefix, entry.original, entry.suffix);
            vp.SetValue(&BSTR::from(&original)).map_err(err)?;
            entries.remove(&request.token);
            if vp.CurrentValue().map_err(err)?.to_string() != original {
                return Err("App did not confirm undo. Inspect the field.".into());
            }
            Ok(serde_json::Value::Null)
        }
    }
    pub fn call(
        op: &'static str,
        token: String,
        text: String,
    ) -> Result<serde_json::Value, String> {
        let worker = WORKER.get_or_init(|| {
            let (tx, rx) = mpsc::channel::<Request>();
            std::thread::spawn(move || {
                let apartment = crate::windows_native::Apartment::new().map_err(err);
                let uia: Result<IUIAutomation, String> = apartment
                    .as_ref()
                    .map_err(Clone::clone)
                    .and_then(|_| unsafe {
                        CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL).map_err(err)
                    });
                let mut entries = HashMap::new();
                for request in rx {
                    let result = match &uia {
                        Ok(uia) => unsafe { perform(uia, &mut entries, &request) },
                        Err(error) => Err(error.clone()),
                    };
                    let _ = request.reply.send(result);
                }
            });
            tx
        });
        let (tx, rx) = mpsc::channel();
        worker
            .send(Request {
                op,
                token,
                text,
                reply: tx,
            })
            .map_err(|_| "Text worker unavailable")?;
        rx.recv()
            .map_err(|_| "Text worker disconnected".to_owned())?
    }
}
#[cfg(not(windows))]
mod native {
    pub fn call(_: &'static str, _: String, _: String) -> Result<serde_json::Value, String> {
        Err("Safe text editing requires Windows".into())
    }
}
#[tauri::command(async)]
pub fn text_capture() -> Result<serde_json::Value, String> {
    native::call("capture", String::new(), String::new())
}
#[tauri::command(async)]
pub fn text_replace(token: String, text: String) -> Result<serde_json::Value, String> {
    native::call("replace", token, text)
}
#[tauri::command(async)]
pub fn text_undo(token: String) -> Result<serde_json::Value, String> {
    native::call("undo", token, String::new())
}
