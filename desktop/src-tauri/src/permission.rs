use crate::tools::ToolName;
use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Permission {
    pub enabled: bool,
    pub requires_approval: bool,
}

/// No caller-supplied approval flag is trusted. Approval applies to one stored request.
pub fn policy(tool: ToolName) -> Permission {
    Permission {
        enabled: true,
        requires_approval: matches!(
            tool,
            ToolName::OpenApp
                | ToolName::CreateNote
                | ToolName::CalendarEvent
                | ToolName::DraftMessage
                | ToolName::BrowserSearch
        ),
    }
}
