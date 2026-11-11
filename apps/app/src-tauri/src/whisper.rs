use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct Runtime {
    pub directory: PathBuf,
    pub cache: PathBuf,
}
#[derive(serde::Serialize)]
pub struct Recognition {
    pub text: String,
    pub needs_review: bool,
}
struct Temporary {
    directory: PathBuf,
}
impl Drop for Temporary {
    fn drop(&mut self) {
        for name in ["capture.wav", "result.json", "engine.log"] {
            let _ = std::fs::remove_file(self.directory.join(name));
        }
        let _ = std::fs::remove_dir(&self.directory);
    }
}
pub fn write_wave(path: &Path, samples: &[i16]) -> Result<(), String> {
    let length = (samples.len() * 2) as u32;
    let mut file = std::io::BufWriter::new(std::fs::File::create(path).map_err(|e| e.to_string())?);
    let mut header = Vec::new();
    header.extend(b"RIFF");
    header.extend((36 + length).to_le_bytes());
    header.extend(b"WAVEfmt ");
    header.extend(16_u32.to_le_bytes());
    header.extend(1_u16.to_le_bytes());
    header.extend(1_u16.to_le_bytes());
    header.extend(16000_u32.to_le_bytes());
    header.extend(32000_u32.to_le_bytes());
    header.extend(2_u16.to_le_bytes());
    header.extend(16_u16.to_le_bytes());
    header.extend(b"data");
    header.extend(length.to_le_bytes());
    file.write_all(&header).map_err(|e| e.to_string())?;
    for sample in samples {
        file.write_all(&sample.to_le_bytes())
            .map_err(|e| e.to_string())?;
    }
    file.flush().map_err(|e| e.to_string())
}
pub fn parse_result(value: &serde_json::Value) -> Recognition {
    let segments = value["transcription"].as_array();
    let text = segments
        .map(|segments| {
            segments
                .iter()
                .filter_map(|s| s["text"].as_str())
                .collect::<Vec<_>>()
                .join(" ")
                .trim()
                .to_owned()
        })
        .unwrap_or_default();
    let probabilities: Vec<f64> = segments
        .into_iter()
        .flatten()
        .flat_map(|s| s["tokens"].as_array().into_iter().flatten())
        .filter(|token| !token["text"].as_str().unwrap_or("").trim().starts_with('['))
        .filter_map(|token| token["p"].as_f64())
        .collect();
    let average = if probabilities.is_empty() {
        0.0
    } else {
        probabilities.iter().sum::<f64>() / probabilities.len() as f64
    };
    Recognition {
        text,
        needs_review: average < 0.45,
    }
}
impl Runtime {
    pub fn available(&self) -> bool {
        self.directory.join("whisper-cli.exe").is_file()
            && self.directory.join("ggml-small-q5_1.bin").is_file()
    }
    pub fn transcribe(
        &self,
        samples: &[i16],
        language: &str,
        dictation: bool,
    ) -> Result<Recognition, String> {
        if !self.available() {
            return Err("Offline speech model is missing. Reinstall Voicela or run pnpm speech:setup for development.".into());
        }
        if !["en", "auto", "hi", "gu"].contains(&language) {
            return Err("Unsupported speech language".into());
        }
        if samples.len() < 5600 {
            return Err(
                "Recording was too short. Wait for Listening, then speak for at least a moment."
                    .into(),
            );
        }
        let peak = samples
            .chunks(1600)
            .map(|chunk| {
                (chunk
                    .iter()
                    .map(|v| (*v as f64 / 32768.0).powi(2))
                    .sum::<f64>()
                    / chunk.len() as f64)
                    .sqrt()
            })
            .fold(0.0_f64, f64::max);
        if peak < 0.003 {
            return Err("The selected microphone was silent or too quiet. Choose your microphone and check the input level while speaking.".into());
        }
        std::fs::create_dir_all(&self.cache).map_err(|e| e.to_string())?;
        let files = Temporary {
            directory: self.cache.join(format!("voice-{}", uuid::Uuid::new_v4())),
        };
        std::fs::create_dir(&files.directory).map_err(|e| e.to_string())?;
        write_wave(&files.directory.join("capture.wav"), samples)?;
        let stderr =
            std::fs::File::create(files.directory.join("engine.log")).map_err(|e| e.to_string())?;
        let mut command = Command::new(self.directory.join("whisper-cli.exe"));
        command
            .args(["-m"])
            .arg(self.directory.join("ggml-small-q5_1.bin"))
            .arg("-f")
            .arg(files.directory.join("capture.wav"))
            .args(["-l", language, "-ojf", "-of"])
            .arg(files.directory.join("result"))
            .args(["-np", "-nt", "-t", "6", "-ng", "-sns", "-nf"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::from(stderr));
        if !dictation {
            command.args(["--prompt", "Windows application names: Notepad, Calculator, Paint, Google Chrome, Microsoft Edge, Visual Studio Code."]);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut process = command
            .spawn()
            .map_err(|e| format!("Offline speech engine could not start: {e}"))?;
        let started = Instant::now();
        loop {
            if let Some(status) = process.try_wait().map_err(|e| e.to_string())? {
                if !status.success() {
                    let details = std::fs::read_to_string(files.directory.join("engine.log"))
                        .unwrap_or_default();
                    return Err(format!(
                        "Offline transcription failed: {}",
                        details.chars().take(500).collect::<String>()
                    ));
                }
                break;
            }
            if started.elapsed() > Duration::from_secs(120) {
                let _ = process.kill();
                let _ = process.wait();
                return Err("Offline transcription timed out. Try a shorter recording.".into());
            }
            std::thread::sleep(Duration::from_millis(30));
        }
        let value =
            std::fs::read(files.directory.join("result.json")).map_err(|e| e.to_string())?;
        let value: serde_json::Value = serde_json::from_slice(&value).map_err(|e| e.to_string())?;
        Ok(parse_result(&value))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn uncertain_tokens_require_review_and_segments_are_preserved() {
        let r = parse_result(
            &serde_json::json!({"transcription":[{"text":" Open Notepad.","tokens":[{"text":" Open","p":0.9},{"text":" Notepad","p":0.9}]}]}),
        );
        assert_eq!(r.text, "Open Notepad.");
        assert!(!r.needs_review);
        let r = parse_result(
            &serde_json::json!({"transcription":[{"text":"guess","tokens":[{"text":"guess","p":0.1}]}]}),
        );
        assert!(r.needs_review);
        assert!(parse_result(&serde_json::json!({})).needs_review);
    }
}
