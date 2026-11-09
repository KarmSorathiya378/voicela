use serde::{Deserialize, Serialize};

/// D02 wire values are shared with the frontend; completion is not proof of OS execution.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AppState {
    #[default]
    Idle,
    Listening,
    Transcribing,
    Thinking,
    Acting,
    AwaitingApproval,
    Completed,
    Error,
}

impl AppState {
    pub fn transition(&mut self, next: Self) -> Result<(), String> {
        use AppState::*;
        let valid = *self == next
            || matches!(
                (*self, next),
                (Idle | Completed | Error, Listening | Thinking | Idle)
                    | (Listening, Transcribing | Idle)
                    | (Transcribing, Thinking | Idle)
                    | (Thinking, Acting | AwaitingApproval | Idle)
                    | (AwaitingApproval, Acting | Idle)
                    | (Acting, Completed)
                    | (_, Error)
            );
        if !valid {
            return Err(format!("Invalid transition: {self:?} -> {next:?}"));
        }
        *self = next;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn d02_capture_and_approval_paths() {
        let mut state = AppState::Idle;
        assert!(state.transition(AppState::Completed).is_err());
        for next in [
            AppState::Listening,
            AppState::Transcribing,
            AppState::Thinking,
            AppState::AwaitingApproval,
            AppState::Acting,
            AppState::Completed,
            AppState::Idle,
        ] {
            state.transition(next).unwrap();
        }
        assert_eq!(
            serde_json::to_string(&AppState::AwaitingApproval).unwrap(),
            "\"awaiting-approval\""
        );
    }
}
