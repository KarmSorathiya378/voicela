use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub fn app_alias(name: &str) -> Option<&'static str> {
    match name
        .trim()
        .to_lowercase()
        .trim_end_matches('.')
        .trim_end_matches(".exe")
    {
        "notepad" | "note pad" => Some("notepad.exe"),
        "calculator" | "calc" => Some("calc.exe"),
        "paint" | "mspaint" => Some("mspaint.exe"),
        "file explorer" | "explorer" => Some("explorer.exe"),
        _ => None,
    }
}
pub fn open_app(name: &str) -> Result<String, String> {
    if !cfg!(windows) {
        return Err("App launching currently requires Windows".into());
    }
    if let Some(exe) = app_alias(name) {
        let root = std::env::var_os("SystemRoot").ok_or("Windows directory is unavailable")?;
        let path = PathBuf::from(root).join("System32").join(exe);
        spawn(&path, &[])?;
    } else {
        #[cfg(windows)]
        {
            let item = crate::windows_native::installed_app(name)?;
            let root = std::env::var_os("SystemRoot").ok_or("Windows directory unavailable")?;
            spawn(&PathBuf::from(root).join("explorer.exe"), &[&item])?;
        }
    }
    Ok(format!(
        "Windows accepted the launch request for {}. Check its window or taskbar.",
        name.trim()
    ))
}
fn spawn(program: &Path, args: &[&str]) -> Result<(), String> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command
        .spawn()
        .map_err(|e| format!("Windows could not open the application: {e}"))?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}
pub fn search_url(query: &str) -> String {
    let encoded: String = query
        .as_bytes()
        .iter()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b"-._~".contains(b) {
                (*b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect();
    format!("https://www.google.com/search?q={encoded}")
}
pub fn browser_search(query: &str) -> Result<String, String> {
    if !cfg!(windows) {
        return Err("Browser launch currently requires Windows".into());
    }
    let root = std::env::var_os("SystemRoot").ok_or("Windows directory is unavailable")?;
    let url = search_url(query);
    spawn(&PathBuf::from(root).join("explorer.exe"), &[&url])?;
    Ok("Windows accepted the web search request in your default browser.".into())
}
pub fn local_drive_roots() -> Vec<PathBuf> {
    #[cfg(windows)]
    unsafe {
        #[link(name = "kernel32")]
        unsafe extern "system" {
            fn GetLogicalDrives() -> u32;
            fn GetDriveTypeW(root: *const u16) -> u32;
        }
        let mask = GetLogicalDrives();
        (0..26)
            .filter(|i| mask & (1 << i) != 0)
            .filter_map(|i| {
                let name = format!("{}:\\", (b'A' + i) as char);
                let wide: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
                if [2, 3].contains(&GetDriveTypeW(wide.as_ptr())) {
                    Some(PathBuf::from(name))
                } else {
                    None
                }
            })
            .collect()
    }
    #[cfg(not(windows))]
    Vec::new()
}
pub fn find_files(query: &str) -> Result<String, String> {
    let home = std::env::var_os("USERPROFILE").ok_or("Windows user folder is unavailable")?;
    let home = PathBuf::from(home);
    let mut roots = vec![
        home.join("Desktop"),
        home.join("Documents"),
        home.join("Downloads"),
    ];
    if let Some(one_drive) = std::env::var_os("OneDrive") {
        roots.extend([
            PathBuf::from(&one_drive).join("Desktop"),
            PathBuf::from(one_drive).join("Documents"),
        ]);
    }
    let drives = local_drive_roots();
    let drive_names = drives
        .iter()
        .map(|p| p.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");
    roots.extend(drives);
    let mut queue: std::collections::VecDeque<_> = roots.into_iter().map(|p| (p, 0)).collect();
    let mut visited = std::collections::HashSet::new();
    let mut found = Vec::new();
    let needle = query.to_lowercase();
    let mut checked = 0;
    let mut skipped = 0;
    let mut depth_limited = false;
    let started = std::time::Instant::now();
    while let Some((directory, depth)) = queue.pop_front() {
        if !visited.insert(directory.to_string_lossy().to_lowercase()) {
            continue;
        }
        let Ok(entries) = std::fs::read_dir(directory) else {
            skipped += 1;
            continue;
        };
        for entry in entries.flatten() {
            checked += 1;
            if checked > 50_000 || found.len() >= 100 || started.elapsed().as_secs() >= 5 {
                break;
            }
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            if kind.is_symlink() {
                continue;
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if entry
                    .metadata()
                    .map(|m| m.file_attributes() & 0x400 != 0)
                    .unwrap_or(true)
                {
                    continue;
                }
            }
            if kind.is_dir() {
                if depth < 8 {
                    queue.push_back((entry.path(), depth + 1));
                } else {
                    depth_limited = true;
                }
            }
            if kind.is_file()
                && entry
                    .file_name()
                    .to_string_lossy()
                    .to_lowercase()
                    .contains(&needle)
            {
                let path = entry.path().display().to_string();
                if !found.contains(&path) {
                    found.push(path);
                }
            }
        }
        if checked > 50_000 || found.len() >= 100 || started.elapsed().as_secs() >= 5 {
            break;
        }
    }
    let limited = !queue.is_empty()
        || depth_limited
        || found.len() >= 100
        || checked > 50_000
        || started.elapsed().as_secs() >= 5;
    Ok(format!(
        "Searched accessible local drives ({drive_names}), prioritizing your Desktop, Documents and Downloads. Read-only filename search, at most 8 folders deep, 50,000 entries, 100 results and 5 seconds. Unavailable folders: {skipped}. {}\n{}",
        if limited {
            "Scan limits reached: these results are incomplete."
        } else {
            "Scan completed within those bounds."
        },
        if found.is_empty() {
            "No matching filenames found in the scanned scope.".into()
        } else {
            found.join("\n")
        }
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn app_names_are_data_not_commands() {
        assert_eq!(app_alias("Notepad.exe"), Some("notepad.exe"));
        assert_eq!(app_alias("calculator"), Some("calc.exe"));
        assert_eq!(app_alias("notepad & whoami"), None);
        assert_eq!(app_alias("C:\\evil.exe"), None);
    }
    #[test]
    fn search_query_cannot_escape_url_parameter() {
        assert_eq!(
            search_url("a &b=#\u{4e2d}"),
            "https://www.google.com/search?q=a%20%26b%3D%23%E4%B8%AD"
        );
    }
}

#[cfg(windows)]
mod keyboard {
    use std::ffi::c_void;
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Mouse {
        dx: i32,
        dy: i32,
        data: u32,
        flags: u32,
        time: u32,
        extra: usize,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Key {
        vk: u16,
        scan: u16,
        flags: u32,
        time: u32,
        extra: usize,
    }
    #[repr(C)]
    union Payload {
        mouse: Mouse,
        key: Key,
    }
    #[repr(C)]
    struct Input {
        kind: u32,
        payload: Payload,
    }
    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetForegroundWindow() -> *mut c_void;
        fn GetWindowThreadProcessId(window: *mut c_void, process: *mut u32) -> u32;
        fn GetAsyncKeyState(key: i32) -> i16;
        fn SendInput(count: u32, inputs: *const Input, size: i32) -> u32;
    }
    pub fn target() -> (usize, u32) {
        unsafe {
            let window = GetForegroundWindow();
            let mut process = 0;
            GetWindowThreadProcessId(window, &mut process);
            (window as usize, process)
        }
    }
    pub fn insert(target_window: (usize, u32), text: &str) -> Result<(), String> {
        if target_window.0 == 0 || target_window.1 == std::process::id() {
            return Err(
                "Focus a text field in another app and use Ctrl+Space for dictation.".into(),
            );
        }
        // Release shortcut modifiers before injecting Unicode; never inject shortcuts or Enter.
        for _ in 0..40 {
            let held = [0x10, 0x11, 0x12, 0x5b, 0x5c]
                .iter()
                .any(|key| unsafe { GetAsyncKeyState(*key) < 0 });
            if !held {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        if target() != target_window {
            return Err("Focus changed during dictation. Your transcript is kept in Voicela; copy it to the intended app.".into());
        }
        if [0x10, 0x11, 0x12, 0x5b, 0x5c]
            .iter()
            .any(|key| unsafe { GetAsyncKeyState(*key) < 0 })
        {
            return Err("Release Ctrl, Shift, Alt and Windows keys before dictating again. Your transcript is kept in Voicela.".into());
        }
        let inputs: Vec<Input> = text
            .encode_utf16()
            .flat_map(|scan| {
                [0x0004, 0x0006].map(|flags| Input {
                    kind: 1,
                    payload: Payload {
                        key: Key {
                            vk: 0,
                            scan,
                            flags,
                            time: 0,
                            extra: 0,
                        },
                    },
                })
            })
            .collect();
        let sent = unsafe {
            SendInput(
                inputs.len() as u32,
                inputs.as_ptr(),
                std::mem::size_of::<Input>() as i32,
            )
        };
        if sent != inputs.len() as u32 {
            return Err("Windows blocked some or all text insertion. Elevated apps may reject it. Review the target before copying the retained transcript.".into());
        }
        Ok(())
    }
    pub fn shortcut(value: &str) -> Result<(), String> {
        let keys = super::shortcut_keys(value)?;
        if [0x10, 0x11, 0x12, 0x5b, 0x5c]
            .iter()
            .any(|key| unsafe { GetAsyncKeyState(*key) < 0 })
        {
            return Err("Release Ctrl, Shift, Alt and Windows keys. No shortcut was sent.".into());
        }
        let mut inputs = Vec::new();
        for &vk in &keys {
            inputs.push(Input {
                kind: 1,
                payload: Payload {
                    key: Key {
                        vk,
                        scan: 0,
                        flags: 0,
                        time: 0,
                        extra: 0,
                    },
                },
            });
        }
        for &vk in keys.iter().rev() {
            inputs.push(Input {
                kind: 1,
                payload: Payload {
                    key: Key {
                        vk,
                        scan: 0,
                        flags: 2,
                        time: 0,
                        extra: 0,
                    },
                },
            });
        }
        let sent = unsafe {
            SendInput(
                inputs.len() as u32,
                inputs.as_ptr(),
                std::mem::size_of::<Input>() as i32,
            )
        };
        if sent != inputs.len() as u32 {
            return Err(
                "Windows blocked some keyboard input. Check the target app before retrying.".into(),
            );
        }
        Ok(())
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn input_layout_matches_windows_abi() {
            assert_eq!(
                std::mem::size_of::<Input>(),
                if cfg!(target_pointer_width = "64") {
                    40
                } else {
                    28
                }
            );
        }
        #[test]
        fn insertion_rejects_own_process_without_sending_keys() {
            assert!(insert((1, std::process::id()), "Do not insert").is_err());
        }
    }
}
#[cfg(windows)]
pub use keyboard::{insert as insert_text, target as foreground_target};
#[cfg(not(windows))]
pub fn foreground_target() -> (usize, u32) {
    (0, 0)
}
#[cfg(not(windows))]
pub fn insert_text(_: (usize, u32), _: &str) -> Result<(), String> {
    Err("Dictation insertion requires Windows".into())
}

pub fn shortcut_keys(value: &str) -> Result<Vec<u16>, String> {
    let mut key = value
        .to_lowercase()
        .replace(" plus ", "+")
        .replace(' ', "")
        .replace("control", "ctrl");
    if key.starts_with("ctrl") && key.len() == 5 {
        key.insert(4, '+');
    }
    let result = match key.as_str() {
        "enter" | "return" => vec![0x0d], "escape" | "esc" => vec![0x1b], "tab" => vec![9], "backspace" => vec![8], "delete" => vec![0x2e],
        "pageup" => vec![0x21], "pagedown" => vec![0x22], "up" => vec![0x26], "down" => vec![0x28], "left" => vec![0x25], "right" => vec![0x27],
        "ctrl+a" => vec![0x11, 0x41], "ctrl+c" => vec![0x11, 0x43], "ctrl+v" => vec![0x11, 0x56], "ctrl+z" => vec![0x11, 0x5a], "ctrl+y" => vec![0x11, 0x59],
        "ctrl+s" => vec![0x11, 0x53], "ctrl+f" => vec![0x11, 0x46], "ctrl+l" => vec![0x11, 0x4c], "ctrl+o" => vec![0x11, 0x4f], "ctrl+w" => vec![0x11, 0x57],
        _ => return Err("Unsupported shortcut. Use common editing shortcuts, Enter, Escape, Tab, arrow keys, PageUp or PageDown.".into()),
    };
    Ok(result)
}
#[cfg(windows)]
pub use keyboard::shortcut as send_shortcut;
#[cfg(not(windows))]
pub fn send_shortcut(_: &str) -> Result<(), String> {
    Err("Keyboard control requires Windows".into())
}

#[cfg(test)]
mod pc_access_tests {
    use super::*;
    #[test]
    fn common_spoken_shortcuts_are_allowlisted() {
        assert_eq!(shortcut_keys("Control S").unwrap(), vec![0x11, 0x53]);
        assert_eq!(shortcut_keys("Control plus S").unwrap(), vec![0x11, 0x53]);
        assert!(shortcut_keys("Win+R").is_err());
        assert!(shortcut_keys("powershell -Command anything").is_err());
    }
    #[cfg(windows)]
    #[test]
    fn local_drive_scope_contains_the_system_drive() {
        let system = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
        assert!(
            local_drive_roots()
                .iter()
                .any(|p| p.to_string_lossy().starts_with(&system))
        );
    }
}
