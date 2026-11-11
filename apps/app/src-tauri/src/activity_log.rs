use crate::tools::ToolName;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActivityStatus {
    AwaitingApproval,
    Approved,
    Simulated,
    Executed,
    Denied,
    ClientNote,
}

#[derive(Debug, Serialize)]
pub struct ActivityEntry {
    pub id: i64,
    /// UTC, ISO 8601 as produced by SQLite.
    pub timestamp: String,
    pub tool: ToolName,
    pub intent: String,
    pub status: ActivityStatus,
}

pub struct ActivityLog {
    connection: Connection,
}
impl ActivityLog {
    fn enforce_retention(&self) -> Result<(), String> {
        // Unit tests use isolated databases without the process-wide privacy store.
        #[cfg(test)]
        if crate::permission::get_privacy_settings().is_err() {
            return Ok(());
        }
        crate::permission::enforce_retention()
    }
    pub fn open(path: &std::path::Path) -> Result<Self, String> {
        let connection = Connection::open(path).map_err(|e| e.to_string())?;
        Self::new(connection)
    }
    fn new(connection: Connection) -> Result<Self, String> {
        connection
            .execute_batch(
                "PRAGMA secure_delete=ON;
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                tool TEXT NOT NULL, intent TEXT NOT NULL, status TEXT NOT NULL);
            PRAGMA user_version=1;",
            )
            .map_err(|e| e.to_string())?;
        Ok(Self { connection })
    }
    pub fn append(
        &self,
        tool: ToolName,
        intent: &str,
        status: ActivityStatus,
    ) -> Result<(), String> {
        self.connection
            .execute(
                "INSERT INTO activity_log(tool,intent,status) VALUES (?1,?2,?3)",
                params![
                    serde_json::to_string(&tool).map_err(|e| e.to_string())?,
                    intent,
                    serde_json::to_string(&status).map_err(|e| e.to_string())?
                ],
            )
            .map_err(|e| e.to_string())?;
        self.enforce_retention()
    }
    pub fn recent(&self, limit: u32) -> Result<Vec<ActivityEntry>, String> {
        self.enforce_retention()?;
        let mut statement = self.connection.prepare(
            "SELECT id,timestamp,tool,intent,status FROM activity_log ORDER BY id DESC LIMIT ?1")
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([limit.clamp(1, 200)], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        rows.map(|row| {
            let (id, timestamp, tool, intent, status) = row.map_err(|e| e.to_string())?;
            Ok(ActivityEntry {
                id,
                timestamp,
                tool: serde_json::from_str(&tool).map_err(|e| e.to_string())?,
                intent,
                status: serde_json::from_str(&status).map_err(|e| e.to_string())?,
            })
        })
        .collect()
    }
    pub fn clear(&self) -> Result<(), String> {
        self.connection
            .execute("DELETE FROM activity_log", [])
            .map_err(|e| e.to_string())?;
        self.connection
            .execute_batch("VACUUM")
            .map_err(|e| e.to_string())
    }
    #[cfg(test)]
    pub fn memory() -> Self {
        Self::new(Connection::open_in_memory().unwrap()).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn history_survives_reopen_and_is_ordered() {
        let path =
            std::env::temp_dir().join(format!("voicela-test-{}.sqlite3", uuid::Uuid::new_v4()));
        {
            let log = ActivityLog::open(&path).unwrap();
            log.append(ToolName::FindFile, "First", ActivityStatus::Simulated)
                .unwrap();
            log.append(ToolName::OpenApp, "Second", ActivityStatus::Denied)
                .unwrap();
        }
        {
            let log = ActivityLog::open(&path).unwrap();
            let entries = log.recent(1).unwrap();
            assert_eq!(entries.len(), 1);
            assert_eq!(entries[0].intent, "Second");
            assert!(entries[0].timestamp.ends_with('Z'));
            log.clear().unwrap();
        }
        assert!(
            ActivityLog::open(&path)
                .unwrap()
                .recent(50)
                .unwrap()
                .is_empty()
        );
        std::fs::remove_file(path).unwrap();
    }
}
