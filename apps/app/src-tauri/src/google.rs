use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    io::{Read, Write},
    net::TcpListener,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::Manager;
const SCOPES: &str = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events.owned";
fn require_google_permission() -> Result<(), String> {
    if crate::permission::integration_enabled("google") {
        Ok(())
    } else {
        Err("Enable Google in privacy settings first".into())
    }
}
fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|_| "HTTP initialization failed".into())
}
fn vault() -> Result<keyring::Entry, String> {
    keyring::Entry::new("Voicela.Google", "primary")
        .map_err(|_| "Windows credential storage unavailable".into())
}
fn response(r: reqwest::blocking::Response) -> Result<Value, String> {
    let status = r.status();
    if status.as_u16() == 401 {
        return Err("Session expired. Reconnect Google.".into());
    }
    if status.as_u16() == 429 {
        let wait = r
            .headers()
            .get("retry-after")
            .and_then(|h| h.to_str().ok())
            .and_then(|h| h.parse::<u64>().ok());
        return Err(format!(
            "Google rate limit{}. Attempted writes remain blocked; reconcile before retrying.",
            wait.map(|n| format!("; wait at least {n} seconds"))
                .unwrap_or_default()
        ));
    }
    if !status.is_success() {
        return Err(format!(
            "Google request failed ({status}); reconcile before retry."
        ));
    }
    r.json().map_err(|_| "Invalid Google response".into())
}
#[tauri::command(async)]
pub fn google_connect(client_id: String, client_secret: String) -> Result<(), String> {
    require_google_permission()?;
    let _session = SESSION.lock().map_err(|_| "Session lock failed")?;
    previews()
        .lock()
        .map_err(|_| "Preview lock failed")?
        .clear();
    if !client_id.ends_with(".apps.googleusercontent.com") {
        return Err("Provide a Google Desktop OAuth client ID".into());
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|_| "Cannot create OAuth callback")?;
    listener
        .set_nonblocking(true)
        .map_err(|_| "Callback failed")?;
    let redirect = format!(
        "http://127.0.0.1:{}/",
        listener
            .local_addr()
            .map_err(|_| "Callback unavailable")?
            .port()
    );
    let state = uuid::Uuid::new_v4().to_string();
    let verifier = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut url = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth").unwrap();
    url.query_pairs_mut().extend_pairs([
        ("client_id", client_id.as_str()),
        ("redirect_uri", &redirect),
        ("response_type", "code"),
        ("scope", SCOPES),
        ("state", &state),
        ("code_challenge", &challenge),
        ("code_challenge_method", "S256"),
        ("access_type", "offline"),
        ("prompt", "consent"),
    ]);
    open::that(url.as_str()).map_err(|_| "Cannot open system browser")?;
    let deadline = Instant::now() + Duration::from_secs(120);
    let code = loop {
        if Instant::now() > deadline {
            return Err("OAuth timed out".into());
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream
                    .set_read_timeout(Some(Duration::from_secs(2)))
                    .map_err(|_| "Callback failed")?;
                let mut buf = [0; 8192];
                let n = stream.read(&mut buf).map_err(|_| "Callback read failed")?;
                let request = String::from_utf8_lossy(&buf[..n]);
                let path = request
                    .split_whitespace()
                    .nth(1)
                    .ok_or("Invalid callback")?;
                let callback = url::Url::parse(&format!("http://127.0.0.1{path}"))
                    .map_err(|_| "Invalid callback")?;
                let params: HashMap<_, _> = callback.query_pairs().into_owned().collect();
                let _=stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nReturn to Voicela.");
                if params.get("state") != Some(&state) {
                    continue;
                }
                break params
                    .get("code")
                    .ok_or("Google authorization denied")?
                    .clone();
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(80))
            }
            Err(_) => return Err("Callback failed".into()),
        }
    };
    require_google_permission()?;
    let token = response(
        client()?
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", client_id.as_str()),
                ("client_secret", &client_secret),
                ("code", &code),
                ("code_verifier", &verifier),
                ("redirect_uri", &redirect),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .map_err(|_| "Token exchange failed")?,
    )?;
    let refresh = token["refresh_token"]
        .as_str()
        .ok_or("No refresh token returned; reconnect with consent")?;
    require_google_permission()?;
    vault()?
        .set_password(
            &json!({"refresh":refresh,"client_id":client_id,"client_secret":client_secret})
                .to_string(),
        )
        .map_err(|_| "Cannot securely save Google session".into())
}
fn action_key(action: &Action, account: &str) -> Result<String, String> {
    let bytes = serde_json::to_vec(action).map_err(|_| "Invalid action")?;
    // Stable OAuth client ID binds guards across reconnects, including refresh-token rotation.
    Ok(format!(
        "{:x}",
        Sha256::digest([account.as_bytes(), &bytes].concat())
    ))
}
fn claim(db: &rusqlite::Connection, key: &str) -> Result<(), String> {
    db.execute_batch("PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS executions(action_key TEXT PRIMARY KEY, status TEXT NOT NULL, receipt TEXT);").map_err(|_| "Execution journal unavailable")?;
    db.execute("INSERT INTO executions(action_key,status) VALUES(?1,'uncertain')", [key])
        .map_err(|_| "Action already attempted or journal unavailable. Inspect Google Sent/Calendar before recovery; replay blocked.".to_string())?;
    Ok(())
}
fn recipient(value: &str) -> bool {
    let Some((local, domain)) = value.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && local.len() <= 64
        && !local.starts_with('.')
        && !local.ends_with('.')
        && !local.contains("..")
        && local
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".!#$%&'*+-/=?^_`{|}~".contains(&b))
        && domain.contains('.')
        && domain.split('.').all(|s| {
            !s.is_empty()
                && !s.starts_with('-')
                && !s.ends_with('-')
                && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
}
// Strict whole-second RFC3339, rejecting natural dates, missing zones and invalid calendar dates.
fn timestamp(s: &str) -> Option<i64> {
    let b = s.as_bytes();
    if !(b.len() == 20 || b.len() == 25)
        || b[4] != b'-'
        || b[7] != b'-'
        || b[10] != b'T'
        || b[13] != b':'
        || b[16] != b':'
    {
        return None;
    }
    let n = |a: usize, z: usize| -> Option<i64> {
        let v = b.get(a..z)?;
        if !v.iter().all(u8::is_ascii_digit) {
            return None;
        }
        std::str::from_utf8(v).ok()?.parse().ok()
    };
    let (y, m, d, h, min, sec) = (
        n(0, 4)?,
        n(5, 7)?,
        n(8, 10)?,
        n(11, 13)?,
        n(14, 16)?,
        n(17, 19)?,
    );
    let leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
    let days = match m {
        2 => {
            if leap {
                29
            } else {
                28
            }
        }
        4 | 6 | 9 | 11 => 30,
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        _ => return None,
    };
    if y < 1 || d < 1 || d > days || h > 23 || min > 59 || sec > 59 {
        return None;
    }
    let offset = if b.len() == 20 {
        if b[19] != b'Z' {
            return None;
        }
        0
    } else {
        if !matches!(b[19], b'+' | b'-') || b[22] != b':' {
            return None;
        }
        let (oh, om) = (n(20, 22)?, n(23, 25)?);
        if oh > 23 || om > 59 || &s[19..] == "-00:00" {
            return None;
        }
        (oh * 60 + om) * 60 * if b[19] == b'+' { 1 } else { -1 }
    };
    let yy = y - 1;
    let mut total = 365 * yy + yy / 4 - yy / 100 + yy / 400;
    for month in 1..m {
        total += match month {
            2 => {
                if leap {
                    29
                } else {
                    28
                }
            }
            4 | 6 | 9 | 11 => 30,
            _ => 31,
        };
    }
    Some((total + d - 1) * 86400 + h * 3600 + min * 60 + sec - offset)
}
fn access() -> Result<String, String> {
    let saved = vault()?
        .get_password()
        .map_err(|_| "Connect Google first")?;
    let v: Value = serde_json::from_str(&saved).map_err(|_| "Invalid stored session")?;
    let token = response(
        client()?
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", v["client_id"].as_str().unwrap_or("")),
                ("client_secret", v["client_secret"].as_str().unwrap_or("")),
                ("refresh_token", v["refresh"].as_str().unwrap_or("")),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .map_err(|_| "Session refresh failed; reconnect Google")?,
    ).map_err(|_| "Google session refresh failed or expired. Reconnect Google before creating a fresh preview.")?;
    token["access_token"]
        .as_str()
        .map(str::to_owned)
        .ok_or("Session expired; reconnect Google".into())
}
#[tauri::command(async)]
pub fn google_disconnect() -> Result<(), String> {
    let _session = SESSION.lock().map_err(|_| "Session lock failed")?;
    previews()
        .lock()
        .map_err(|_| "Preview lock failed")?
        .clear();
    // Remove local credentials even when provider revocation is unavailable.
    let entry = vault()?;
    let saved = entry.get_password().ok();
    entry
        .delete_credential()
        .map_err(|_| "Could not remove credentials")?;
    if let Some(saved) = saved {
        if let Ok(v) = serde_json::from_str::<Value>(&saved) {
            if let Some(token) = v["refresh"].as_str() {
                let r = client()?
                    .post("https://oauth2.googleapis.com/revoke")
                    .form(&[("token", token)])
                    .send();
                if r.as_ref()
                    .map(|response| !response.status().is_success())
                    .unwrap_or(true)
                {
                    return Err("Local credentials removed; revoke Voicela in Google account settings to finish remote disconnect".into());
                }
            }
        }
    }
    Ok(())
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    Mail {
        to: String,
        subject: String,
        body: String,
    },
    Event {
        summary: String,
        start: String,
        end: String,
    },
}
#[derive(Clone)]
struct Preview {
    action: Action,
    sandbox: bool,
    created: Instant,
}
static SESSION: Mutex<()> = Mutex::new(());
static PREVIEWS: OnceLock<Mutex<HashMap<String, Preview>>> = OnceLock::new();
fn previews() -> &'static Mutex<HashMap<String, Preview>> {
    PREVIEWS.get_or_init(|| Mutex::new(HashMap::new()))
}
#[tauri::command(async)]
pub fn google_preview(action: Action, sandbox: bool) -> Result<Value, String> {
    if !sandbox { require_google_permission()?; }
    let _session = SESSION.lock().map_err(|_| "Session lock failed")?;
    match &action {
        Action::Mail { to, subject, body } => {
            if !recipient(to)
                || to.contains(['\r', '\n'])
                || subject.contains(['\r', '\n'])
                || !to.contains('@')
                || to.len() > 254
                || subject.len() > 998
                || body.len() > 100000
            {
                return Err("Invalid recipient or message".into());
            }
        }
        Action::Event {
            summary,
            start,
            end,
        } => {
            if summary.trim().is_empty()
                || summary.len() > 1000
                || timestamp(start)
                    .zip(timestamp(end))
                    .map(|(s, e)| e <= s)
                    .unwrap_or(true)
            {
                return Err("Supply event title and valid increasing RFC3339 times with explicit UTC offset (for example 2026-11-20T09:00:00+05:30)".into());
            }
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    let mut p = previews().lock().map_err(|_| "Preview lock failed")?;
    p.retain(|_, v| v.created.elapsed() < Duration::from_secs(300));
    if p.len() >= 128 {
        return Err(
            "Too many outstanding previews. Wait five minutes or disconnect to clear them.".into(),
        );
    }
    p.insert(
        id.clone(),
        Preview {
            action: action.clone(),
            sandbox,
            created: Instant::now(),
        },
    );
    Ok(json!({"id":id,"action":action,"mode":if sandbox {"sandbox"}else{"real"}}))
}
fn provider_timestamp(s: &str) -> Option<i64> {
    if let Some(dot) = s.find('.') {
        let zone = s[dot..].find(['Z', '+', '-'])? + dot;
        if !s[dot + 1..zone].bytes().all(|b| b == b'0') {
            return None;
        }
        return timestamp(&format!("{}{}", &s[..dot], &s[zone..]));
    }
    timestamp(s)
}
fn read_event(http: &reqwest::blocking::Client, token: &str, id: &str) -> Result<Value, String> {
    for attempt in 0..3 {
        let result = http
            .get(format!(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events/{id}"
            ))
            .bearer_auth(token)
            .send();
        let retryable = result
            .as_ref()
            .map(|r| r.status().as_u16() == 429 || r.status().is_server_error())
            .unwrap_or(true);
        if retryable && attempt < 2 {
            let wait = result
                .as_ref()
                .ok()
                .and_then(|r| r.headers().get("retry-after"))
                .and_then(|h| h.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(1 << attempt);
            if wait > 5 {
                return response(result.map_err(|_| "Verification network failure")?);
            }
            std::thread::sleep(Duration::from_secs(wait));
            continue;
        }
        return response(result.map_err(|_| "Verification network failure")?);
    }
    Err("Verification unavailable".into())
}
fn mail_raw(to: &str, subject: &str, body: &str) -> String {
    let mut parts = Vec::new();
    let mut part = String::new();
    for ch in subject.chars() {
        if part.len() + ch.len_utf8() > 42 {
            parts.push(std::mem::take(&mut part));
        }
        part.push(ch);
    }
    parts.push(part);
    let subject = parts
        .iter()
        .filter(|p| !p.is_empty())
        .map(|p| {
            format!(
                "=?UTF-8?B?{}?=",
                base64::engine::general_purpose::STANDARD.encode(p.as_bytes())
            )
        })
        .collect::<Vec<_>>()
        .join("\r\n ");
    let body = base64::engine::general_purpose::STANDARD.encode(body.as_bytes());
    let wrapped = body
        .as_bytes()
        .chunks(76)
        .map(|v| std::str::from_utf8(v).unwrap_or(""))
        .collect::<Vec<_>>()
        .join("\r\n");
    URL_SAFE_NO_PAD.encode(format!("To: {to}\r\nSubject: {subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{wrapped}"))
}
fn consume_preview(id: &str) -> Result<Preview, String> {
    let p = previews()
        .lock()
        .map_err(|_| "Preview lock failed")?
        .remove(id)
        .ok_or("Preview consumed or missing; never replay uncertain sends")?;
    if p.created.elapsed() > Duration::from_secs(300) {
        return Err("Preview expired; review again".into());
    }
    Ok(p)
}
#[tauri::command(async)]
pub fn google_confirm(app: tauri::AppHandle, preview_id: String) -> Result<Value, String> {
    let _session = SESSION.lock().map_err(|_| "Session lock failed")?;
    let p = consume_preview(&preview_id)?;
    if p.sandbox {
        return Ok(json!({"id":preview_id,"verified":true,"sandbox":true}));
    }
    require_google_permission()?;
    let token = access()?;
    let http = client()?;
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "App storage unavailable")?;
    std::fs::create_dir_all(&directory).map_err(|_| "App storage unavailable")?;
    let db = rusqlite::Connection::open(directory.join("google-executions.sqlite3"))
        .map_err(|_| "Execution journal unavailable")?;
    // Never journal credentials. A client ID conservatively shares duplicate guards across account switches.
    let saved = vault()?
        .get_password()
        .map_err(|_| "Connect Google first")?;
    let credentials: Value = serde_json::from_str(&saved).map_err(|_| "Invalid stored session")?;
    let key = action_key(
        &p.action,
        credentials["client_id"]
            .as_str()
            .ok_or("Invalid stored session")?,
    )?;
    require_google_permission()?;
    claim(&db, &key)?;
    let mail = matches!(&p.action, Action::Mail { .. });
    let id = match p.action {
        Action::Mail { to, subject, body } => {
            let raw = mail_raw(&to, &subject, &body);
            let result = response(
                http.post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
                    .bearer_auth(&token)
                    .json(&json!({"raw":raw}))
                    .send()
                    .map_err(|_| "Send result uncertain. Check Sent before retrying")?,
            )?;
            result["id"]
                .as_str()
                .ok_or("Google did not acknowledge message; check Sent")?
                .to_owned()
        }
        Action::Event {
            summary,
            start,
            end,
        } => {
            let event_id = uuid::Uuid::new_v4().simple().to_string();
            db.execute(
                "UPDATE executions SET receipt=?1 WHERE action_key=?2",
                rusqlite::params![event_id, key],
            )
            .map_err(|_| "Journal unavailable; event not attempted")?;
            response(http.post("https://www.googleapis.com/calendar/v3/calendars/primary/events").bearer_auth(&token).json(&json!({"id":event_id,"summary":summary,"start":{"dateTime":start},"end":{"dateTime":end}})).send().map_err(|_| "Calendar result uncertain; inspect calendar before retry")?)?;
            let result = read_event(&http, &token, &event_id)
                .map_err(|e| format!("Event {event_id} may exist. Verification failed: {e}. Inspect Calendar; do not resend."))?;
            if result["id"] != event_id
                || result["summary"] != summary
                || result["start"]["dateTime"]
                    .as_str()
                    .and_then(provider_timestamp)
                    != timestamp(&start)
                || result["end"]["dateTime"]
                    .as_str()
                    .and_then(provider_timestamp)
                    != timestamp(&end)
            {
                return Err("Calendar verification mismatch".into());
            }
            event_id
        }
    };
    db.execute(
        "UPDATE executions SET status=?3, receipt=?1 WHERE action_key=?2",
        rusqlite::params![id, key, if mail { "acknowledged" } else { "verified" }],
    )
    .map_err(|_| "Provider accepted action but journal update failed; reconcile before retry")?;
    Ok(json!({"id":id,"verified":!mail,"acknowledged":true,"sandbox":false}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_mail_header_injection() {
        assert!(
            google_preview(
                Action::Mail {
                    to: "a@example.com\r\nBcc: b@example.com".into(),
                    subject: "Hello".into(),
                    body: "Body".into()
                },
                true
            )
            .is_err()
        );
    }
    #[test]
    fn sandbox_preview_preserves_exact_content() {
        let value = google_preview(
            Action::Mail {
                to: "a@example.com".into(),
                subject: "Hello".into(),
                body: "Exact content".into(),
            },
            true,
        )
        .unwrap();
        assert_eq!(value["mode"], "sandbox");
        assert_eq!(value["action"]["body"], "Exact content");
        let id = value["id"].as_str().unwrap();
        let removed = previews().lock().unwrap().remove(id).unwrap();
        assert!(removed.sandbox);
        assert!(previews().lock().unwrap().remove(id).is_none());
    }
    #[test]
    fn duplicate_guard_survives_restart_and_reconnect() {
        let path =
            std::env::temp_dir().join(format!("google-test-{}.sqlite3", uuid::Uuid::new_v4()));
        let action = Action::Mail {
            to: "a@example.com".into(),
            subject: "Hello".into(),
            body: "Content".into(),
        };
        let key = action_key(&action, "client").unwrap();
        {
            let db = rusqlite::Connection::open(&path).unwrap();
            claim(&db, &key).unwrap();
            assert!(claim(&db, &key).is_err());
        }
        {
            let db = rusqlite::Connection::open(&path).unwrap();
            assert!(claim(&db, &key).is_err());
        }
        let _ = std::fs::remove_file(path);
    }
    #[test]
    fn preview_required_single_use_and_expiry() {
        assert!(consume_preview("not-reviewed").is_err());
        let v = google_preview(
            Action::Mail {
                to: "exact@example.com".into(),
                subject: "Review".into(),
                body: "Exact".into(),
            },
            true,
        )
        .unwrap();
        let id = v["id"].as_str().unwrap();
        assert!(consume_preview(id).is_ok());
        assert!(consume_preview(id).is_err());
        let v = google_preview(
            Action::Mail {
                to: "exact@example.com".into(),
                subject: "Review".into(),
                body: "Exact".into(),
            },
            true,
        )
        .unwrap();
        let id = v["id"].as_str().unwrap();
        previews().lock().unwrap().get_mut(id).unwrap().created =
            Instant::now() - Duration::from_secs(301);
        assert!(consume_preview(id).is_err());
    }
    #[test]
    fn ambiguous_contacts_and_dates_are_rejected() {
        for to in [
            "Alex",
            "a@example.com,b@example.com",
            "A <a@example.com>",
            "a@@example.com",
            "a@example.com Bcc:b@example.com",
        ] {
            assert!(!recipient(to));
        }
        for time in [
            "tomorrow",
            "2026-11-20T09:00:00",
            "2026-02-29T09:00:00Z",
            "2026-11-20T25:00:00Z",
            "2026-11-20T09:00:00-00:00",
        ] {
            assert!(timestamp(time).is_none(), "{time}");
        }
        assert_eq!(
            timestamp("2026-11-20T09:00:00+05:30"),
            timestamp("2026-11-20T03:30:00Z")
        );
        assert!(
            google_preview(
                Action::Event {
                    summary: "Meeting".into(),
                    start: "2026-11-20T09:00:00Z".into(),
                    end: "2026-11-20T08:00:00Z".into()
                },
                true
            )
            .is_err()
        );
    }
    #[test]
    fn mime_preserves_unicode_message_and_limits_encoded_words() {
        let subject = "Meeting \u{65e5}\u{672c}\u{8a9e} ".repeat(20);
        let body = "Exact \u{1f980} body\nWith another line";
        let raw = String::from_utf8(
            URL_SAFE_NO_PAD
                .decode(mail_raw("a@example.com", &subject, body))
                .unwrap(),
        )
        .unwrap();
        let (headers, encoded) = raw.split_once("\r\n\r\n").unwrap();
        assert!(headers.starts_with("To: a@example.com\r\nSubject: "));
        assert_eq!(
            base64::engine::general_purpose::STANDARD
                .decode(encoded.replace("\r\n", ""))
                .unwrap(),
            body.as_bytes()
        );
        assert!(headers.lines().all(|line| line.len() <= 78));
        let decoded = headers
            .split("=?UTF-8?B?")
            .skip(1)
            .map(|p| {
                String::from_utf8(
                    base64::engine::general_purpose::STANDARD
                        .decode(p.split("?=").next().unwrap())
                        .unwrap(),
                )
                .unwrap()
            })
            .collect::<String>();
        assert_eq!(decoded, subject);
    }
    #[test]
    fn concurrent_native_claims_have_one_winner() {
        let path =
            std::env::temp_dir().join(format!("google-race-{}.sqlite3", uuid::Uuid::new_v4()));
        {
            let db = rusqlite::Connection::open(&path).unwrap();
            claim(&db, "setup").unwrap();
        }
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
        let handles: Vec<_> = (0..2)
            .map(|_| {
                let path = path.clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    let db = rusqlite::Connection::open(path).unwrap();
                    barrier.wait();
                    claim(&db, "same-action").is_ok()
                })
            })
            .collect();
        assert_eq!(
            handles
                .into_iter()
                .map(|h| usize::from(h.join().unwrap()))
                .sum::<usize>(),
            1
        );
        let _ = std::fs::remove_file(path);
    }
}
