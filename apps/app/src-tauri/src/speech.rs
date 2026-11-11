use crate::whisper::{Recognition, Runtime};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicU32, Ordering},
    mpsc,
};
use std::time::Duration;
use tauri::{Emitter, Manager};

#[derive(Clone, serde::Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "camelCase")]
pub struct Options {
    pub device_id: u32,
    pub language: String,
    pub sensitivity: u32,
    pub silence_ms: u32,
}
impl Default for Options {
    fn default() -> Self {
        Self {
            device_id: u32::MAX,
            language: "en".into(),
            sensitivity: 50,
            silence_ms: 1500,
        }
    }
}
struct Recording {
    target: Option<(usize, u32)>,
    stop: mpsc::Sender<bool>,
    result: mpsc::Receiver<Result<Recognition, String>>,
}
impl Drop for Recording {
    fn drop(&mut self) {
        let _ = self.stop.send(true);
    }
}
#[derive(Default)]
pub struct SpeechCapture {
    recording: Mutex<Option<Recording>>,
    continuous: Mutex<Option<Continuous>>,
    level: Arc<AtomicU32>,
}
pub fn runtime(app: &tauri::AppHandle) -> Result<Runtime, String> {
    let directory = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("whisper");
    #[cfg(debug_assertions)]
    let directory = if !directory.join("whisper-cli.exe").exists() {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/whisper")
    } else {
        directory
    };
    Ok(Runtime {
        directory,
        cache: app
            .path()
            .app_cache_dir()
            .map_err(|e| e.to_string())?
            .join("speech-temp"),
    })
}
#[tauri::command(async)]
pub fn start_speech(
    dictation: Option<bool>,
    options: Option<Options>,
    app: tauri::AppHandle,
    capture: tauri::State<'_, SpeechCapture>,
) -> Result<(), String> {
    capture.start(
        dictation.unwrap_or(false),
        options.unwrap_or_default(),
        runtime(&app)?,
    )
}
#[tauri::command(async)]
pub fn stop_speech(
    cancel: Option<bool>,
    capture: tauri::State<'_, SpeechCapture>,
) -> Result<Transcript, String> {
    capture.stop(cancel.unwrap_or(false))
}
#[tauri::command]
pub fn speech_level(capture: tauri::State<'_, SpeechCapture>) -> f32 {
    f32::from_bits(capture.level.load(Ordering::Relaxed))
}
#[tauri::command]
pub fn speech_devices(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    #[cfg(windows)]
    {
        Ok(
            serde_json::json!({ "devices": crate::audio_capture::microphones(), "modelReady": runtime(&app)?.available(), "engine": "Whisper small (offline)" }),
        )
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Native recording requires Windows".into())
    }
}
#[derive(serde::Serialize)]
pub struct Transcript {
    text: String,
    inserted: bool,
    insertion_error: Option<String>,
    needs_review: bool,
}
impl SpeechCapture {
    pub fn start(&self, dictation: bool, options: Options, runtime: Runtime) -> Result<(), String> {
        if self
            .continuous
            .lock()
            .map_err(|_| "Speech lock unavailable")?
            .is_some()
        {
            return Err("Pause continuous listening first".into());
        }
        if !cfg!(windows) {
            return Err("Native recording currently requires Windows.".into());
        }
        if !["en", "auto", "hi", "gu"].contains(&options.language.as_str()) {
            return Err("Unsupported speech language".into());
        }
        if !runtime.available() {
            return Err(
                "Offline speech model is missing. Reinstall Voicela or run pnpm speech:setup."
                    .into(),
            );
        }
        let target = if dictation {
            let target = crate::platform::foreground_target();
            if target.0 == 0 || target.1 == std::process::id() {
                return Err(
                    "Focus a text field in another app, then hold Ctrl+Space to dictate there."
                        .into(),
                );
            }
            Some(target)
        } else {
            None
        };
        let mut slot = self
            .recording
            .lock()
            .map_err(|_| "Speech lock unavailable")?;
        if slot.is_some() {
            return Err("Microphone is already recording".into());
        }
        self.level.store(0_f32.to_bits(), Ordering::Relaxed);
        let level = self.level.clone();
        let (stop, receiver) = mpsc::channel();
        let (sender, ready) = mpsc::channel();
        let (result_sender, result) = mpsc::channel();
        std::thread::spawn(move || {
            let result = record_and_transcribe(
                options,
                dictation,
                runtime,
                receiver,
                &sender,
                level.clone(),
            );
            level.store(0_f32.to_bits(), Ordering::Relaxed);
            if let Err(error) = &result {
                let _ = sender.send(Err(error.clone()));
            }
            let _ = result_sender.send(result);
        });
        let recording = Recording {
            stop,
            result,
            target,
        };
        ready.recv_timeout(Duration::from_secs(15)).map_err(|_| {
            "Microphone did not become ready. Check your input device.".to_owned()
        })??;
        *slot = Some(recording);
        Ok(())
    }
    pub fn stop(&self, cancel: bool) -> Result<Transcript, String> {
        let recording = self
            .recording
            .lock()
            .map_err(|_| "Speech lock unavailable")?
            .take()
            .ok_or("No recording is active")?;
        let _ = recording.stop.send(cancel);
        let recognition = recording
            .result
            .recv_timeout(Duration::from_secs(130))
            .map_err(|_| "Offline speech did not finish. Try a shorter recording.")??;
        let insertion = recording
            .target
            .filter(|_| !cancel && !recognition.needs_review && !recognition.text.is_empty())
            .map(|target| crate::platform::insert_text(target, &recognition.text));
        Ok(Transcript {
            text: recognition.text,
            inserted: matches!(insertion, Some(Ok(()))),
            insertion_error: insertion.and_then(Result::err),
            needs_review: recognition.needs_review,
        })
    }
}
#[cfg(windows)]
fn record_and_transcribe(
    options: Options,
    dictation: bool,
    runtime: Runtime,
    stop: mpsc::Receiver<bool>,
    ready: &mpsc::Sender<Result<(), String>>,
    level: Arc<AtomicU32>,
) -> Result<Recognition, String> {
    match crate::audio_capture::record(
        options.device_id,
        stop,
        ready,
        level,
        None,
        (options.sensitivity, options.silence_ms),
    )? {
        Some(samples) => runtime.transcribe(&samples, &options.language, dictation),
        None => Ok(Recognition {
            text: String::new(),
            needs_review: false,
        }),
    }
}
#[cfg(not(windows))]
fn record_and_transcribe(
    _: Options,
    _: bool,
    _: Runtime,
    _: mpsc::Receiver<bool>,
    _: &mpsc::Sender<Result<(), String>>,
    _: Arc<AtomicU32>,
) -> Result<Recognition, String> {
    Err("Recording requires Windows".into())
}

struct Continuous {
    stop: mpsc::Sender<bool>,
    cancelled: Arc<std::sync::atomic::AtomicBool>,
    done: mpsc::Receiver<()>,
}
impl Drop for Continuous {
    fn drop(&mut self) {
        self.cancelled.store(true, Ordering::SeqCst);
        let _ = self.stop.send(true);
        let _ = self.done.recv_timeout(Duration::from_secs(3));
    }
}
#[tauri::command(async)]
pub fn stop_listening(capture: tauri::State<'_, SpeechCapture>) -> Result<(), String> {
    capture
        .continuous
        .lock()
        .map_err(|_| "Speech lock unavailable")?
        .take();
    Ok(())
}
#[tauri::command(async)]
pub fn start_listening(
    session_id: String,
    dictation: bool,
    options: Options,
    app: tauri::AppHandle,
    capture: tauri::State<'_, SpeechCapture>,
) -> Result<(), String> {
    if session_id.len() > 100 || session_id.is_empty() {
        return Err("Invalid listening session".into());
    }
    if !["en", "auto", "hi", "gu"].contains(&options.language.as_str()) {
        return Err("Unsupported language".into());
    }
    let runtime = runtime(&app)?;
    if !runtime.available() {
        return Err("Offline speech model is missing. Reinstall Voicela.".into());
    }
    let mut slot = capture
        .continuous
        .lock()
        .map_err(|_| "Speech lock unavailable")?;
    if slot.is_some()
        || capture
            .recording
            .lock()
            .map_err(|_| "Speech lock unavailable")?
            .is_some()
    {
        return Err("A microphone session is already active".into());
    }
    let (stop, receiver) = mpsc::channel();
    let (sender, ready) = mpsc::channel();
    let (segments, turns) = mpsc::sync_channel(4);
    let cancelled = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let (done_sender, done) = mpsc::channel();
    let session = Continuous {
        stop,
        cancelled: cancelled.clone(),
        done,
    };
    let level = capture.level.clone();
    let recorder_app = app.clone();
    let id = session_id.clone();
    let capture_cancel = cancelled.clone();
    #[cfg(windows)]
    std::thread::spawn(move || {
        let result = crate::audio_capture::record(
            options.device_id,
            receiver,
            &sender,
            level.clone(),
            Some(segments),
            (options.sensitivity, options.silence_ms),
        );
        level.store(0_f32.to_bits(), Ordering::Relaxed);
        if let Err(error) = result {
            let _ = sender.send(Err(error.clone()));
            let _ = recorder_app.emit(
                "listening-ended",
                serde_json::json!({"sessionId": id,"error": error}),
            );
        }
        capture_cancel.store(true, Ordering::SeqCst);
        let _ = done_sender.send(());
    });
    #[cfg(not(windows))]
    {
        let _ = (
            receiver,
            sender,
            segments,
            level,
            recorder_app,
            id,
            capture_cancel,
        );
        return Err("Continuous listening requires Windows".into());
    }
    let decoder_cancel = cancelled;
    std::thread::spawn(move || {
        let mut sequence = 0_u64;
        while let Ok(samples) = turns.recv() {
            sequence += 1;
            let decode_started = std::time::Instant::now();
            if decoder_cancel.load(Ordering::SeqCst) {
                break;
            }
            let target = if dictation {
                Some(crate::platform::foreground_target())
            } else {
                None
            };
            let result = runtime.transcribe(&samples, &options.language, dictation);
            if decoder_cancel.load(Ordering::SeqCst) {
                break;
            }
            match result {
                Ok(recognition) => {
                    let insertion = target
                        .filter(|_| !recognition.needs_review && !recognition.text.is_empty())
                        .map(|target| crate::platform::insert_text(target, &recognition.text));
                    let _ = app.emit("listening-transcript", serde_json::json!({"sessionId":session_id,"sequence":sequence,"latencyMs":decode_started.elapsed().as_millis() as u64,"text":recognition.text,"needs_review":recognition.needs_review,"inserted":matches!(insertion,Some(Ok(()))),"insertion_error":insertion.and_then(Result::err)}));
                }
                Err(error) => {
                    let _ = app.emit("listening-transcript", serde_json::json!({"sessionId":session_id,"sequence":sequence,"latencyMs":decode_started.elapsed().as_millis() as u64,"text":"","needs_review":true,"error":error}));
                }
            }
        }
    });
    ready
        .recv_timeout(Duration::from_secs(15))
        .map_err(|_| "Microphone did not start".to_owned())??;
    *slot = Some(session);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn test_runtime() -> Runtime {
        Runtime {
            directory: std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources/whisper"),
            cache: std::env::temp_dir().join("voicela-speech-tests"),
        }
    }
    #[cfg(windows)]
    #[test]
    #[ignore = "Uses the real microphone in continuous segmentation mode"]
    fn windows_continuous_microphone_releases_on_pause() {
        let (stop, receive) = mpsc::channel();
        let (sender, ready) = mpsc::channel();
        let (segments, _turns) = mpsc::sync_channel(4);
        let level = Arc::new(AtomicU32::new(0));
        let worker = std::thread::spawn(move || {
            crate::audio_capture::record(
                u32::MAX,
                receive,
                &sender,
                level,
                Some(segments),
                (50, 1500),
            )
        });
        ready.recv_timeout(Duration::from_secs(5)).unwrap().unwrap();
        std::thread::sleep(Duration::from_millis(450));
        stop.send(true).unwrap();
        assert!(worker.join().unwrap().unwrap().is_none());
        let capture = SpeechCapture::default();
        capture
            .start(false, Options::default(), test_runtime())
            .unwrap();
        assert!(capture.stop(true).unwrap().text.is_empty());
    }
    #[test]
    fn stopping_without_capture_returns_error() {
        assert!(SpeechCapture::default().stop(false).is_err());
    }
    #[cfg(windows)]
    #[test]
    #[ignore = "Uses the real microphone and downloaded model; run explicitly"]
    fn windows_microphone_ready_and_stop() {
        let capture = SpeechCapture::default();
        capture
            .start(false, Options::default(), test_runtime())
            .unwrap();
        assert!(
            capture
                .start(false, Options::default(), test_runtime())
                .is_err()
        );
        std::thread::sleep(Duration::from_millis(400));
        assert!(capture.stop(true).unwrap().text.is_empty());
        assert!(capture.stop(true).is_err());
    }
    #[cfg(windows)]
    #[test]
    #[ignore = "Uses the downloaded Whisper model and Windows voice synthesis; run explicitly"]
    fn windows_whisper_recognizes_audio_sample() {
        use windows::Win32::Media::{Audio::WAVEFORMATEX, Speech::*};
        use windows::Win32::System::Com::{CLSCTX_ALL, CoCreateInstance};
        use windows::core::{HSTRING, PCWSTR, w};
        let _apartment = crate::windows_native::Apartment::new().unwrap();
        let file =
            std::env::temp_dir().join(format!("voicela-whisper-{}.wav", uuid::Uuid::new_v4()));
        unsafe {
            let stream: ISpStream = CoCreateInstance(&SpStream, None, CLSCTX_ALL).unwrap();
            let path = HSTRING::from(file.as_os_str());
            let format = WAVEFORMATEX {
                wFormatTag: 1,
                nChannels: 1,
                nSamplesPerSec: 16000,
                nAvgBytesPerSec: 32000,
                nBlockAlign: 2,
                wBitsPerSample: 16,
                cbSize: 0,
            };
            stream
                .BindToFile(
                    PCWSTR(path.as_ptr()),
                    SPFM_CREATE_ALWAYS,
                    Some(&windows::core::GUID::from_u128(
                        0xc31adbae_527f_4ff5_a230_f62bb61ff70c,
                    )),
                    Some(&format),
                    0,
                )
                .unwrap();
            let voice: ISpVoice = CoCreateInstance(&SpVoice, None, CLSCTX_ALL).unwrap();
            voice.SetOutput(&stream, true).unwrap();
            voice.Speak(w!("Open Notepad"), 0, None).unwrap();
            drop(voice);
            stream.Close().unwrap();
        }
        let wave = std::fs::read(&file).unwrap();
        let _ = std::fs::remove_file(&file);
        // Find the actual RIFF data chunk; SAPI may add metadata chunks before audio.
        let mut offset = 12;
        let mut samples = Vec::new();
        while offset + 8 <= wave.len() {
            let size =
                u32::from_le_bytes(wave[offset + 4..offset + 8].try_into().unwrap()) as usize;
            if &wave[offset..offset + 4] == b"data" {
                samples = wave[offset + 8..offset + 8 + size]
                    .chunks_exact(2)
                    .map(|b| i16::from_le_bytes([b[0], b[1]]))
                    .collect();
                break;
            }
            offset += 8 + size + size % 2;
        }
        let result = test_runtime().transcribe(&samples, "en", false).unwrap();
        println!(
            "Whisper heard: {} (review: {})",
            result.text, result.needs_review
        );
        assert!(
            result
                .text
                .to_lowercase()
                .replace(' ', "")
                .contains("opennotepad")
        );
        assert!(!result.needs_review);
        assert!(
            test_runtime()
                .transcribe(&vec![0; 16000], "en", false)
                .is_err(),
            "Silence must not hallucinate a command"
        );
    }
}
