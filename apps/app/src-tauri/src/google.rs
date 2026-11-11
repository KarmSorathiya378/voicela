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
const SCOPES: &str = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events.owned";
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
        return Err("Google rate limit. Wait and reconcile before retrying.".into());
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
    vault()?
        .set_password(
            &json!({"refresh":refresh,"client_id":client_id,"client_secret":client_secret})
                .to_string(),
        )
        .map_err(|_| "Cannot securely save Google session".into())
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
    )?;
    token["access_token"]
        .as_str()
        .map(str::to_owned)
        .ok_or("Session expired; reconnect Google".into())
}
#[tauri::command(async)]
pub fn google_disconnect() -> Result<(), String> {
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
                if r.as_ref().map(|response| !response.status().is_success()).unwrap_or(true) {
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
static PREVIEWS: OnceLock<Mutex<HashMap<String, Preview>>> = OnceLock::new();
fn previews() -> &'static Mutex<HashMap<String, Preview>> {
    PREVIEWS.get_or_init(|| Mutex::new(HashMap::new()))
}
#[tauri::command(async)]
pub fn google_preview(action: Action, sandbox: bool) -> Result<Value, String> {
    match &action {
        Action::Mail { to, subject, body } => {
            if to.contains(['\r', '\n'])
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
            if summary.trim().is_empty() || start.is_empty() || end.is_empty() {
                return Err("Supply event title and RFC3339 times".into());
            }
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    let mut p = previews().lock().map_err(|_| "Preview lock failed")?;
    p.retain(|_, v| v.created.elapsed() < Duration::from_secs(300));
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
#[tauri::command(async)]
pub fn google_confirm(preview_id: String) -> Result<Value, String> {
    let p = previews()
        .lock()
        .map_err(|_| "Preview lock failed")?
        .remove(&preview_id)
        .ok_or("Preview consumed or missing; never replay uncertain sends")?;
    if p.created.elapsed() > Duration::from_secs(300) {
        return Err("Preview expired; review again".into());
    }
    if p.sandbox {
        return Ok(json!({"id":preview_id,"verified":true,"sandbox":true}));
    }
    let token = access()?;
    let http = client()?;
    let id = match p.action {
        Action::Mail { to, subject, body } => {
            let raw=URL_SAFE_NO_PAD.encode(format!("To: {to}\r\nSubject: {subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{body}"));
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
            response(http.post("https://www.googleapis.com/calendar/v3/calendars/primary/events").bearer_auth(&token).json(&json!({"id":event_id,"summary":summary,"start":{"dateTime":start},"end":{"dateTime":end}})).send().map_err(|_| "Calendar result uncertain; inspect calendar before retry")?)?;
            let result = response(
                http.get(format!(
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}"
                ))
                .bearer_auth(&token)
                .send()
                .map_err(|_| "Event created but verification unavailable")?,
            )?;
            if result["id"] != event_id {
                return Err("Calendar verification mismatch".into());
            }
            event_id
        }
    };
    Ok(json!({"id":id,"verified":true,"sandbox":false}))
}


#[cfg(test)]
mod tests {
 use super::*;
 #[test]
 fn rejects_mail_header_injection() {
  assert!(google_preview(Action::Mail {to:"a@example.com\r\nBcc: b@example.com".into(),subject:"Hello".into(),body:"Body".into()},true).is_err());
 }
 #[test]
 fn sandbox_preview_preserves_exact_content() {
  let value=google_preview(Action::Mail {to:"a@example.com".into(),subject:"Hello".into(),body:"Exact content".into()},true).unwrap();
  assert_eq!(value["mode"],"sandbox");
  assert_eq!(value["action"]["body"],"Exact content");
  let id=value["id"].as_str().unwrap();
  let removed=previews().lock().unwrap().remove(id).unwrap();
  assert!(removed.sandbox);
  assert!(previews().lock().unwrap().remove(id).is_none());
 }
}
