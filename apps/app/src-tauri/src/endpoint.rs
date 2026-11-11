use std::collections::VecDeque;
/// 100 ms PCM frames. Only completed speech turns are sent to the decoder.

pub struct Endpoint {
    threshold: f64,
    silence_samples: usize,
    pre: VecDeque<Vec<i16>>,
    active: Vec<i16>,
    voiced: usize,
    quiet: usize,
}
impl Default for Endpoint {
    fn default() -> Self {
        Self::new(50, 1500)
    }
}
impl Endpoint {
    pub fn new(sensitivity: u32, silence_ms: u32) -> Self {
        Self {
            threshold: 0.009 - sensitivity.min(100) as f64 * 0.00008,
            silence_samples: silence_ms.clamp(900, 3000) as usize * 16,
            pre: VecDeque::new(),
            active: Vec::new(),
            voiced: 0,
            quiet: 0,
        }
    }
    pub fn feed(&mut self, frame: &[i16]) -> Option<Vec<i16>> {
        if frame.is_empty() {
            return None;
        }
        let rms = (frame
            .iter()
            .map(|x| (*x as f64 / 32768.0).powi(2))
            .sum::<f64>()
            / frame.len() as f64)
            .sqrt();
        let speech = rms >= self.threshold;
        if self.active.is_empty() {
            if !speech {
                self.pre.push_back(frame.to_vec());
                if self.pre.len() > 3 {
                    self.pre.pop_front();
                }
                return None;
            }
            for previous in self.pre.drain(..) {
                self.active.extend(previous);
            }
        }
        self.active.extend_from_slice(frame);
        if speech {
            self.voiced += frame.len();
            self.quiet = 0;
        } else {
            self.quiet += frame.len();
        }
        if self.quiet >= self.silence_samples || self.active.len() >= 320_000 {
            self.quiet = 0;
            let voiced = std::mem::take(&mut self.voiced);
            let turn = std::mem::take(&mut self.active);
            if voiced >= 3_200 {
                return Some(turn);
            }
        }
        None
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn short_pause_stays_in_same_sentence_and_sensitivity_changes_detection() {
        let mut vad = Endpoint::default();
        for _ in 0..4 {
            vad.feed(&[1000; 1600]);
        }
        for _ in 0..10 {
            assert!(vad.feed(&[0; 1600]).is_none());
        }
        for _ in 0..4 {
            assert!(vad.feed(&[1000; 1600]).is_none());
        }
        for _ in 0..14 {
            assert!(vad.feed(&[0; 1600]).is_none());
        }
        let turn = vad.feed(&[0; 1600]).unwrap();
        assert_eq!(turn.iter().filter(|v| **v == 1000).count(), 12800);
        let mut low = Endpoint::new(0, 900);
        let mut high = Endpoint::new(100, 900);
        for _ in 0..4 {
            low.feed(&[100; 1600]);
            high.feed(&[100; 1600]);
        }
        let mut detected = false;
        for _ in 0..9 {
            assert!(low.feed(&[0; 1600]).is_none());
            detected |= high.feed(&[0; 1600]).is_some();
        }
        assert!(detected);
    }
    #[test]
    fn silence_is_bounded_and_does_not_create_turns() {
        let mut vad = Endpoint::default();
        for _ in 0..5000 {
            assert!(vad.feed(&[0; 1600]).is_none());
        }
        assert_eq!(vad.pre.len(), 3);
        assert!(vad.active.is_empty());
    }
    #[test]
    fn pauses_finish_turns_without_clipping_leading_audio() {
        let mut vad = Endpoint::default();
        for _ in 0..3 {
            vad.feed(&[0; 1600]);
        }
        for _ in 0..5 {
            assert!(vad.feed(&[1000; 1600]).is_none());
        }
        for _ in 0..14 {
            assert!(vad.feed(&[0; 1600]).is_none());
        }
        let turn = vad.feed(&[0; 1600]).unwrap();
        assert_eq!(&turn[..4800], &[0; 4800]);
        assert_eq!(turn.iter().filter(|v| **v == 1000).count(), 8000);
        for _ in 0..3 {
            vad.feed(&[2000; 1600]);
        }
        for _ in 0..14 {
            vad.feed(&[0; 1600]);
        }
        assert!(vad.feed(&[0; 1600]).is_some());
    }
    #[test]
    fn a_click_does_not_trigger_recognition_and_long_speech_is_split() {
        let mut vad = Endpoint::default();
        vad.feed(&[1000; 1600]);
        for _ in 0..15 {
            assert!(vad.feed(&[0; 1600]).is_none());
        }
        let mut turn = None;
        for _ in 0..200 {
            turn = turn.or(vad.feed(&[1000; 1600]));
        }
        assert!(turn.is_some());
    }
}
