use windows::Win32::System::Com::{COINIT_MULTITHREADED, CoInitializeEx, CoUninitialize};
pub struct Apartment;
impl Apartment {
    pub fn new() -> windows::core::Result<Self> {
        unsafe {
            CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
        }
        Ok(Self)
    }
}
impl Drop for Apartment {
    fn drop(&mut self) {
        unsafe {
            CoUninitialize();
        }
    }
}

pub fn installed_app(name: &str) -> Result<String, String> {
    let name = name.to_owned();
    std::thread::spawn(move || unsafe {
        use windows::Win32::System::Com::CoTaskMemFree;
        use windows::Win32::UI::Shell::*;
        use windows::core::{PCWSTR, w};
        let _apartment = Apartment::new().map_err(|e| e.to_string())?;
        let folder: IShellItem =
            SHCreateItemFromParsingName(w!("shell:AppsFolder"), None).map_err(|e| e.to_string())?;
        let items: IEnumShellItems = folder
            .BindToHandler(None, &BHID_EnumItems)
            .map_err(|e| e.to_string())?;
        let wanted = match name.trim().to_lowercase().as_str() {
            "chrome" => "google chrome".to_owned(),
            "edge" => "microsoft edge".to_owned(),
            "vscode" | "vs code" => "visual studio code".to_owned(),
            value => value.to_owned(),
        };
        let mut matches = Vec::new();
        loop {
            let mut next = [None];
            let mut fetched = 0;
            items
                .Next(&mut next, Some(&mut fetched))
                .map_err(|e| e.to_string())?;
            if fetched == 0 {
                break;
            }
            let item = next[0]
                .take()
                .ok_or("Windows returned an empty app entry")?;
            let display = item
                .GetDisplayName(SIGDN_NORMALDISPLAY)
                .map_err(|e| e.to_string())?;
            let display_text = display.to_string().map_err(|e| e.to_string());
            CoTaskMemFree(Some(display.0.cast()));
            if display_text?.trim().to_lowercase() == wanted {
                let parsing = item
                    .GetDisplayName(SIGDN_DESKTOPABSOLUTEPARSING)
                    .map_err(|e| e.to_string())?;
                let value = PCWSTR(parsing.0).to_string().map_err(|e| e.to_string());
                CoTaskMemFree(Some(parsing.0.cast()));
                matches.push(value?);
            }
        }
        if matches.len() != 1 {
            return Err(format!(
                "App not found or name is ambiguous: {name}. Use its exact Windows Start menu name."
            ));
        }
        let parsing = matches.remove(0);
        let prefix = "::{4234d49b-0245-4df3-b780-3893943456e1}\\";
        if parsing.to_lowercase().starts_with(prefix) {
            Ok(format!("shell:AppsFolder\\{}", &parsing[prefix.len()..]))
        } else {
            Ok(parsing)
        }
    })
    .join()
    .map_err(|_| "Windows app lookup failed".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "Reads the real Windows AppsFolder; run explicitly"]
    fn windows_apps_catalogue_uses_native_shell() {
        assert!(installed_app("Calculator").is_ok());
        assert!(installed_app("nonexistent-voicela-app & notepad.exe").is_err());
    }
}
