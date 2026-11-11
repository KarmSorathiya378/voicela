use crate::{
    activity_log::{ActivityLog, ActivityStatus},
    state::AppState,
    tools::{ExecutionStatus, ToolInput, ToolOutput, ToolRegistry},
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PendingApproval {
    pub id: String,
    pub request: ToolInput,
    pub intent: String,
}
#[derive(Debug, Serialize)]
pub struct StateSnapshot {
    pub state: AppState,
    pub pending_approval: Option<PendingApproval>,
}
#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum RunResponse {
    AwaitingApproval { approval: PendingApproval },
    Simulated { output: ToolOutput },
    Executed { output: ToolOutput },
    Denied { message: String },
}

pub struct Engine {
    state: AppState,
    pending: Option<PendingApproval>,
    pub registry: ToolRegistry,
    pub log: ActivityLog,
}
pub fn validate_intent(intent: &str) -> Result<(), String> {
    if intent.trim().is_empty() || intent.len() > 2_048 {
        return Err("Intent must contain 1-2048 bytes of nonblank text".into());
    }
    Ok(())
}
impl Engine {
    pub fn new(log: ActivityLog) -> Self {
        Self {
            state: AppState::Idle,
            pending: None,
            registry: ToolRegistry::default(),
            log,
        }
    }
    pub fn snapshot(&self) -> StateSnapshot {
        StateSnapshot {
            state: self.state,
            pending_approval: self.pending.clone(),
        }
    }
    pub fn set_capture_state(&mut self, next: AppState) -> Result<(), String> {
        if self.pending.is_some() {
            return Err("Resolve the pending approval first".into());
        }
        if !matches!(
            next,
            AppState::Idle
                | AppState::Listening
                | AppState::Transcribing
                | AppState::Thinking
                | AppState::Error
        ) {
            return Err("Execution states are controlled by the Rust tool engine".into());
        }
        self.state.transition(next)
    }
    pub fn run(&mut self, mut request: ToolInput, intent: String) -> Result<RunResponse, String> {
        if self.pending.is_some() {
            return Err("An approval is already pending".into());
        }
        request.validate()?;
        validate_intent(&intent)?;
        if let ToolInput::ControlApp(control) = &mut request {
            if !["inspect", "click", "type", "key", "scroll"].contains(&control.action.as_str()) {
                return Err("Unsupported app action".into());
            }
            if control.action == "key" {
                crate::platform::shortcut_keys(&control.target)?;
            }
            if control.window != "foreground" {
                return Err("New app requests must target the currently focused window".into());
            }
            control.window = crate::app_control::bind()?;
        }
        // Store the note body only when the approved save succeeds.
        let intent = if matches!(&request, ToolInput::ControlApp(_)) {
            "Control the selected app window".into()
        } else if matches!(&request, ToolInput::CreateNote(_)) {
            "Save a note to local activity history".into()
        } else {
            intent
        };
        let mut permission = self.registry.get(request.name())?.descriptor().permission;
        if matches!(&request, ToolInput::ControlApp(control) if control.action == "inspect") {
            permission.requires_approval = false;
        }
        if !permission.enabled {
            return Err("Tool permission is disabled".into());
        }
        self.state.transition(AppState::Thinking)?;
        if permission.requires_approval {
            let approval = PendingApproval {
                id: uuid::Uuid::new_v4().to_string(),
                request,
                intent,
            };
            if let Err(error) = self.log.append(
                approval.request.name(),
                &approval.intent,
                ActivityStatus::AwaitingApproval,
            ) {
                self.state = AppState::Error;
                return Err(error);
            }
            self.state.transition(AppState::AwaitingApproval)?;
            self.pending = Some(approval.clone());
            Ok(RunResponse::AwaitingApproval { approval })
        } else {
            self.execute(&request, &intent)
        }
    }
    pub fn approve(&mut self, id: &str, approved: bool) -> Result<RunResponse, String> {
        let pending = self.pending.as_ref().ok_or("No approval pending")?;
        if pending.id != id {
            return Err("Unknown or expired approval ID".into());
        }
        if !approved {
            self.log.append(
                pending.request.name(),
                &pending.intent,
                ActivityStatus::Denied,
            )?;
            self.pending = None;
            self.state.transition(AppState::Idle)?;
            return Ok(RunResponse::Denied {
                message: "Request declined. No action was executed.".into(),
            });
        }
        let permission = self
            .registry
            .get(pending.request.name())?
            .descriptor()
            .permission;
        if !permission.enabled {
            return Err("Tool permission is disabled".into());
        }
        // Record approval before consuming the request; a failed audit write never executes it.
        self.log.append(
            pending.request.name(),
            &pending.intent,
            ActivityStatus::Approved,
        )?;
        let pending = self.pending.take().ok_or("No approval pending")?;
        self.execute(&pending.request, &pending.intent)
    }
    fn execute(&mut self, request: &ToolInput, intent: &str) -> Result<RunResponse, String> {
        self.state.transition(AppState::Acting)?;
        let result = (|| {
            let output = self
                .registry
                .get(request.name())?
                .execute(request, &self.log)?;
            match output.status {
                ExecutionStatus::Executed => Ok(RunResponse::Executed { output }),
                ExecutionStatus::Simulated => {
                    self.log
                        .append(request.name(), intent, ActivityStatus::Simulated)?;
                    Ok(RunResponse::Simulated { output })
                }
            }
        })();
        self.state.transition(if result.is_ok() {
            AppState::Completed
        } else {
            AppState::Error
        })?;
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::{CalendarEventInput, CreateNoteInput, FindFileInput};
    fn request() -> ToolInput {
        ToolInput::CalendarEvent(CalendarEventInput {
            title: "Review".into(),
            start: "2026-11-11T10:00:00Z".into(),
            end: "2026-11-11T11:00:00Z".into(),
        })
    }
    #[test]
    fn approval_is_bound_single_use_and_cannot_be_bypassed() {
        let mut engine = Engine::new(ActivityLog::memory());
        let RunResponse::AwaitingApproval { approval } =
            engine.run(request(), "Open Notepad".into()).unwrap()
        else {
            panic!()
        };
        assert!(engine.set_capture_state(AppState::Acting).is_err());
        assert!(engine.run(request(), "Another request".into()).is_err());
        assert!(engine.approve("wrong-id", true).is_err());
        let RunResponse::Simulated { output } = engine.approve(&approval.id, true).unwrap() else {
            panic!()
        };
        assert!(!output.executed);
        assert!(engine.approve(&approval.id, true).is_err());
        assert_eq!(engine.log.recent(20).unwrap().len(), 3);
    }
    #[test]
    fn denial_and_history_deletion() {
        let mut engine = Engine::new(ActivityLog::memory());
        let RunResponse::AwaitingApproval { approval } =
            engine.run(request(), "Open Notepad".into()).unwrap()
        else {
            panic!()
        };
        assert!(matches!(
            engine.approve(&approval.id, false).unwrap(),
            RunResponse::Denied { .. }
        ));
        assert_eq!(engine.state, AppState::Idle);
        assert!(matches!(
            engine.log.recent(20).unwrap()[0].status,
            ActivityStatus::Denied
        ));
        engine.log.clear().unwrap();
        assert!(engine.log.recent(20).unwrap().is_empty());
    }
    #[test]
    fn note_is_written_once_after_approval_and_survives_restart() {
        let path =
            std::env::temp_dir().join(format!("voicela-note-{}.sqlite3", uuid::Uuid::new_v4()));
        let mut engine = Engine::new(ActivityLog::open(&path).unwrap());
        let note = CreateNoteInput {
            title: "Shopping".into(),
            body: "Buy milk".into(),
        };
        let RunResponse::AwaitingApproval { approval } = engine
            .run(
                ToolInput::CreateNote(note.clone()),
                "Shopping: Buy milk".into(),
            )
            .unwrap()
        else {
            panic!("Saving a note must require approval");
        };
        assert!(
            !engine.log.recent(20).unwrap()[0]
                .intent
                .contains("Buy milk")
        );
        engine.approve(&approval.id, false).unwrap();
        assert!(engine.log.recent(20).unwrap().iter().all(|entry| {
            !entry.intent.contains("Buy milk") && !matches!(entry.status, ActivityStatus::Executed)
        }));
        let RunResponse::AwaitingApproval { approval } = engine
            .run(ToolInput::CreateNote(note), "Shopping: Buy milk".into())
            .unwrap()
        else {
            panic!("Saving a note must require approval");
        };
        assert!(matches!(engine.approve(&approval.id, true).unwrap(),
            RunResponse::Executed { output } if output.executed));
        assert!(engine.approve(&approval.id, true).is_err());
        drop(engine);

        let log = ActivityLog::open(&path).unwrap();
        let entries = log.recent(20).unwrap();
        let saved: Vec<_> = entries
            .iter()
            .filter(|entry| matches!(entry.status, ActivityStatus::Executed))
            .collect();
        assert_eq!(saved.len(), 1);
        let note: CreateNoteInput = serde_json::from_str(&saved[0].intent).unwrap();
        assert_eq!(note.title, "Shopping");
        assert_eq!(note.body, "Buy milk");
        log.clear().unwrap();
        assert!(log.recent(20).unwrap().is_empty());
        drop(log);
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn typed_allowlist_rejects_unknown_or_malformed_inputs() {
        assert!(
            serde_json::from_str::<ToolInput>(r#"{"tool":"shell","input":{"command":"whoami"}}"#)
                .is_err()
        );
        assert!(
            serde_json::from_str::<ToolInput>(
                r#"{"tool":"open_app","input":{"app":"x","approved":true}}"#
            )
            .is_err()
        );
        let mut engine = Engine::new(ActivityLog::memory());
        assert!(
            engine
                .run(
                    ToolInput::FindFile(FindFileInput { query: " ".into() }),
                    "Find".into()
                )
                .is_err()
        );
        let result = engine
            .run(
                ToolInput::FindFile(FindFileInput {
                    query: "invoice".into(),
                }),
                "Find invoice".into(),
            )
            .unwrap();
        assert!(matches!(result, RunResponse::Executed { .. }));
        assert_eq!(engine.registry.descriptors().len(), 7);
    }
    #[test]
    fn control_requests_cannot_supply_their_own_window_binding_or_arbitrary_keys() {
        use crate::tools::ControlAppInput;
        let mut engine = Engine::new(ActivityLog::memory());
        for (action, target, window) in [
            ("click", "Send", "123:456:other app"),
            ("key", "Win+R", "foreground"),
            ("shell", "anything", "foreground"),
        ] {
            assert!(
                engine
                    .run(
                        ToolInput::ControlApp(ControlAppInput {
                            action: action.into(),
                            target: target.into(),
                            window: window.into()
                        }),
                        "control app".into()
                    )
                    .is_err()
            );
        }
        assert!(engine.log.recent(20).unwrap().is_empty());
    }
}
