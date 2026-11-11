#[cfg(windows)]
mod native {
    use crate::windows_native::Apartment;
    use windows::Win32::{
        Foundation::HWND,
        System::Com::{CLSCTX_ALL, CoCreateInstance},
        UI::{Accessibility::*, WindowsAndMessaging::*},
    };
    fn title(hwnd: HWND) -> String {
        let mut text = [0; 1024];
        let len = unsafe { GetWindowTextW(hwnd, &mut text) };
        String::from_utf16_lossy(&text[..len.max(0) as usize])
    }
    pub fn bind() -> Result<String, String> {
        let (window, pid) = crate::platform::foreground_target();
        crate::adapter_policy::check(pid)?;
        if window == 0 || pid == std::process::id() {
            return Err(
                "Focus the app you want to control, then use Ctrl+Space to give the command."
                    .into(),
            );
        }
        Ok(format!("{window}:{pid}:{}", title(HWND(window as *mut _))))
    }
    fn resolve(binding: &str) -> Result<(HWND, u32), String> {
        let mut parts = binding.splitn(3, ':');
        let window = parts
            .next()
            .and_then(|v| v.parse::<usize>().ok())
            .ok_or("Invalid window target")?;
        let expected_pid = parts
            .next()
            .and_then(|v| v.parse::<u32>().ok())
            .ok_or("Invalid window process")?;
        let expected_title = parts.next().ok_or("Window title is missing")?;
        let hwnd = HWND(window as *mut _);
        let mut pid = 0;
        unsafe {
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
        }
        if pid == 0
            || pid != expected_pid
            || pid == std::process::id()
            || title(hwnd) != expected_title
        {
            return Err(
                "The target app or window changed. Give a new command for the intended window."
                    .into(),
            );
        }
        crate::adapter_policy::check(pid)?;
        Ok((hwnd, pid))
    }
    fn elements(
        uia: &IUIAutomation,
        root: IUIAutomationElement,
    ) -> windows::core::Result<Vec<IUIAutomationElement>> {
        unsafe {
            let walker = uia.ControlViewWalker()?;
            let mut queue = std::collections::VecDeque::from([root]);
            let mut all = Vec::new();
            while let Some(element) = queue.pop_front() {
                if element
                    .CurrentIsPassword()
                    .map(|v| v.as_bool())
                    .unwrap_or(true)
                {
                    continue;
                }
                if all.len() >= 500 {
                    break;
                }
                if let Ok(mut child) = walker.GetFirstChildElement(&element) {
                    loop {
                        if queue.len() + all.len() >= 500 {
                            break;
                        }
                        queue.push_back(child.clone());
                        match walker.GetNextSiblingElement(&child) {
                            Ok(next) => child = next,
                            Err(_) => break,
                        }
                    }
                }
                all.push(element);
            }
            Ok(all)
        }
    }
    pub fn execute(action: &str, target: &str, binding: &str) -> Result<String, String> {
        let action = action.to_owned();
        let target = target.to_owned();
        let binding = binding.to_owned();
        std::thread::spawn(move || {
            let _apartment = Apartment::new().map_err(|e| e.to_string())?;
            let (hwnd, pid) = resolve(&binding)?;
            unsafe {
                if action != "inspect" && !SetForegroundWindow(hwnd).as_bool() { return Err("Windows did not allow focus to return to the target app.".into()); }
                let safety_uia: IUIAutomation = CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
                let focused = safety_uia.GetFocusedElement().map_err(|_| "Cannot verify focused control safety")?;
                if focused.CurrentIsPassword().map(|v| v.as_bool()).unwrap_or(true) { return Err("Password or unverifiable focused control excluded".into()); }
                if action == "selection" {
                    if focused.CurrentProcessId().map_err(|e| e.to_string())? as u32 != pid { return Err("Focus changed".into()); }
                    let pattern = focused.GetCurrentPatternAs::<IUIAutomationTextPattern>(UIA_TextPatternId).map_err(|_| "Focused control does not expose selected text")?;
                    let ranges = pattern.GetSelection().map_err(|e| e.to_string())?;
                    let mut text = String::new();
                    for i in 0..ranges.Length().map_err(|e| e.to_string())?.min(8) { text.push_str(&ranges.GetElement(i).and_then(|r| r.GetText(8192)).map_err(|e| e.to_string())?.to_string()); }
                    return Ok(text.chars().take(8192).collect());
                }
                if action == "type" || action == "key" {
                    if !SetForegroundWindow(hwnd).as_bool() { return Err("Windows did not allow focus to return to the target app. Focus it and try again.".into()); }
                    std::thread::sleep(std::time::Duration::from_millis(120));
                    if crate::platform::foreground_target() != (hwnd.0 as usize, pid) { return Err("Focus changed. No keyboard input was sent.".into()); }
                    if action == "type" { crate::platform::insert_text((hwnd.0 as usize, pid), &target)?; return Ok("Text inserted into the approved app. No Enter key was pressed.".into()); }
                    crate::platform::send_shortcut(&target)?;
                    return Ok(format!("Sent {target} to the approved app."));
                }
                let uia: IUIAutomation = CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
                let root = uia.ElementFromHandle(hwnd).map_err(|e| e.to_string())?;
                let controls = elements(&uia, root).map_err(|e| e.to_string())?;
                if action == "inspect" {
                    let mut names = Vec::new();
                    for element in &controls {
                        if element.CurrentIsOffscreen().map(|v| v.as_bool()).unwrap_or(true) || element.CurrentIsPassword().map(|v| v.as_bool()).unwrap_or(true) { continue; }
                        let name = element.CurrentName().map(|v| v.to_string()).unwrap_or_default();
                        if !name.trim().is_empty() { let name = name.chars().take(160).collect::<String>(); if !names.contains(&name) { names.push(name); } }
                        if names.len() >= 80 { break; }
                    }
                    return Ok(format!("{} ? visible accessible controls (bounded to 500 elements / 80 labels):\n{}", title(hwnd), names.join("\n")));
                }
                if action == "click" {
                    let matching: Vec<_> = controls.iter().filter(|element| {
                        !element.CurrentIsOffscreen().map(|v| v.as_bool()).unwrap_or(true)
                        && element.CurrentIsEnabled().map(|v| v.as_bool()).unwrap_or(false)
                        && !element.CurrentIsPassword().map(|v| v.as_bool()).unwrap_or(true)
                        && element.CurrentName().map(|v| v.to_string().trim().eq_ignore_ascii_case(target.trim())).unwrap_or(false)
                    }).collect();
                    if matching.len() != 1 { return Err(format!("Found {} visible controls named {target}. Say Inspect current app and use an exact, unique control label.", matching.len())); }
                    let element = matching[0];
                    if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId) { pattern.Invoke().map_err(|e| e.to_string())?; }
                    else if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationSelectionItemPattern>(UIA_SelectionItemPatternId) { pattern.Select().map_err(|e| e.to_string())?; }
                    else if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationExpandCollapsePattern>(UIA_ExpandCollapsePatternId) { pattern.Expand().map_err(|e| e.to_string())?; }
                    else if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationTogglePattern>(UIA_TogglePatternId) { pattern.Toggle().map_err(|e| e.to_string())?; }
                    else if matches!(element.CurrentControlType(), Ok(kind) if kind == UIA_EditControlTypeId || kind == UIA_DocumentControlTypeId) { element.SetFocus().map_err(|e| e.to_string())?; }
                    else { return Err("That control does not expose a supported click action. No coordinate click was guessed.".into()); }
                    return Ok(format!("Invoked {target} in {}. Check the app for its result.", title(hwnd)));
                }
                if action == "scroll" {
                    let (horizontal, vertical) = match target.as_str() {
                        "down" => (ScrollAmount_NoAmount, ScrollAmount_LargeIncrement), "up" => (ScrollAmount_NoAmount, ScrollAmount_LargeDecrement),
                        "right" => (ScrollAmount_LargeIncrement, ScrollAmount_NoAmount), "left" => (ScrollAmount_LargeDecrement, ScrollAmount_NoAmount), _ => return Err("Use up, down, left or right".into()),
                    };
                    for element in &controls {
                        if element.CurrentIsOffscreen().map(|v| v.as_bool()).unwrap_or(true) { continue; }
                        if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationScrollPattern>(UIA_ScrollPatternId)
                            && pattern.Scroll(horizontal, vertical).is_ok() { return Ok(format!("Scrolled {target} in the approved app.")); }
                    }
                    return Err("This window does not expose a scrollable accessibility control. Try Press PageDown or PageUp.".into());
                }
                Err("Unsupported app-control action".into())
            }
        }).join().map_err(|_| "App control worker failed".to_owned())?
    }
}
#[cfg(windows)]
pub use native::{bind, execute};
#[cfg(not(windows))]
pub fn bind() -> Result<String, String> {
    Err("App control requires Windows".into())
}
#[cfg(not(windows))]
pub fn execute(_: &str, _: &str, _: &str) -> Result<String, String> {
    Err("App control requires Windows".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_window_binding_cannot_control_a_different_app() {
        assert!(execute("click", "Send", "0:0:missing").is_err());
        assert!(execute("type", "must not type", "foreground").is_err());
    }
}
