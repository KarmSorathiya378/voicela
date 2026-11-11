# Gmail and Google Calendar

Real mode invokes native Rust commands registered by the desktop shell. Sandbox mode uses native validation and single-use previews, returns a simulated receipt and never accesses tokens or Google APIs. GooglePanel connects/disconnects and executes one reviewed action; WorkflowPanel saves and executes Calendar-then-Gmail routines. The shell owner must mount both exported panels.

## Connect a real account

1. In Google Cloud, enable Gmail API and Google Calendar API. Configure the OAuth consent screen and add the account as a test user when the application is in testing.
2. Create an OAuth client of type Desktop app. Enter its client ID and client secret in GooglePanel, select Real Google account and Connect Google. Do not put credentials in repository files or browser storage.
3. Consent in the system browser. Native Rust uses authorization code + S256 PKCE, random state, an ephemeral 127.0.0.1 callback port and a 120-second deadline. Scopes are only gmail.send and calendar.events.owned. Contacts, mailbox reading and calendar attendees are unsupported.
4. Save/review a routine, select real mode and approve the exact immutable recipient, subject/body and/or event title/start/end. Enter a single full ASCII email address. Natural contact names, recipient lists, header injection, natural dates, missing/unknown offsets, invalid dates and non-increasing event intervals are rejected. Whole-second RFC3339 with an explicit UTC offset is required; users must resolve DST ambiguity explicitly.
5. Disconnect deletes Windows Credential Manager credentials before attempting Google revocation. Failed remote revocation is reported with account-settings recovery instructions. Disconnect invalidates outstanding previews and preserves execution guards.

Refresh tokens and client configuration are stored only in the Windows-native keyring. Access tokens remain in native request memory, never returned to JavaScript. Tokens/provider response bodies are not logged. Refresh failures require reconnect. OAuth/confirm/disconnect are serialized; preview contents cannot be changed after review. Preview IDs are single-use, expire in five minutes, and outstanding previews are bounded.

## Execution guarantees and limits

Before any real provider write, SQLite in app data records a unique SHA-256 action guard with synchronous=FULL. The guard includes the OAuth client ID and exact serialized content, so reconnect/refresh-token rotation and another window cannot replay an identical action for that client. Switching accounts on the same client conservatively shares guards. A different client ID or different action content is a different request. Guards contain hashes, status and provider receipts, never message content or credentials. Calendar's generated event ID is persisted before insert.

Writes are never automatically retried. HTTP 401, 429 and other failures are reported without exposing response bodies; expired authentication before a write can be reconnected and reviewed again. After an attempted write, including rate limits or ambiguous network failure, the action stays blocked. Inspect Sent/Calendar before recovery; do not remove guards to blindly retry. This favors avoiding duplicate sends over availability. App-data deletion removes these local guarantees.

Calendar creates an event on primary with no attendees, then GET-verifies ID, title and equivalent start/end instants. Only GET verification retries (up to three attempts on network, rate-limit or server failure). Gmail sends MIME-encoded UTF-8 content and returns the provider message ID as an acknowledgement. With send-only scope it cannot verify delivery or read Sent; it returns verified=false and the UI says delivery is not verified. Never claim exactly-once delivery from an HTTP acknowledgement.

Real-account consent and provider writes have not been tested with live credentials in this task. Deployment still requires a Google Desktop client, enabled APIs, appropriate consent configuration and any Google verification required for distribution.

Reference: [Google Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Gmail send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send).
