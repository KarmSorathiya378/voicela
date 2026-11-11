use std::sync::{
    Arc,
    atomic::{AtomicU32, Ordering},
    mpsc,
};
use std::time::{Duration, Instant};
use windows::Win32::Media::Audio::*;
use windows::core::PSTR;

#[derive(serde::Serialize)]
pub struct Microphone {
    pub id: u32,
    pub name: String,
}
pub fn microphones() -> Vec<Microphone> {
    let mut result = vec![Microphone {
        id: WAVE_MAPPER,
        name: "Windows default microphone".into(),
    }];
    unsafe {
        for id in 0..waveInGetNumDevs() {
            let mut caps = WAVEINCAPSW::default();
            if waveInGetDevCapsW(
                id as usize,
                &mut caps,
                std::mem::size_of::<WAVEINCAPSW>() as u32,
            ) == 0
            {
                let name = caps.szPname;
                let end = name.iter().position(|v| *v == 0).unwrap_or(name.len());
                result.push(Microphone {
                    id,
                    name: String::from_utf16_lossy(&name[..end]),
                });
            }
        }
    }
    result
}
fn check(code: u32) -> Result<(), String> {
    if code == 0 {
        return Ok(());
    }
    let mut text = [0_u16; 256];
    unsafe {
        waveInGetErrorTextW(code, &mut text);
    }
    let end = text.iter().position(|c| *c == 0).unwrap_or(text.len());
    Err(format!(
        "Microphone: {} (code {code}). Check the selected input and Windows microphone permissions.",
        String::from_utf16_lossy(&text[..end])
    ))
}
struct Buffer {
    header: Box<WAVEHDR>,
    data: Vec<i16>,
    prepared: bool,
}
struct Device {
    handle: HWAVEIN,
    buffers: Vec<Buffer>,
}
impl Drop for Device {
    fn drop(&mut self) {
        unsafe {
            waveInReset(self.handle);
            for buffer in &mut self.buffers {
                if buffer.prepared {
                    waveInUnprepareHeader(
                        self.handle,
                        buffer.header.as_mut(),
                        std::mem::size_of::<WAVEHDR>() as u32,
                    );
                }
            }
            waveInClose(self.handle);
        }
    }
}
fn consume(buffer: &Buffer, samples: &mut Vec<i16>, level: &AtomicU32) {
    // WinMM owns a queued buffer until WHDR_DONE; data is read only after completion/reset.
    let length = (buffer.header.dwBytesRecorded as usize / 2).min(buffer.data.len());
    if length == 0 {
        return;
    }
    let data = &buffer.data[..length];
    let rms = (data
        .iter()
        .map(|v| (*v as f64 / 32768.0).powi(2))
        .sum::<f64>()
        / length as f64)
        .sqrt() as f32;
    level.store((rms * 5.0).min(1.0).to_bits(), Ordering::Relaxed);
    samples.extend_from_slice(data);
}
pub fn record(
    device_id: u32,
    stop: mpsc::Receiver<bool>,
    ready: &mpsc::Sender<Result<(), String>>,
    level: Arc<AtomicU32>,
    segments: Option<mpsc::SyncSender<Vec<i16>>>,
    tuning: (u32, u32),
) -> Result<Option<Vec<i16>>, String> {
    unsafe {
        let format = WAVEFORMATEX {
            wFormatTag: 1,
            nChannels: 1,
            nSamplesPerSec: 16000,
            nAvgBytesPerSec: 32000,
            nBlockAlign: 2,
            wBitsPerSample: 16,
            cbSize: 0,
        };
        let mut handle = HWAVEIN::default();
        check(waveInOpen(
            Some(&mut handle),
            device_id,
            &format,
            None,
            None,
            CALLBACK_NULL,
        ))?;
        let mut device = Device {
            handle,
            buffers: Vec::with_capacity(4),
        };
        for _ in 0..4 {
            let mut data = vec![0_i16; 1600];
            let header = Box::new(WAVEHDR {
                lpData: PSTR(data.as_mut_ptr().cast()),
                dwBufferLength: 3200,
                ..Default::default()
            });
            device.buffers.push(Buffer {
                header,
                data,
                prepared: false,
            });
            let buffer = device.buffers.last_mut().unwrap();
            check(waveInPrepareHeader(
                handle,
                buffer.header.as_mut(),
                std::mem::size_of::<WAVEHDR>() as u32,
            ))?;
            buffer.prepared = true;
            check(waveInAddBuffer(
                handle,
                buffer.header.as_mut(),
                std::mem::size_of::<WAVEHDR>() as u32,
            ))?;
        }
        check(waveInStart(handle))?;
        if ready.send(Ok(())).is_err() {
            return Ok(None);
        }
        let started = Instant::now();
        let mut samples = Vec::new();
        // Keep queue order across ring-buffer wraparound, including the final partial buffer.
        let mut next_buffer = 0;
        let mut endpoint = crate::endpoint::Endpoint::new(tuning.0, tuning.1);
        let mut last_frame = Instant::now();
        loop {
            if last_frame.elapsed() > Duration::from_secs(4) {
                return Err("Microphone stopped delivering audio (device disconnected or PC resumed). Select your input and start listening again.".into());
            }
            let finish = match stop.try_recv() {
                Ok(cancel) => Some(cancel),
                Err(mpsc::TryRecvError::Disconnected) => Some(true),
                Err(_) if segments.is_none() && started.elapsed() >= Duration::from_secs(60) => {
                    Some(false)
                }
                Err(_) => None,
            };
            if let Some(cancel) = finish {
                check(waveInStop(handle))?;
                check(waveInReset(handle))?;
                if cancel {
                    return Ok(None);
                }
                for offset in 0..device.buffers.len() {
                    consume(
                        &device.buffers[(next_buffer + offset) % device.buffers.len()],
                        &mut samples,
                        &level,
                    );
                }
                level.store(0_f32.to_bits(), Ordering::Relaxed);
                return Ok(Some(samples));
            }
            loop {
                let buffer = &mut device.buffers[next_buffer];
                // WAVEHDR is packed; read its completion flags without an alignment assumption.
                let flags = u32::from_ne_bytes(
                    std::ptr::addr_of!(buffer.header.dwFlags)
                        .cast::<[u8; 4]>()
                        .read_volatile(),
                );
                if flags & WHDR_DONE != 0 {
                    last_frame = Instant::now();
                    consume(buffer, &mut samples, &level);
                    buffer.header.dwBytesRecorded = 0;
                    check(waveInAddBuffer(
                        handle,
                        buffer.header.as_mut(),
                        std::mem::size_of::<WAVEHDR>() as u32,
                    ))?;
                    next_buffer = (next_buffer + 1) % device.buffers.len();
                } else {
                    break;
                }
            }
            if let Some(sender) = &segments {
                for frame in samples.chunks(1600) {
                    if let Some(turn) = endpoint.feed(frame) {
                        sender.try_send(turn).map_err(|_| "Speech processing could not keep up. Listening paused; wait for processing to finish before starting again.".to_owned())?;
                    }
                }
                samples.clear();
            }
            std::thread::sleep(Duration::from_millis(15));
        }
    }
}
