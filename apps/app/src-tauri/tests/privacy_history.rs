use desktop_lib::{
    activity_log::{ActivityLog, ActivityStatus},
    permission,
    tools::ToolName,
};

#[test]
fn privacy_retention_applies_at_startup_writes_and_reads() {
    let directory =
        std::env::temp_dir().join(format!("voicela-retention-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let path = directory.join("activity.sqlite3");
    let log = ActivityLog::open(&path).unwrap();
    permission::initialize(&directory).unwrap();
    permission::enforce_retention().unwrap();
    assert!(!permission::integration_enabled("application_access"));
    log.append(
        ToolName::FindFile,
        "Never retained",
        ActivityStatus::Executed,
    )
    .unwrap();
    assert!(log.recent(50).unwrap().is_empty());

    let mut settings = permission::get_privacy_settings().unwrap();
    settings.retention_days = 7;
    permission::set_privacy_settings(settings).unwrap();
    let connection = rusqlite::Connection::open(&path).unwrap();
    let insert_expired = || {
        connection.execute(
        "INSERT INTO activity_log(timestamp,tool,intent,status) VALUES (strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'),'\"find_file\"','Expired','\"executed\"')", []
    ).unwrap()
    };
    insert_expired();
    log.append(ToolName::FindFile, "Retained", ActivityStatus::Executed)
        .unwrap();
    let count: i64 = connection
        .query_row("SELECT count(*) FROM activity_log", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1, "append must purge expired records");
    insert_expired();
    let entries = log.recent(50).unwrap();
    assert_eq!(entries.len(), 1, "reads must purge expired records");
    assert_eq!(entries[0].intent, "Retained");

    let mut settings = permission::get_privacy_settings().unwrap();
    settings.retention_days = 0;
    permission::set_privacy_settings(settings).unwrap();
    assert!(log.recent(50).unwrap().is_empty());
    drop(connection);
    drop(log);
    std::fs::remove_dir_all(directory).unwrap();
}
