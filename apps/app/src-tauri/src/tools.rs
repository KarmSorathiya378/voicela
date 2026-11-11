use crate::activity_log::{ActivityLog, ActivityStatus};
use crate::permission::{Permission, policy};
use schemars::{JsonSchema, schema_for};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ToolName {
    OpenApp,
    FindFile,
    CreateNote,
    CalendarEvent,
    DraftMessage,
    BrowserSearch,
    ControlApp,
}

macro_rules! input {
    ($name:ident { $($field:ident),+ }) => {
        #[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
        #[serde(deny_unknown_fields)]
        pub struct $name { $(pub $field: String),+ }
    };
}
input!(OpenAppInput { app });
input!(FindFileInput { query });
input!(CreateNoteInput { title, body });
input!(CalendarEventInput { title, start, end });
input!(DraftMessageInput { recipient, body });
input!(BrowserSearchInput { query });
input!(ControlAppInput {
    action,
    target,
    window
});

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(
    tag = "tool",
    content = "input",
    rename_all = "snake_case",
    deny_unknown_fields
)]
pub enum ToolInput {
    OpenApp(OpenAppInput),
    FindFile(FindFileInput),
    CreateNote(CreateNoteInput),
    CalendarEvent(CalendarEventInput),
    DraftMessage(DraftMessageInput),
    BrowserSearch(BrowserSearchInput),
    ControlApp(ControlAppInput),
}

impl ToolInput {
    pub fn name(&self) -> ToolName {
        match self {
            Self::OpenApp(_) => ToolName::OpenApp,
            Self::FindFile(_) => ToolName::FindFile,
            Self::CreateNote(_) => ToolName::CreateNote,
            Self::CalendarEvent(_) => ToolName::CalendarEvent,
            Self::DraftMessage(_) => ToolName::DraftMessage,
            Self::BrowserSearch(_) => ToolName::BrowserSearch,
            Self::ControlApp(_) => ToolName::ControlApp,
        }
    }
    pub fn validate(&self) -> Result<(), String> {
        // Structural types reject unknown fields; bounded strings keep the stub API small.
        let value = serde_json::to_value(self).map_err(|e| e.to_string())?;
        for value in value["input"]
            .as_object()
            .ok_or("Missing typed input")?
            .values()
        {
            let text = value.as_str().ok_or("Input must be text")?;
            if text.trim().is_empty() || text.len() > 16_384 {
                return Err("Each input must contain 1â€“16384 bytes of nonblank text".into());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    Simulated,
    Executed,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ToolOutput {
    pub tool: ToolName,
    pub status: ExecutionStatus,
    pub message: String,
    pub executed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolDescriptor {
    pub name: ToolName,
    pub description: &'static str,
    pub permission: Permission,
    pub implementation: &'static str,
    pub input_schema: Value,
    pub output_schema: Value,
}

pub trait Tool: Send + Sync {
    fn descriptor(&self) -> ToolDescriptor;
    fn execute(&self, input: &ToolInput, log: &ActivityLog) -> Result<ToolOutput, String>;
}

struct SimulatedTool {
    name: ToolName,
    description: &'static str,
    input_schema: Value,
}
impl Tool for SimulatedTool {
    fn descriptor(&self) -> ToolDescriptor {
        ToolDescriptor {
            name: self.name,
            description: self.description,
            permission: policy(self.name),
            implementation: "simulated",
            input_schema: self.input_schema.clone(),
            output_schema: serde_json::to_value(schema_for!(ToolOutput))
                .expect("schema serialization"),
        }
    }
    fn execute(&self, input: &ToolInput, _log: &ActivityLog) -> Result<ToolOutput, String> {
        if input.name() != self.name {
            return Err("Tool input does not match adapter".into());
        }
        input.validate()?;
        Ok(ToolOutput {
            tool: self.name,
            status: ExecutionStatus::Simulated,
            executed: false,
            message: format!(
                "Simulated {:?}: OS/service integration is not implemented. No action was executed.",
                self.name
            ),
        })
    }
}

struct CreateNoteTool;

impl Tool for CreateNoteTool {
    fn descriptor(&self) -> ToolDescriptor {
        ToolDescriptor {
            name: ToolName::CreateNote,
            description: "Save a note in Voicela's local history",
            permission: policy(ToolName::CreateNote),
            implementation: "local",
            input_schema: serde_json::to_value(schema_for!(CreateNoteInput))
                .expect("schema serialization"),
            output_schema: serde_json::to_value(schema_for!(ToolOutput))
                .expect("schema serialization"),
        }
    }

    fn execute(&self, input: &ToolInput, log: &ActivityLog) -> Result<ToolOutput, String> {
        let ToolInput::CreateNote(note) = input else {
            return Err("Tool input does not match adapter".into());
        };
        input.validate()?;
        let content = serde_json::to_string(note).map_err(|error| error.to_string())?;
        // The saved note is the execution record. One insert commits both together.
        log.append(ToolName::CreateNote, &content, ActivityStatus::Executed)?;
        Ok(ToolOutput {
            tool: ToolName::CreateNote,
            status: ExecutionStatus::Executed,
            executed: true,
            message: "Note saved in Voicela's local activity history.".into(),
        })
    }
}

struct WindowsTool {
    name: ToolName,
    description: &'static str,
    input_schema: Value,
}
impl Tool for WindowsTool {
    fn descriptor(&self) -> ToolDescriptor {
        ToolDescriptor {
            name: self.name,
            description: self.description,
            permission: policy(self.name),
            implementation: "local",
            input_schema: self.input_schema.clone(),
            output_schema: serde_json::to_value(schema_for!(ToolOutput))
                .expect("schema serialization"),
        }
    }
    fn execute(&self, input: &ToolInput, log: &ActivityLog) -> Result<ToolOutput, String> {
        if input.name() != self.name {
            return Err("Tool input does not match adapter".into());
        }
        input.validate()?;
        let message = match input {
            ToolInput::OpenApp(value) => crate::platform::open_app(&value.app)?,
            ToolInput::BrowserSearch(value) => crate::platform::browser_search(&value.query)?,
            ToolInput::FindFile(value) => crate::platform::find_files(&value.query)?,
            ToolInput::ControlApp(value) => {
                crate::app_control::execute(&value.action, &value.target, &value.window)?
            }
            _ => return Err("Unsupported Windows adapter".into()),
        };
        log.append(
            self.name,
            if self.name == ToolName::ControlApp {
                "App control completed; content retained only in the current result."
            } else {
                &message
            },
            ActivityStatus::Executed,
        )
        .map_err(|e| {
            format!(
                "Action finished but history could not be saved: {e}. Do not automatically retry."
            )
        })?;
        Ok(ToolOutput {
            tool: self.name,
            status: ExecutionStatus::Executed,
            executed: true,
            message,
        })
    }
}

pub struct ToolRegistry {
    tools: Vec<Box<dyn Tool>>,
}
impl Default for ToolRegistry {
    fn default() -> Self {
        macro_rules! stub {
            ($name:ident, $input:ty, $description:literal) => {
                Box::new(SimulatedTool {
                    name: ToolName::$name,
                    description: $description,
                    input_schema: serde_json::to_value(schema_for!($input))
                        .expect("schema serialization"),
                }) as Box<dyn Tool>
            };
        }
        macro_rules! local {
            ($name:ident, $input:ty, $description:literal) => {
                Box::new(WindowsTool {
                    name: ToolName::$name,
                    description: $description,
                    input_schema: serde_json::to_value(schema_for!($input))
                        .expect("schema serialization"),
                }) as Box<dyn Tool>
            };
        }
        Self {
            tools: vec![
                local!(
                    ControlApp,
                    ControlAppInput,
                    "Inspect and control visible Windows app controls"
                ),
                local!(
                    OpenApp,
                    OpenAppInput,
                    "Launch an installed Windows app by its Start menu name"
                ),
                local!(
                    FindFile,
                    FindFileInput,
                    "Search filenames in Desktop, Documents and Downloads"
                ),
                Box::new(CreateNoteTool),
                stub!(
                    CalendarEvent,
                    CalendarEventInput,
                    "Prepare a calendar event"
                ),
                stub!(
                    DraftMessage,
                    DraftMessageInput,
                    "Prepare a message draft; never send"
                ),
                local!(
                    BrowserSearch,
                    BrowserSearchInput,
                    "Search with an approved browser integration"
                ),
            ],
        }
    }
}
impl ToolRegistry {
    pub fn get(&self, name: ToolName) -> Result<&dyn Tool, String> {
        self.tools
            .iter()
            .find(|t| t.descriptor().name == name)
            .map(|t| t.as_ref())
            .ok_or_else(|| "Tool is not allowlisted".into())
    }
    pub fn descriptors(&self) -> Vec<ToolDescriptor> {
        self.tools.iter().map(|t| t.descriptor()).collect()
    }
}
