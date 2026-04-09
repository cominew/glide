# External Communication Policy

## Allowed Outgoing Channels

| Channel | Purpose | Requires Approval |
|---------|---------|-------------------|
| WebSocket (to dashboard) | Real‑time logs, event streaming | No |
| HTTP responses (API) | Returning query results | No |
| File writes (`knowledge/decisions/`, `knowledge/failures/`) | Recording outcomes | No |
| File writes (`knowledge/user/sessions/`) | Long‑term memory | No |
| Slack / Email (future) | Sending reports, alerts | Yes (user confirmation required) |

## Prohibited Channels

- Any external API without explicit allowlist
- Sending customer data to third parties
- Automated social media posting

## Logging & Auditing

- All external communication (except dashboard WebSocket) must be logged to `runtime/audit.log`
- The log includes timestamp, channel, summary of content (no sensitive data)
- User can request to view the audit log via `policy/audit` command (future)

## Rate Limiting

- Outgoing requests (e.g., to LLM API) are limited to 10 concurrent by default.
- File writes are limited to 5 per second to avoid disk contention.

## Privacy

- When writing to `knowledge/user/sessions/`, do not include raw customer contact information.
- Anonymise any personal data before storing in long‑term memory.