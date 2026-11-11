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
            ToolName::ControlApp
                | ToolName::CreateNote
                | ToolName::CalendarEvent
                | ToolName::DraftMessage
                | ToolName::BrowserSearch
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn launching_installed_apps_does_not_need_a_second_confirmation() {
        assert!(!policy(ToolName::OpenApp).requires_approval);
        for tool in [
            ToolName::CreateNote,
            ToolName::CalendarEvent,
            ToolName::DraftMessage,
            ToolName::BrowserSearch,
        ] {
            assert!(policy(tool).requires_approval);
        }
    }
}
